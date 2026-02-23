use starknet::ContractAddress;
use starknet::testing::{set_caller_address, set_block_timestamp};
use core::poseidon::poseidon_hash_span;
use snforge_std::{
    declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address,
    stop_cheat_caller_address, start_cheat_block_timestamp, stop_cheat_block_timestamp,
    spy_events, EventSpyAssertionsTrait,
};
use thanatos_protocol::interfaces::{
    ILivenessRegistryDispatcher, ILivenessRegistryDispatcherTrait,
};
use thanatos_protocol::liveness_registry::LivenessRegistry;

fn setup_registry() -> (ILivenessRegistryDispatcher, ContractAddress) {
    let vault_controller: ContractAddress = 0x123.try_into().unwrap();
    let garaga_verifier: ContractAddress = 0x456.try_into().unwrap();
    let owner: ContractAddress = 0x789.try_into().unwrap();

    let contract_class = declare("LivenessRegistry").unwrap().contract_class();

    let mut calldata: Array<felt252> = array![
        vault_controller.into(), garaga_verifier.into(), owner.into(),
    ];

    let (address, _) = contract_class.deploy(@calldata).unwrap();
    (ILivenessRegistryDispatcher { contract_address: address }, address)
}

fn make_nullifier(secret: felt252, nullifier: felt252, epoch: felt252) -> felt252 {
    poseidon_hash_span(array![nullifier, epoch].span())
}

#[test]
fn test_register_stores_state() {
    let (registry, _address) = setup_registry();

    start_cheat_block_timestamp(_address, 1_000_000_u64);

    let identity_commitment = poseidon_hash_span(array![123, 456].span());
    let vault_commitment = poseidon_hash_span(array![789, 101112].span());
    let nullifier_hash = make_nullifier(123, 456, 1);
    let interval: u64 = 2_592_000; // 30 days

    registry.register(identity_commitment, vault_commitment, interval, nullifier_hash);

    assert(
        registry.get_last_checkin(nullifier_hash) == 1_000_000_u64, 'Wrong last_checkin timestamp',
    );
    assert(registry.get_missed_count(nullifier_hash) == 0, 'Wrong initial missed count');
    assert(
        registry.get_vault_commitment(nullifier_hash) == vault_commitment, 'Wrong vault commitment',
    );

    stop_cheat_block_timestamp(_address);
}

#[test]
#[should_panic(expected: 'Already registered')]
fn test_double_register_reverts() {
    let (registry, _address) = setup_registry();

    start_cheat_block_timestamp(_address, 1_000_000_u64);

    let identity_commitment = poseidon_hash_span(array![123, 456].span());
    let vault_commitment = poseidon_hash_span(array![789, 101112].span());
    let nullifier_hash = make_nullifier(123, 456, 1);
    let interval: u64 = 2_592_000;

    registry.register(identity_commitment, vault_commitment, interval, nullifier_hash);
    // Second call with same nullifier_hash should panic
    registry.register(identity_commitment, vault_commitment, interval, nullifier_hash);

    stop_cheat_block_timestamp(_address);
}

#[test]
#[should_panic(expected: 'Invalid interval')]
fn test_register_with_short_interval_reverts() {
    let (registry, _address) = setup_registry();

    start_cheat_block_timestamp(_address, 1_000_000_u64);

    let identity_commitment = poseidon_hash_span(array![123, 456].span());
    let vault_commitment = poseidon_hash_span(array![789, 101112].span());
    let nullifier_hash = make_nullifier(123, 456, 1);
    let too_short: u64 = 3600; // 1 hour - below MIN_INTERVAL

    registry.register(identity_commitment, vault_commitment, too_short, nullifier_hash);

    stop_cheat_block_timestamp(_address);
}

#[test]
fn test_report_missed_increments_count() {
    let (registry, address) = setup_registry();

    start_cheat_block_timestamp(address, 1_000_000_u64);

    let identity_commitment = poseidon_hash_span(array![123, 456].span());
    let vault_commitment = poseidon_hash_span(array![789, 101112].span());
    let nullifier_hash = make_nullifier(123, 456, 1);
    let interval: u64 = 86_400; // 1 day

    registry.register(identity_commitment, vault_commitment, interval, nullifier_hash);

    stop_cheat_block_timestamp(address);

    // Advance time: interval (86400) + grace period (86400) + 1 second
    start_cheat_block_timestamp(address, 1_000_000_u64 + 86_400 + 86_400 + 1);

    registry.report_missed(nullifier_hash);
    assert(registry.get_missed_count(nullifier_hash) == 1, 'Should be 1 missed');

    stop_cheat_block_timestamp(address);
}

#[test]
#[should_panic(expected: 'Interval not elapsed')]
fn test_report_missed_too_early_reverts() {
    let (registry, address) = setup_registry();

    start_cheat_block_timestamp(address, 1_000_000_u64);

    let identity_commitment = poseidon_hash_span(array![123, 456].span());
    let vault_commitment = poseidon_hash_span(array![789, 101112].span());
    let nullifier_hash = make_nullifier(123, 456, 1);
    let interval: u64 = 86_400;

    registry.register(identity_commitment, vault_commitment, interval, nullifier_hash);

    stop_cheat_block_timestamp(address);

    // Advance time only by interval - 1: not enough
    start_cheat_block_timestamp(address, 1_000_000_u64 + 86_400 - 1);

    registry.report_missed(nullifier_hash);

    stop_cheat_block_timestamp(address);
}

#[test]
fn test_get_group_root_nonzero_after_register() {
    let (registry, address) = setup_registry();

    start_cheat_block_timestamp(address, 1_000_000_u64);

    let identity_commitment = poseidon_hash_span(array![42, 43].span());
    let vault_commitment = poseidon_hash_span(array![44, 45].span());
    let nullifier_hash = make_nullifier(42, 43, 1);
    let interval: u64 = 86_400;

    let root_before = registry.get_group_root();
    registry.register(identity_commitment, vault_commitment, interval, nullifier_hash);
    let root_after = registry.get_group_root();

    // Root must change after insertion
    assert(root_before != root_after, 'Root should change after insert');

    stop_cheat_block_timestamp(address);
}
