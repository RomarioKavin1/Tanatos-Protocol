pub mod Errors {
    pub const ALREADY_REGISTERED: felt252 = 'Already registered';
    pub const NOT_REGISTERED: felt252 = 'Not registered';
    pub const INVALID_PROOF: felt252 = 'Invalid proof';
    pub const INTERVAL_NOT_ELAPSED: felt252 = 'Interval not elapsed';
    pub const NOT_AUTHORIZED: felt252 = 'Not authorized';
    pub const ALREADY_ACTIVATED: felt252 = 'Already activated';
    pub const NOT_ACTIVATED: felt252 = 'Not activated';
    pub const VAULT_NOT_FOUND: felt252 = 'Vault not found';
    pub const INVALID_CLAIM: felt252 = 'Invalid claim proof';
    pub const INSUFFICIENT_STAKE: felt252 = 'Insufficient stake';
    pub const ALREADY_CLAIMED: felt252 = 'Already claimed';
    pub const INVALID_INTERVAL: felt252 = 'Invalid interval';
    pub const NULLIFIER_USED: felt252 = 'Nullifier already used';
}
