/**
 * BN254 Poseidon2 Merkle tree utilities.
 *
 * Matches the Noir liveness circuit exactly:
 *   - Depth 20
 *   - Empty leaf = 0n
 *   - hash_pair(left, right) = Poseidon2([left, right])
 *
 * Uses sparse tree optimisation: precompute the 20 "empty subtree" hashes
 * (hash of an all-zero subtree at each depth level), then only hash the
 * O(depth) nodes that are actually on the path. Reduces cost from O(2^depth)
 * to O(depth) — i.e. 40 hashes instead of 2 million.
 */

import { poseidon2Hash, fitsInFelt252 } from "./identity";

export const TREE_DEPTH = 20;
export const EMPTY_LEAF = 0n;

/**
 * Precompute empty subtree hashes for all depths.
 *   emptyHashes[0] = 0n                          (empty leaf)
 *   emptyHashes[1] = Poseidon2([0, 0])           (parent of two empty leaves)
 *   emptyHashes[d] = Poseidon2([emptyHashes[d-1], emptyHashes[d-1]])
 */
async function buildEmptyHashes(depth: number): Promise<bigint[]> {
  const emptyHashes: bigint[] = [EMPTY_LEAF];
  for (let d = 0; d < depth; d++) {
    const h = await poseidon2Hash([emptyHashes[d], emptyHashes[d]]);
    emptyHashes.push(h);
  }
  return emptyHashes;
}

/**
 * Compute the Merkle path (siblings + indices) for a leaf at the given index.
 * Returns the data needed by the Noir circuit:
 *   - path: sibling hashes at each level
 *   - indices: 0 = current is left child, 1 = current is right child
 *   - root: the Merkle root
 *
 * Sparse tree: O(depth) hashes, not O(2^depth).
 */
export async function computeMerklePath(
  leaves: bigint[],
  leafIndex: number,
  depth: number = TREE_DEPTH
): Promise<{ path: bigint[]; indices: number[]; root: bigint }> {
  // Precompute empty subtree hashes: 20 async calls
  const emptyHashes = await buildEmptyHashes(depth);

  // Build a map of non-empty nodes at the leaf level only.
  // Key: leaf index, Value: leaf hash.
  let levelMap = new Map<number, bigint>();
  for (let i = 0; i < leaves.length; i++) {
    if (leaves[i] !== EMPTY_LEAF) {
      levelMap.set(i, leaves[i]);
    }
  }

  const path: bigint[] = [];
  const indices: number[] = [];
  let idx = leafIndex;

  for (let level = 0; level < depth; level++) {
    const isRight = idx % 2 === 1;
    const siblingIdx = isRight ? idx - 1 : idx + 1;

    // Sibling: use actual value if non-empty, else empty subtree hash at this depth
    const sibling = levelMap.get(siblingIdx) ?? emptyHashes[level];

    indices.push(isRight ? 1 : 0);
    path.push(sibling);

    // Compute the next level map (only nodes that have at least one non-empty child)
    const nextLevelMap = new Map<number, bigint>();
    const processedParents = new Set<number>();

    for (const [nodeIdx] of levelMap) {
      const parentIdx = Math.floor(nodeIdx / 2);
      if (processedParents.has(parentIdx)) continue;
      processedParents.add(parentIdx);

      const leftIdx = parentIdx * 2;
      const rightIdx = leftIdx + 1;
      const left = levelMap.get(leftIdx) ?? emptyHashes[level];
      const right = levelMap.get(rightIdx) ?? emptyHashes[level];
      nextLevelMap.set(parentIdx, await poseidon2Hash([left, right]));
    }

    levelMap = nextLevelMap;
    idx = Math.floor(idx / 2);
  }

  // Root is the only remaining node (or the empty root if all leaves were empty)
  const root = levelMap.get(0) ?? emptyHashes[depth];
  return { path, indices, root };
}

/**
 * Compute just the Merkle root (no path). Also O(depth) for sparse trees.
 */
export async function computeMerkleRoot(
  leaves: bigint[],
  depth: number = TREE_DEPTH
): Promise<bigint> {
  const { root } = await computeMerklePath(leaves, 0, depth);
  return root;
}

/**
 * Validate that the computed root fits in felt252 (Starknet storage).
 */
export async function computeValidatedMerkleRoot(
  leaves: bigint[]
): Promise<bigint> {
  const root = await computeMerkleRoot(leaves);
  if (!fitsInFelt252(root)) {
    throw new Error(
      "Merkle root overflows felt252. This is rare (~16.7% probability). " +
        "Re-register with a different identity."
    );
  }
  return root;
}
