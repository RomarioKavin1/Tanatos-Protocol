use core::poseidon::poseidon_hash_span;

/// Computes the Merkle root given a leaf, its sibling path, and directional indices.
/// indices[i] == 0 means the current node is a left child (sibling is on the right).
/// indices[i] == 1 means the current node is a right child (sibling is on the left).
pub fn compute_merkle_root(
    leaf: felt252,
    path: Span<felt252>,
    indices: Span<u8>,
) -> felt252 {
    let mut current = leaf;
    let len = path.len();
    let mut i: u32 = 0;
    loop {
        if i >= len {
            break;
        }
        let sibling = *path.at(i);
        let index = *indices.at(i);
        let (left, right) = if index == 0 {
            (current, sibling)
        } else {
            (sibling, current)
        };
        current = poseidon_hash_span(array![left, right].span());
        i += 1;
    };
    current
}

/// Hashes two field elements as a Merkle node pair.
pub fn hash_pair(a: felt252, b: felt252) -> felt252 {
    poseidon_hash_span(array![a, b].span())
}

/// Hashes an identity commitment from its secret and nullifier components.
pub fn hash_leaf(identity_secret: felt252, identity_nullifier: felt252) -> felt252 {
    poseidon_hash_span(array![identity_secret, identity_nullifier].span())
}
