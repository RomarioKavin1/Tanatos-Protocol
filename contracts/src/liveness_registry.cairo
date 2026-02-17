#[starknet::contract]
pub mod LivenessRegistry {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Map, StorageMapReadAccess,
        StorageMapWriteAccess,
    };
    use core::poseidon::poseidon_hash_span;
    use crate::errors::Errors;
    use crate::interfaces::{IVaultControllerDispatcher, IVaultControllerDispatcherTrait};

    // 1 day grace period after missed interval before reporting is allowed
    const GRACE_PERIOD: u64 = 86400;
    // Minimum check-in interval: 1 day
    const MIN_INTERVAL: u64 = 86400;
    // Default consecutive misses before vault activation
    const DEFAULT_MAX_MISSED: u32 = 3;

    #[storage]
    struct Storage {
        // Semaphore group state
        group_root: felt252,
        member_count: u32,
        // Sparse Merkle tree nodes: (level, index) -> node_hash
        merkle_tree: Map<(u32, u32), felt252>,
        tree_depth: u32,
        // Per-nullifier state
        last_checkin: Map<felt252, u64>,
        checkin_interval: Map<felt252, u64>,
        missed_checkins: Map<felt252, u32>,
        vault_commitment: Map<felt252, felt252>,
        identity_commitment: Map<felt252, felt252>,
        registered: Map<felt252, bool>,
        // Tracks per-epoch nullifier usage: (nullifier_hash, epoch) -> used
        used_epoch_nullifiers: Map<(felt252, felt252), bool>,
        // Protocol config
        max_missed: u32,
        vault_controller: ContractAddress,
        garaga_verifier: ContractAddress,
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Registered: Registered,
        CheckedIn: CheckedIn,
        MissedReported: MissedReported,
        Activated: Activated,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Registered {
        #[key]
        pub nullifier_hash: felt252,
        pub vault_commitment: felt252,
        pub interval_seconds: u64,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CheckedIn {
        #[key]
        pub nullifier_hash: felt252,
        pub epoch: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MissedReported {
        #[key]
        pub nullifier_hash: felt252,
        pub missed_count: u32,
        pub reporter: ContractAddress,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Activated {
        #[key]
        pub nullifier_hash: felt252,
        pub vault_commitment: felt252,
        pub timestamp: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        vault_controller: ContractAddress,
        garaga_verifier: ContractAddress,
        owner: ContractAddress,
    ) {
        self.vault_controller.write(vault_controller);
        self.garaga_verifier.write(garaga_verifier);
        self.owner.write(owner);
        self.max_missed.write(DEFAULT_MAX_MISSED);
        self.tree_depth.write(20);
        self.member_count.write(0);
        // Initialize Merkle root as hash of two zeros (empty tree)
        let empty_root = poseidon_hash_span(array![0, 0].span());
        self.group_root.write(empty_root);
    }

    #[abi(embed_v0)]
    impl LivenessRegistryImpl of crate::interfaces::ILivenessRegistry<ContractState> {
        fn register(
            ref self: ContractState,
            identity_commitment: felt252,
            vault_commitment: felt252,
            interval_seconds: u64,
            nullifier_hash: felt252,
        ) {
            assert(!self.registered.read(nullifier_hash), Errors::ALREADY_REGISTERED);
            assert(interval_seconds >= MIN_INTERVAL, Errors::INVALID_INTERVAL);

            let now = get_block_timestamp();

            // Insert identity_commitment as a new leaf in the Merkle tree
            let index = self.member_count.read();
            self.merkle_tree.write((0, index), identity_commitment);
            self.member_count.write(index + 1);

            // Recompute root up from the new leaf
            let new_root = self._compute_root_after_insert(index, identity_commitment);
            self.group_root.write(new_root);

            // Store per-nullifier state
            self.registered.write(nullifier_hash, true);
            self.identity_commitment.write(nullifier_hash, identity_commitment);
            self.vault_commitment.write(nullifier_hash, vault_commitment);
            self.checkin_interval.write(nullifier_hash, interval_seconds);
            self.last_checkin.write(nullifier_hash, now);
            self.missed_checkins.write(nullifier_hash, 0);

            self
                .emit(
                    Registered {
                        nullifier_hash, vault_commitment, interval_seconds, timestamp: now,
                    },
                );
        }

        fn checkin(
            ref self: ContractState,
            proof: Array<felt252>,
            nullifier_hash: felt252,
            signal_hash: felt252,
            root: felt252,
            epoch: felt252,
        ) {
            assert(self.registered.read(nullifier_hash), Errors::NOT_REGISTERED);
            // Prevent re-use of the same (nullifier_hash, epoch) pair
            assert(
                !self.used_epoch_nullifiers.read((nullifier_hash, epoch)), Errors::NULLIFIER_USED,
            );

            // Verify submitted root matches on-chain group root
            // In production this would invoke the Garaga Groth16 verifier with `proof`
            let current_root = self.group_root.read();
            assert(root == current_root, Errors::INVALID_PROOF);

            // Mark this epoch as used for this nullifier
            self.used_epoch_nullifiers.write((nullifier_hash, epoch), true);

            let now = get_block_timestamp();
            self.last_checkin.write(nullifier_hash, now);
            self.missed_checkins.write(nullifier_hash, 0);

            self.emit(CheckedIn { nullifier_hash, epoch, timestamp: now });
        }

        fn report_missed(ref self: ContractState, nullifier_hash: felt252) {
            assert(self.registered.read(nullifier_hash), Errors::NOT_REGISTERED);

            let now = get_block_timestamp();
            let last = self.last_checkin.read(nullifier_hash);
            let interval = self.checkin_interval.read(nullifier_hash);

            // Must have missed at least one full interval plus the grace period
            assert(now >= last + interval + GRACE_PERIOD, Errors::INTERVAL_NOT_ELAPSED);

            let caller = get_caller_address();
            let current_missed = self.missed_checkins.read(nullifier_hash);
            let new_missed = current_missed + 1;
            self.missed_checkins.write(nullifier_hash, new_missed);

            // Advance last_checkin by one interval so the same window cannot be reported twice
            self.last_checkin.write(nullifier_hash, last + interval);

            self
                .emit(
                    MissedReported {
                        nullifier_hash,
                        missed_count: new_missed,
                        reporter: caller,
                        timestamp: now,
                    },
                );

            // If threshold reached, activate the linked vault
            let max = self.max_missed.read();
            if new_missed >= max {
                let vc_commitment = self.vault_commitment.read(nullifier_hash);

                self
                    .emit(
                        Activated {
                            nullifier_hash, vault_commitment: vc_commitment, timestamp: now,
                        },
                    );

                let vault_controller_addr = self.vault_controller.read();
                let vc = IVaultControllerDispatcher {
                    contract_address: vault_controller_addr,
                };
                vc.activate(vc_commitment);
            }
        }

        fn get_last_checkin(self: @ContractState, nullifier_hash: felt252) -> u64 {
            self.last_checkin.read(nullifier_hash)
        }

        fn get_missed_count(self: @ContractState, nullifier_hash: felt252) -> u32 {
            self.missed_checkins.read(nullifier_hash)
        }

        fn get_group_root(self: @ContractState) -> felt252 {
            self.group_root.read()
        }

        fn get_vault_commitment(self: @ContractState, nullifier_hash: felt252) -> felt252 {
            self.vault_commitment.read(nullifier_hash)
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        /// Recomputes the Merkle root after inserting a leaf at the given index.
        /// Walks up from the leaf, reading sibling nodes and writing parent hashes.
        fn _compute_root_after_insert(
            ref self: ContractState, index: u32, leaf: felt252,
        ) -> felt252 {
            let mut current = leaf;
            let mut idx = index;
            let depth = self.tree_depth.read();

            let mut level: u32 = 0;
            loop {
                if level >= depth {
                    break;
                }

                // Sibling is at the adjacent index at the same level
                let sibling_idx = if idx % 2 == 0 {
                    idx + 1
                } else {
                    idx - 1
                };
                let sibling = self.merkle_tree.read((level, sibling_idx));

                let (left, right) = if idx % 2 == 0 {
                    (current, sibling)
                } else {
                    (sibling, current)
                };

                current = poseidon_hash_span(array![left, right].span());
                let parent_idx = idx / 2;
                self.merkle_tree.write((level + 1, parent_idx), current);

                idx = parent_idx;
                level += 1;
            };

            current
        }
    }
}
