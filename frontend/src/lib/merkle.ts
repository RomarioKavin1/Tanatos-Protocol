/**
 * BN254 Poseidon2 Merkle tree utilities.
 *
 * Matches the Noir liveness circuit exactly:
 *   - Depth 20
 *   - Empty leaf = 0n
 *   - hash_pair(left, right) = Poseidon2([left, right])
 *   - All-zero siblings for an empty tree
 */

import { poseidon2Hash, fitsInFelt252 } from "./identity";

export const TREE_DEPTH = 20;
export const EMPTY_LEAF = 0n;

/**
 * Compute the Merkle root for a single-user tree (leaf at index 0).
 * All other leaves are EMPTY_LEAF = 0n.
 * Works for the single-user MVP; supports multi-user via leaves array.
 */
export async function computeMerkleRoot(
  leaves: bigint[],
  depth: number = TREE_DEPTH
): Promise<bigint> {
  // Build tree bottom-up
  const size = 1 << depth; // 2^depth
  const nodes = new Array(size).fill(EMPTY_LEAF);
  for (let i = 0; i < leaves.length; i++) {
    nodes[i] = leaves[i];
  }

  let levelNodes = [...nodes];
  for (let level = 0; level < depth; level++) {
    const nextLevel: bigint[] = [];
    for (let i = 0; i < levelNodes.length; i += 2) {
      const left = levelNodes[i];
      const right = i + 1 < levelNodes.length ? levelNodes[i + 1] : EMPTY_LEAF;
      const parent = await poseidon2Hash([left, right]);
      nextLevel.push(parent);
    }
    levelNodes = nextLevel;
  }
  return levelNodes[0];
}

/**
 * Compute the Merkle path (siblings + indices) for a leaf at the given index.
 * Returns the data needed by the Noir circuit:
 *   - path: sibling hashes at each level
 *   - indices: 0 = current is left child, 1 = current is right child
 */
export async function computeMerklePath(
  leaves: bigint[],
  leafIndex: number,
  depth: number = TREE_DEPTH
): Promise<{ path: bigint[]; indices: number[]; root: bigint }> {
  const size = 1 << depth;
  const nodes = new Array(size).fill(EMPTY_LEAF);
  for (let i = 0; i < leaves.length; i++) {
    nodes[i] = leaves[i];
  }

  // Build all levels
  const tree: bigint[][] = [nodes];
  let levelNodes = [...nodes];
  for (let level = 0; level < depth; level++) {
    const nextLevel: bigint[] = [];
    for (let i = 0; i < levelNodes.length; i += 2) {
      const left = levelNodes[i];
      const right = i + 1 < levelNodes.length ? levelNodes[i + 1] : EMPTY_LEAF;
      nextLevel.push(await poseidon2Hash([left, right]));
    }
    tree.push(nextLevel);
    levelNodes = nextLevel;
  }

  const path: bigint[] = [];
  const indices: number[] = [];
  let idx = leafIndex;
  for (let level = 0; level < depth; level++) {
    const isRight = idx % 2 === 1;
    indices.push(isRight ? 1 : 0);
    const siblingIdx = isRight ? idx - 1 : idx + 1;
    const sibling = tree[level][siblingIdx] ?? EMPTY_LEAF;
    path.push(sibling);
    idx = Math.floor(idx / 2);
  }

  const root = tree[depth][0];
  return { path, indices, root };
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
