/**
 * ZK proof generation for Thanatos Protocol.
 *
 * Uses @noir-lang/noir_js (Noir runtime) and @aztec/bb.js (Barretenberg
 * UltraHonk backend) to generate and verify liveness proofs entirely in the
 * browser (or in Node for testing).
 *
 * The compiled circuit artifact (JSON) is loaded from /public/circuits/liveness.json.
 * Run `nargo compile` in circuits/liveness, then copy target/liveness.json to
 * frontend/public/circuits/liveness.json.
 */

import { Noir } from "@noir-lang/noir_js";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import type { CompiledCircuit } from "@noir-lang/types";
import type { Identity } from "./identity";

type ProofData = {
  proof: Uint8Array;
  publicInputs: string[];
};

// Singleton instances — avoid reloading multi-MB WASM on every proof
let cachedNoir: Noir | null = null;
let cachedBackend: UltraHonkBackend | null = null;
let cachedCircuit: CompiledCircuit | null = null;
let cachedApi: Barretenberg | null = null;

/**
 * Load the compiled Noir circuit from the public directory.
 */
async function loadCircuit(): Promise<CompiledCircuit> {
  if (cachedCircuit) return cachedCircuit;
  const resp = await fetch("/circuits/liveness.json");
  if (!resp.ok) {
    throw new Error(
      `Failed to load circuit: ${resp.status} ${resp.statusText}\n` +
        "Run 'nargo compile' in circuits/liveness and copy target/liveness.json " +
        "to frontend/public/circuits/liveness.json"
    );
  }
  cachedCircuit = (await resp.json()) as unknown as CompiledCircuit;
  return cachedCircuit;
}

/**
 * Initialize Noir and Barretenberg backend (idempotent singleton).
 * In @aztec/bb.js 4.x the UltraHonkBackend constructor requires a
 * pre-initialized Barretenberg API instance as its second argument.
 */
async function initProver(): Promise<{ noir: Noir; backend: UltraHonkBackend }> {
  if (cachedNoir && cachedBackend) {
    return { noir: cachedNoir, backend: cachedBackend };
  }

  const circuit = await loadCircuit();

  // threads: 1 avoids SharedArrayBuffer requirement in browsers without COOP/COEP
  const api = await Barretenberg.new({ threads: 1 });
  cachedApi = api;

  const backend = new UltraHonkBackend(circuit.bytecode, api);
  const noir = new Noir(circuit as CompiledCircuit);

  cachedNoir = noir;
  cachedBackend = backend;

  return { noir, backend };
}

export interface MerkleWitness {
  path: bigint[]; // sibling hashes — length 20
  indices: number[]; // 0 = current is left child, 1 = right child — length 20
}

export interface LivenessProofInputs {
  identity: Identity;
  merkle: MerkleWitness;
  root: bigint;
  nullifierHash: bigint;
  signalHash: bigint;
  epoch: bigint;
}

export interface LivenessProof {
  proof: Uint8Array;
  publicInputs: string[];
}

/**
 * Convert a bigint to a 0x-prefixed, 64-char hex string for Noir inputs.
 */
function toHex(n: bigint): string {
  return "0x" + n.toString(16).padStart(64, "0");
}

/**
 * Generate a Thanatos liveness proof.
 *
 * Private inputs (never leave the device):
 *   identity_secret, identity_nullifier, merkle_path, merkle_indices
 *
 * Public outputs submitted on-chain:
 *   root, nullifier_hash, signal_hash, epoch
 */
export async function generateLivenessProof(
  inputs: LivenessProofInputs
): Promise<LivenessProof> {
  const { noir, backend } = await initProver();

  // Pad or truncate Merkle arrays to exactly depth=20
  const path = Array.from({ length: 20 }, (_, i) =>
    toHex(inputs.merkle.path[i] ?? 0n)
  );
  const indices = Array.from({ length: 20 }, (_, i) =>
    inputs.merkle.indices[i] ?? 0
  );

  const circuitInputs = {
    identity_secret: toHex(inputs.identity.secret),
    identity_nullifier: toHex(inputs.identity.nullifier),
    merkle_path: path,
    merkle_indices: indices,
    root: toHex(inputs.root),
    nullifier_hash: toHex(inputs.nullifierHash),
    signal_hash: toHex(inputs.signalHash),
    epoch: toHex(inputs.epoch),
  };

  // Step 1: execute circuit to produce the witness (ACVM execution)
  const { witness } = await noir.execute(circuitInputs);

  // Step 2: generate the UltraHonk proof from the witness
  const proofData: ProofData = await backend.generateProof(witness, {
    verifierTarget: "starknet", // Garaga Starknet verifier target
  });

  return {
    proof: proofData.proof,
    publicInputs: proofData.publicInputs,
  };
}

/**
 * Verify a liveness proof locally (debugging / pre-submission check).
 */
export async function verifyProofLocally(proof: LivenessProof): Promise<boolean> {
  const { backend } = await initProver();
  return backend.verifyProof(
    { proof: proof.proof, publicInputs: proof.publicInputs },
    { verifierTarget: "starknet" }
  );
}

/**
 * Serialize a proof to felt252 strings for Starknet calldata.
 * Garaga expects: [public_inputs..., num_chunks, chunk_0, chunk_1, ...]
 */
export function serializeProofForStarknet(proof: LivenessProof): string[] {
  const calldata: string[] = [...proof.publicInputs];

  // Encode raw proof bytes in 31-byte chunks (max felt252 payload)
  const CHUNK = 31;
  const bytes = proof.proof;
  const numChunks = Math.ceil(bytes.length / CHUNK);
  calldata.push("0x" + numChunks.toString(16));

  for (let i = 0; i < bytes.length; i += CHUNK) {
    const chunk = bytes.slice(i, i + CHUNK);
    let val = 0n;
    for (const b of chunk) {
      val = (val << 8n) | BigInt(b);
    }
    calldata.push("0x" + val.toString(16).padStart(62, "0"));
  }

  return calldata;
}

/**
 * Node.js / CLI entrypoint for testing proof generation locally.
 * Usage: tsx src/lib/prover.ts
 */
if (typeof process !== "undefined" && process.argv[1]?.endsWith("prover.ts")) {
  console.log("Thanatos Protocol — Test Proof Generator");
  console.log("=========================================");
  console.log("Generating a test liveness proof with dummy inputs…");
  console.log(
    "Ensure frontend/public/circuits/liveness.json exists (run nargo compile first).\n"
  );

  const dummyInputs: LivenessProofInputs = {
    identity: {
      secret: 123456789n,
      nullifier: 987654321n,
      commitment: 0n,
    },
    merkle: {
      path: Array(20).fill(0n),
      indices: Array(20).fill(0),
    },
    // These values will fail the circuit constraints — this tests the API only
    root: 0n,
    nullifierHash: 0n,
    signalHash: 0n,
    epoch: 1n,
  };

  generateLivenessProof(dummyInputs)
    .then((proof) => {
      console.log("Proof generated successfully!");
      console.log("Proof length (bytes):", proof.proof.length);
      console.log("Public inputs:", proof.publicInputs);
    })
    .catch((err: Error) => {
      console.error("Proof generation failed:", err.message);
      process.exit(1);
    });
}
