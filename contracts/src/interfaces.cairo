use starknet::ContractAddress;

/// Interface for the LivenessRegistry contract.
/// Handles Semaphore group membership and periodic check-in proofs.
#[starknet::interface]
pub trait ILivenessRegistry<TContractState> {
    /// Register a new identity in the Semaphore group and link it to a vault.
    fn register(
        ref self: TContractState,
        identity_commitment: felt252,
        vault_commitment: felt252,
        interval_seconds: u64,
        nullifier_hash: felt252,
    );

    /// Submit a ZK proof to prove liveness and reset the missed-check-in counter.
    fn checkin(
        ref self: TContractState,
        proof: Array<felt252>,
        nullifier_hash: felt252,
        signal_hash: felt252,
        root: felt252,
        epoch: felt252,
    );

    /// Anyone can call this after interval + grace period passes without a check-in.
    /// Increments missed count; at threshold, activates the linked vault.
    fn report_missed(ref self: TContractState, nullifier_hash: felt252);

    /// Returns the timestamp of the last successful check-in for a nullifier.
    fn get_last_checkin(self: @TContractState, nullifier_hash: felt252) -> u64;

    /// Returns the number of consecutive missed check-ins.
    fn get_missed_count(self: @TContractState, nullifier_hash: felt252) -> u32;

    /// Returns the current Semaphore group Merkle root.
    fn get_group_root(self: @TContractState) -> felt252;

    /// Returns the vault commitment linked to a given nullifier hash.
    fn get_vault_commitment(self: @TContractState, nullifier_hash: felt252) -> felt252;
}

/// Interface for the VaultController contract.
/// Manages ERC-20 deposits that can be claimed by beneficiaries after activation.
#[starknet::interface]
pub trait IVaultController<TContractState> {
    /// Deposit tokens and store encrypted beneficiary data.
    fn deposit(
        ref self: TContractState,
        vault_commitment: felt252,
        encrypted_beneficiary: Array<felt252>,
        token: ContractAddress,
        amount: u256,
    );

    /// Activate a vault (only callable by LivenessRegistry after threshold missed).
    fn activate(ref self: TContractState, vault_commitment: felt252);

    /// Claim vault funds by proving beneficiary identity.
    fn claim(
        ref self: TContractState,
        vault_commitment: felt252,
        claim_proof: Array<felt252>,
        recipient: ContractAddress,
    );

    /// Returns true if the vault has been activated.
    fn is_activated(self: @TContractState, vault_commitment: felt252) -> bool;

    /// Returns true if the vault funds have been claimed.
    fn is_claimed(self: @TContractState, vault_commitment: felt252) -> bool;

    /// Returns the encrypted beneficiary data array stored at deposit time.
    fn get_encrypted_beneficiary(
        self: @TContractState, vault_commitment: felt252
    ) -> Array<felt252>;

    /// One-time initializer: set the LivenessRegistry address after deployment.
    /// Can only be called by the owner when liveness_registry is not yet set.
    fn set_registry(ref self: TContractState, registry: ContractAddress);

    /// Returns the configured LivenessRegistry address.
    fn get_registry(self: @TContractState) -> ContractAddress;
}

/// Interface for the KeeperRegistry contract.
/// Manages keeper staking for the automated missed-checkin reporting network.
#[starknet::interface]
pub trait IKeeperRegistry<TContractState> {
    /// Stake STRK tokens to become a keeper.
    fn stake(ref self: TContractState, amount: u256);

    /// Unstake previously staked STRK tokens.
    fn unstake(ref self: TContractState, amount: u256);

    /// Returns the staked amount for a given keeper address.
    fn get_stake(self: @TContractState, keeper: ContractAddress) -> u256;

    /// Returns true if the keeper has at least the minimum stake.
    fn is_active_keeper(self: @TContractState, keeper: ContractAddress) -> bool;
}
