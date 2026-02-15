#[starknet::contract]
pub mod LivenessRegistry {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Map, StorageMapReadAccess,
        StorageMapWriteAccess,
    };
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
        // Semaphore group state — root is BN254 Poseidon2, computed off-chain
        group_root: felt252,
        // Leaves of the Merkle tree: index -> identity_commitment
        leaves: Map<u32, felt252>,
        member_count: u32,
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
        // Root starts at 0 (empty tree — no members registered yet)
        self.group_root.write(0);
    }

    #[abi(embed_v0)]
    impl LivenessRegistryImpl of crate::interfaces::ILivenessRegistry<ContractState> {
        fn register(
            ref self: ContractState,
            identity_commitment: felt252,
            new_root: felt252,
            vault_commitment: felt252,
            interval_seconds: u64,
            nullifier_hash: felt252,
        ) {
            assert(!self.registered.read(nullifier_hash), Errors::ALREADY_REGISTERED);
            assert(interval_seconds >= MIN_INTERVAL, Errors::INVALID_INTERVAL);

            let now = get_block_timestamp();
            let index = self.member_count.read();

            // Store the leaf (identity commitment) for off-chain tree reconstruction
            self.leaves.write(index, identity_commitment);
            self.member_count.write(index + 1);

            // Accept the new root from the client (computed off-chain with BN254 Poseidon2)
            // In production with Garaga: verify a Merkle insertion proof before accepting
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
            assert(
                !self.used_epoch_nullifiers.read((nullifier_hash, epoch)), Errors::NULLIFIER_USED,
            );

            // Verify submitted root matches on-chain group root.
            // When Garaga verifier is deployed (pending bb 0.82.x → garaga 1.0.x VK format fix),
            // this block will be replaced by:
            //   let verifier = IGaragaUltraHonkVerifierDispatcher {
            //       contract_address: self.garaga_verifier.read()
            //   };
            //   verifier.verify_ultra_keccak_zk_honk_proof(proof.span());
            let current_root = self.group_root.read();
            assert(root == current_root, Errors::INVALID_PROOF);

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

            assert(now >= last + interval + GRACE_PERIOD, Errors::INTERVAL_NOT_ELAPSED);

            let caller = get_caller_address();
            let current_missed = self.missed_checkins.read(nullifier_hash);
            let new_missed = current_missed + 1;
            self.missed_checkins.write(nullifier_hash, new_missed);
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

        fn get_checkin_interval(self: @ContractState, nullifier_hash: felt252) -> u64 {
            self.checkin_interval.read(nullifier_hash)
        }

        fn get_leaf(self: @ContractState, index: u32) -> felt252 {
            self.leaves.read(index)
        }

        fn get_member_count(self: @ContractState) -> u32 {
            self.member_count.read()
        }
    }
}
