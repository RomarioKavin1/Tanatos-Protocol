#[starknet::contract]
pub mod KeeperRegistry {
    use starknet::{ContractAddress, get_caller_address, get_contract_address};
    use starknet::storage::{
        StoragePointerReadAccess, StoragePointerWriteAccess, Map, StorageMapReadAccess,
        StorageMapWriteAccess,
    };
    use crate::errors::Errors;

    // 100 STRK minimum stake (18 decimals)
    const MIN_STAKE: u256 = 100_000_000_000_000_000_000_u256;

    // Minimal ERC-20 interface for STRK staking operations
    #[starknet::interface]
    trait IERC20<T> {
        fn transfer(ref self: T, recipient: ContractAddress, amount: u256) -> bool;
        fn transfer_from(
            ref self: T, sender: ContractAddress, recipient: ContractAddress, amount: u256,
        ) -> bool;
    }

    #[storage]
    struct Storage {
        stakes: Map<ContractAddress, u256>,
        strk_token: ContractAddress,
        owner: ContractAddress,
        total_staked: u256,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    pub enum Event {
        Staked: Staked,
        Unstaked: Unstaked,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Staked {
        #[key]
        pub keeper: ContractAddress,
        pub amount: u256,
        pub total: u256,
    }

    #[derive(Drop, starknet::Event)]
    pub struct Unstaked {
        #[key]
        pub keeper: ContractAddress,
        pub amount: u256,
        pub remaining: u256,
    }

    #[constructor]
    fn constructor(
        ref self: ContractState, strk_token: ContractAddress, owner: ContractAddress,
    ) {
        self.strk_token.write(strk_token);
        self.owner.write(owner);
        self.total_staked.write(0_u256);
    }

    #[abi(embed_v0)]
    impl KeeperRegistryImpl of crate::interfaces::IKeeperRegistry<ContractState> {
        fn stake(ref self: ContractState, amount: u256) {
            assert(amount >= MIN_STAKE, Errors::INSUFFICIENT_STAKE);

            let caller = get_caller_address();
            let contract = get_contract_address();

            let strk_addr = self.strk_token.read();
            let token = IERC20Dispatcher { contract_address: strk_addr };
            token.transfer_from(caller, contract, amount);

            let current = self.stakes.read(caller);
            let new_total = current + amount;
            self.stakes.write(caller, new_total);
            self.total_staked.write(self.total_staked.read() + amount);

            self.emit(Staked { keeper: caller, amount, total: new_total });
        }

        fn unstake(ref self: ContractState, amount: u256) {
            let caller = get_caller_address();
            let current = self.stakes.read(caller);
            assert(amount <= current, 'Insufficient stake balance');

            let remaining = current - amount;
            self.stakes.write(caller, remaining);
            self.total_staked.write(self.total_staked.read() - amount);

            let strk_addr = self.strk_token.read();
            let token = IERC20Dispatcher { contract_address: strk_addr };
            token.transfer(caller, amount);

            self.emit(Unstaked { keeper: caller, amount, remaining });
        }

        fn get_stake(self: @ContractState, keeper: ContractAddress) -> u256 {
            self.stakes.read(keeper)
        }

        fn is_active_keeper(self: @ContractState, keeper: ContractAddress) -> bool {
            self.stakes.read(keeper) >= MIN_STAKE
        }
    }
}
