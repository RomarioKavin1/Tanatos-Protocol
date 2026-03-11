use starknet::ContractAddress;

/// Interface for the LivenessRegistry contract.
/// Handles Semaphore group membership and periodic check-in proofs.
///
/// Storage is keyed by identity_commitment (felt252, always Stark-field-safe).
/// BN254 Poseidon2 values (nullifier_hash, signal_hash) that may exceed the
/// Stark prime are passed as split (low: u128, high: u128) felt252 pairs and
/// reconstructed as u256 for comparison with the Garaga verifier output.
#[starknet::interface]
pub trait ILivenessRegistry<TContractState> {
    /// Register a new identity in the Semaphore group and link it to a vault.
    fn register(
        ref self: TContractState,
        identity_commitment: felt252,
        new_root: felt252,
        vault_commitment: felt252,
        interval_seconds: u64,
    );

    /// Submit a ZK proof to prove liveness and reset the missed-check-in counter.
    /// nullifier_hash and signal_hash are BN254 values passed as (low, high) u128 pairs.
    fn checkin(
        ref self: TContractState,
        proof: Array<felt252>,
        identity_commitment: felt252,
        nullifier_hash_low: felt252,
        nullifier_hash_high: felt252,
        signal_hash_low: felt252,
        signal_hash_high: felt252,
        root: felt252,
        epoch: felt252,
    );

    /// Anyone can call this after interval + grace period passes without a check-in.
    fn report_missed(ref self: TContractState, identity_commitment: felt252);

    /// Returns the timestamp of the last successful check-in.
    fn get_last_checkin(self: @TContractState, identity_commitment: felt252) -> u64;

    /// Returns the number of consecutive missed check-ins.
    fn get_missed_count(self: @TContractState, identity_commitment: felt252) -> u32;

    /// Returns the current Semaphore group Merkle root (BN254 Poseidon2).
    fn get_group_root(self: @TContractState) -> felt252;

    /// Returns the vault commitment linked to a given identity commitment.
    fn get_vault_commitment(self: @TContractState, identity_commitment: felt252) -> felt252;

    /// Returns the check-in interval (seconds) for a given identity commitment.
    fn get_checkin_interval(self: @TContractState, identity_commitment: felt252) -> u64;

    /// Returns the identity commitment (leaf value) at the given tree index.
    fn get_leaf(self: @TContractState, index: u32) -> felt252;

    /// Returns the number of registered members (number of leaves in the tree).
    fn get_member_count(self: @TContractState) -> u32;
}

/// Interface for the VaultController contract.
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

    /// Claim vault funds by proving knowledge of the vault preimage.
    /// claim_proof = [salt] where vault_commitment = poseidon_hash_span([recipient_as_felt252, salt])
    fn claim(
        ref self: TContractState,
        vault_commitment: felt252,
        claim_proof: Array<felt252>,
        recipient: ContractAddress,
    );

    fn is_activated(self: @TContractState, vault_commitment: felt252) -> bool;
    fn is_claimed(self: @TContractState, vault_commitment: felt252) -> bool;

    fn get_encrypted_beneficiary(
        self: @TContractState, vault_commitment: felt252
    ) -> Array<felt252>;

    fn set_registry(ref self: TContractState, registry: ContractAddress);
    fn get_registry(self: @TContractState) -> ContractAddress;
}

/// Interface for the KeeperRegistry contract.
#[starknet::interface]
pub trait IKeeperRegistry<TContractState> {
    fn stake(ref self: TContractState, amount: u256);
    fn unstake(ref self: TContractState, amount: u256);
    fn get_stake(self: @TContractState, keeper: ContractAddress) -> u256;
    fn is_active_keeper(self: @TContractState, keeper: ContractAddress) -> bool;
}
