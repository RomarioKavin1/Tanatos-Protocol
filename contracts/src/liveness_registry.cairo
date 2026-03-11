#[starknet::contract]
pub mod LivenessRegistry {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Map, StorageMapReadAccess,
        StorageMapWriteAccess,
    };
    use crate::errors::Errors;
    use crate::interfaces::{IVaultControllerDispatcher, IVaultControllerDispatcherTrait};

    // Garaga UltraKeccakZKHonk verifier interface
    #[starknet::interface]
    trait IGaragaUltraHonkVerifier<T> {
        fn verify_ultra_keccak_zk_honk_proof(
            self: @T, full_proof_with_hints: Span<felt252>,
        ) -> Result<Span<u256>, felt252>;
    }

    const GRACE_PERIOD: u64 = 86400;
    const MIN_INTERVAL: u64 = 86400;
    const DEFAULT_MAX_MISSED: u32 = 3;

    #[storage]
    struct Storage {
        // Semaphore group state
        group_root: felt252,
        leaves: Map<u32, felt252>,
        member_count: u32,
        tree_depth: u32,
        // Per-identity state — keyed by identity_commitment (always felt252-safe)
        last_checkin: Map<felt252, u64>,
        checkin_interval: Map<felt252, u64>,
        missed_checkins: Map<felt252, u32>,
        vault_commitment: Map<felt252, felt252>,
        registered: Map<felt252, bool>,
        // Anti-replay: (identity_commitment, epoch) -> used
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
        pub identity_commitment: felt252,
        pub vault_commitment: felt252,
        pub interval_seconds: u64,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct CheckedIn {
        #[key]
        pub identity_commitment: felt252,
        pub epoch: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct MissedReported {
        #[key]
        pub identity_commitment: felt252,
        pub missed_count: u32,
        pub reporter: ContractAddress,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Activated {
        #[key]
        pub identity_commitment: felt252,
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
        ) {
            assert(!self.registered.read(identity_commitment), Errors::ALREADY_REGISTERED);
            assert(interval_seconds >= MIN_INTERVAL, Errors::INVALID_INTERVAL);

            let now = get_block_timestamp();
            let index = self.member_count.read();

            self.leaves.write(index, identity_commitment);
            self.member_count.write(index + 1);
            self.group_root.write(new_root);

            self.registered.write(identity_commitment, true);
            self.vault_commitment.write(identity_commitment, vault_commitment);
            self.checkin_interval.write(identity_commitment, interval_seconds);
            self.last_checkin.write(identity_commitment, now);
            self.missed_checkins.write(identity_commitment, 0);

            self.emit(
                Registered { identity_commitment, vault_commitment, interval_seconds, timestamp: now },
            );
        }

        fn checkin(
            ref self: ContractState,
            proof: Array<felt252>,
            identity_commitment: felt252,
            nullifier_hash_low: felt252,
            nullifier_hash_high: felt252,
            signal_hash_low: felt252,
            signal_hash_high: felt252,
            root: felt252,
            epoch: felt252,
        ) {
            assert(self.registered.read(identity_commitment), Errors::NOT_REGISTERED);
            assert(
                !self.used_epoch_nullifiers.read((identity_commitment, epoch)),
                Errors::NULLIFIER_USED,
            );

            // Reconstruct u256 from split (low, high) felt252 pairs.
            // BN254 values exceed felt252 max, so they are passed split.
            // low <= u128::MAX (fits), high <= 64 (fits) — both safe to cast.
            let nh_low: u128 = nullifier_hash_low.try_into().expect('nh_low overflow');
            let nh_high: u128 = nullifier_hash_high.try_into().expect('nh_high overflow');
            let nh_u256 = u256 { low: nh_low, high: nh_high };

            let sh_low: u128 = signal_hash_low.try_into().expect('sh_low overflow');
            let sh_high: u128 = signal_hash_high.try_into().expect('sh_high overflow');
            let sh_u256 = u256 { low: sh_low, high: sh_high };

            let verifier_addr = self.garaga_verifier.read();
            let zero: ContractAddress = 0.try_into().unwrap();
            if verifier_addr != zero {
                let verifier = IGaragaUltraHonkVerifierDispatcher {
                    contract_address: verifier_addr,
                };
                let pub_inputs = verifier
                    .verify_ultra_keccak_zk_honk_proof(proof.span())
                    .expect(Errors::INVALID_PROOF);

                let current_root = self.group_root.read();
                let root_u256: u256 = root.into();
                let ep_u256: u256 = epoch.into();
                let current_root_u256: u256 = current_root.into();

                assert(*pub_inputs.at(0) == root_u256, Errors::INVALID_PROOF);
                assert(*pub_inputs.at(1) == nh_u256, Errors::INVALID_PROOF);
                assert(*pub_inputs.at(2) == sh_u256, Errors::INVALID_PROOF);
                assert(*pub_inputs.at(3) == ep_u256, Errors::INVALID_PROOF);
                assert(root_u256 == current_root_u256, Errors::INVALID_PROOF);
            } else {
                // Fallback: verifier not set — check root only (dev mode)
                let current_root = self.group_root.read();
                assert(root == current_root, Errors::INVALID_PROOF);
            }

            self.used_epoch_nullifiers.write((identity_commitment, epoch), true);

            let now = get_block_timestamp();
            self.last_checkin.write(identity_commitment, now);
            self.missed_checkins.write(identity_commitment, 0);

            self.emit(CheckedIn { identity_commitment, epoch, timestamp: now });
        }

        fn report_missed(ref self: ContractState, identity_commitment: felt252) {
            assert(self.registered.read(identity_commitment), Errors::NOT_REGISTERED);

            let now = get_block_timestamp();
            let last = self.last_checkin.read(identity_commitment);
            let interval = self.checkin_interval.read(identity_commitment);

            assert(now >= last + interval + GRACE_PERIOD, Errors::INTERVAL_NOT_ELAPSED);

            let caller = get_caller_address();
            let current_missed = self.missed_checkins.read(identity_commitment);
            let new_missed = current_missed + 1;
            self.missed_checkins.write(identity_commitment, new_missed);
            self.last_checkin.write(identity_commitment, last + interval);

            self.emit(
                MissedReported {
                    identity_commitment,
                    missed_count: new_missed,
                    reporter: caller,
                    timestamp: now,
                },
            );

            let max = self.max_missed.read();
            if new_missed >= max {
                let vc = self.vault_commitment.read(identity_commitment);
                self.emit(Activated { identity_commitment, vault_commitment: vc, timestamp: now });
                let vault_controller_addr = self.vault_controller.read();
                let vault_controller = IVaultControllerDispatcher {
                    contract_address: vault_controller_addr,
                };
                vault_controller.activate(vc);
            }
        }

        fn get_last_checkin(self: @ContractState, identity_commitment: felt252) -> u64 {
            self.last_checkin.read(identity_commitment)
        }

        fn get_missed_count(self: @ContractState, identity_commitment: felt252) -> u32 {
            self.missed_checkins.read(identity_commitment)
        }

        fn get_group_root(self: @ContractState) -> felt252 {
            self.group_root.read()
        }

        fn get_vault_commitment(self: @ContractState, identity_commitment: felt252) -> felt252 {
            self.vault_commitment.read(identity_commitment)
        }

        fn get_checkin_interval(self: @ContractState, identity_commitment: felt252) -> u64 {
            self.checkin_interval.read(identity_commitment)
        }

        fn get_leaf(self: @ContractState, index: u32) -> felt252 {
            self.leaves.read(index)
        }

        fn get_member_count(self: @ContractState) -> u32 {
            self.member_count.read()
        }
    }
}
