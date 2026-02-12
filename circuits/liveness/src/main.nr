use std::hash::poseidon2;

// Thanatos Protocol - Liveness Proof Circuit
//
// Proves that the prover:
//   1. Knows an identity (secret, nullifier) whose commitment is a leaf in the Semaphore tree
//   2. Has derived the correct epoch nullifier (prevents replay across epochs)
//   3. Has committed to a signal (the epoch itself)
//
// Private inputs:
//   identity_secret    - random secret known only to the owner
//   identity_nullifier - random nullifier known only to the owner
//   merkle_path        - sibling hashes along the Merkle path (depth 20)
//   merkle_indices     - 0 = current node is left child, 1 = right child
//
// Public inputs:
//   root           - Semaphore group Merkle root (stored on-chain)
//   nullifier_hash - H(identity_nullifier, epoch) - prevents double check-in per epoch
//   signal_hash    - H(epoch) - binds proof to a specific epoch
//   epoch          - current epoch number (block_timestamp / interval)

fn hash_pair(left: Field, right: Field) -> Field {
    poseidon2::Poseidon2::hash([left, right], 2)
}

fn main(
    // Private
    identity_secret: Field,
    identity_nullifier: Field,
    merkle_path: [Field; 20],
    merkle_indices: [u1; 20],
    // Public
    root: pub Field,
    nullifier_hash: pub Field,
    signal_hash: pub Field,
    epoch: pub Field,
) {
    // Step 1: Derive identity commitment from secret and nullifier
    let identity_commitment = poseidon2::Poseidon2::hash([identity_secret, identity_nullifier], 2);

    // Step 2: Verify Merkle membership proof
    // Walk from leaf up to root, hashing with siblings at each level
    let mut current = identity_commitment;
    for i in 0..20 {
        let sibling = merkle_path[i];
        let idx: u1 = merkle_indices[i];
        // If idx == 0, current node is left child; if idx == 1, current is right child
        let (left, right): (Field, Field) = if idx == 0 {
            (current, sibling)
        } else {
            (sibling, current)
        };
        current = hash_pair(left, right);
    }
    assert(current == root, "Merkle proof verification failed: computed root does not match");

    // Step 3: Derive epoch nullifier - binds this proof to one epoch, preventing replay
    let computed_nullifier = poseidon2::Poseidon2::hash([identity_nullifier, epoch], 2);
    assert(
        computed_nullifier == nullifier_hash,
        "Nullifier mismatch: invalid identity_nullifier or epoch"
    );

    // Step 4: Verify signal hash - proves commitment to the epoch signal
    let computed_signal = poseidon2::Poseidon2::hash([epoch], 1);
    assert(computed_signal == signal_hash, "Signal hash mismatch: invalid epoch signal");
}
