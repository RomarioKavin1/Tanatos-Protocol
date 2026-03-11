#[starknet::contract]
pub mod VaultController {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp, get_contract_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Map, StorageMapReadAccess,
        StorageMapWriteAccess,
    };
    use crate::errors::Errors;

    // Minimal ERC-20 interface for token transfers
    #[starknet::interface]
    trait IERC20<T> {
        fn transfer(ref self: T, recipient: ContractAddress, amount: u256) -> bool;
        fn transfer_from(
            ref self: T, sender: ContractAddress, recipient: ContractAddress, amount: u256,
        ) -> bool;
        fn balance_of(self: @T, account: ContractAddress) -> u256;
    }

    #[storage]
    struct Storage {
        // Per-vault token and balance
        vault_token: Map<felt252, ContractAddress>,
        vault_amount: Map<felt252, u256>,
        vault_activated: Map<felt252, bool>,
        vault_claimed: Map<felt252, bool>,
        vault_exists: Map<felt252, bool>,
        // Encrypted beneficiary data stored as a flat array:
        // (vault_commitment, index) -> felt252 chunk
        encrypted_beneficiary: Map<(felt252, u32), felt252>,
        encrypted_beneficiary_len: Map<felt252, u32>,
        // Access control
        liveness_registry: ContractAddress,
        owner: ContractAddress,
        // Fee configuration
        fee_bps: u16,
        fee_collector: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Deposited: Deposited,
        Activated: Activated,
        Claimed: Claimed,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Deposited {
        #[key]
        pub vault_commitment: felt252,
        pub token: ContractAddress,
        pub amount: u256,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Activated {
        #[key]
        pub vault_commitment: felt252,
        pub timestamp: u64,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Claimed {
        #[key]
        pub vault_commitment: felt252,
        pub recipient: ContractAddress,
        pub amount: u256,
        pub timestamp: u64,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState,
        liveness_registry: ContractAddress,
        owner: ContractAddress,
        fee_collector: ContractAddress,
    ) {
        self.liveness_registry.write(liveness_registry);
        self.owner.write(owner);
        self.fee_collector.write(fee_collector);
        self.fee_bps.write(10); // 0.1% protocol fee
    }

    #[abi(embed_v0)]
    impl VaultControllerImpl of crate::interfaces::IVaultController<ContractState> {
        fn deposit(
            ref self: ContractState,
            vault_commitment: felt252,
            encrypted_beneficiary: Array<felt252>,
            token: ContractAddress,
            amount: u256,
        ) {
            assert(!self.vault_exists.read(vault_commitment), 'Vault already exists');
            assert(amount > 0_u256, 'Amount must be > 0');

            let caller = get_caller_address();
            let contract = get_contract_address();

            // Calculate protocol fee and net amount
            let fee_bps: u256 = self.fee_bps.read().into();
            let fee = amount * fee_bps / 10000_u256;
            let net_amount = amount - fee;

            // Pull total amount from caller
            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer_from(caller, contract, amount);

            // Send fee to collector
            if fee > 0_u256 {
                let fee_col = self.fee_collector.read();
                let fee_token_dispatcher = IERC20Dispatcher { contract_address: token };
                fee_token_dispatcher.transfer(fee_col, fee);
            }

            // Persist vault state
            self.vault_token.write(vault_commitment, token);
            self.vault_amount.write(vault_commitment, net_amount);
            self.vault_exists.write(vault_commitment, true);
            self.vault_activated.write(vault_commitment, false);
            self.vault_claimed.write(vault_commitment, false);

            // Store encrypted beneficiary data as chunked felts
            let len = encrypted_beneficiary.len();
            self.encrypted_beneficiary_len.write(vault_commitment, len);
            let mut i: u32 = 0;
            loop {
                if i >= len {
                    break;
                }
                self
                    .encrypted_beneficiary
                    .write((vault_commitment, i), *encrypted_beneficiary.at(i));
                i += 1;
            };

            self
                .emit(
                    Deposited {
                        vault_commitment, token, amount: net_amount, timestamp: get_block_timestamp(),
                    },
                );
        }

        fn activate(ref self: ContractState, vault_commitment: felt252) {
            // Only the LivenessRegistry may activate vaults
            let caller = get_caller_address();
            let registry = self.liveness_registry.read();
            assert(caller == registry, Errors::NOT_AUTHORIZED);

            assert(self.vault_exists.read(vault_commitment), Errors::VAULT_NOT_FOUND);
            assert(!self.vault_activated.read(vault_commitment), Errors::ALREADY_ACTIVATED);

            self.vault_activated.write(vault_commitment, true);

            self.emit(Activated { vault_commitment, timestamp: get_block_timestamp() });
        }

        fn claim(
            ref self: ContractState,
            vault_commitment: felt252,
            claim_proof: Array<felt252>,
            recipient: ContractAddress,
        ) {
            assert(self.vault_exists.read(vault_commitment), Errors::VAULT_NOT_FOUND);
            assert(self.vault_activated.read(vault_commitment), Errors::NOT_ACTIVATED);
            assert(!self.vault_claimed.read(vault_commitment), Errors::ALREADY_CLAIMED);

            // In production: invoke Garaga verifier with claim_proof to prove knowledge
            // of the private key corresponding to the pubkey embedded in vault_commitment.
            // For MVP: require non-empty proof as a guard against accidental empty calls.
            assert(claim_proof.len() > 0, Errors::INVALID_CLAIM);

            let token = self.vault_token.read(vault_commitment);
            let amount = self.vault_amount.read(vault_commitment);

            // Update state before transfer (checks-effects-interactions)
            self.vault_claimed.write(vault_commitment, true);
            self.vault_amount.write(vault_commitment, 0_u256);

            let token_dispatcher = IERC20Dispatcher { contract_address: token };
            token_dispatcher.transfer(recipient, amount);

            self
                .emit(
                    Claimed {
                        vault_commitment, recipient, amount, timestamp: get_block_timestamp(),
                    },
                );
        }

        fn is_activated(self: @ContractState, vault_commitment: felt252) -> bool {
            self.vault_activated.read(vault_commitment)
        }

        fn is_claimed(self: @ContractState, vault_commitment: felt252) -> bool {
            self.vault_claimed.read(vault_commitment)
        }

        fn get_encrypted_beneficiary(
            self: @ContractState, vault_commitment: felt252,
        ) -> Array<felt252> {
            let len = self.encrypted_beneficiary_len.read(vault_commitment);
            let mut result: Array<felt252> = array![];
            let mut i: u32 = 0;
            loop {
                if i >= len {
                    break;
                }
                result.append(self.encrypted_beneficiary.read((vault_commitment, i)));
                i += 1;
            };
            result
        }

        /// One-time initializer: set the LivenessRegistry address after it has been deployed.
        /// Can only be called by the owner, and only when the registry has not yet been set
        /// (i.e. still at the zero address from construction). This solves the circular
        /// deployment dependency: VaultController → LivenessRegistry → VaultController.
        fn set_registry(ref self: ContractState, registry: ContractAddress) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), Errors::NOT_AUTHORIZED);

            // Ensure this is a one-time operation — prevent owner from later redirecting
            // activate() calls to a malicious registry.
            let zero: ContractAddress = 0.try_into().unwrap();
            assert(self.liveness_registry.read() == zero, 'Registry already set');

            self.liveness_registry.write(registry);
        }

        fn get_registry(self: @ContractState) -> ContractAddress {
            self.liveness_registry.read()
        }
    }
}
