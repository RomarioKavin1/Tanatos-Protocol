/**
 * ZK proof generation for Thanatos Protocol.
 *
 * Uses @noir-lang/noir_js (Noir runtime) and @noir-lang/backend_barretenberg
 * (Barretenberg UltraHonk backend) to generate and verify liveness proofs
 * entirely in the browser (or in Node for testing).
 *
 * The compiled circuit artifact (JSON) is loaded from /public/circuits/liveness.json.
 * Run `nargo compile` then copy target/liveness.json to frontend/public/circuits/.
 */

import { Noir } from "@noir-lang/noir_js";
import { UltraHonkBackend } from "@noir-lang/backend_barretenberg";
import type { Identity } from "./identity";

// Type aliases matching @noir-lang/noir_js API
type CompiledCircuit = {
  bytecode: string;
  abi: unknown;
};

type ProofData = {
  proof: Uint8Array;
  publicInputs: string[];
};

// Cached singleton instances (avoid reloading WASM on every proof)
let cachedNoir: Noir | null = null;
let cachedBackend: UltraHonkBackend | null = null;
let cachedCircuit: CompiledCircuit | null = null;

/**
 * Load the compiled Noir circuit from the public directory.
 */
async function loadCircuit(): Promise<CompiledCircuit> {
  if (cachedCircuit) return cachedCircuit;
  const resp = await fetch("/circuits/liveness.json");
  if (!resp.ok) {
    throw new Error(
      `Failed to load circuit: ${resp.status} ${resp.statusText}\n` +
        "Run 'nargo compile' in circuits/liveness and copy the output to frontend/public/circuits/liveness.json"
    );
  }
  cachedCircuit = (await resp.json()) as CompiledCircuit;
  return cachedCircuit;
}

/**
 * Initialize Noir and Barretenberg backend (idempotent).
 */
async function initProver(): Promise<{ noir: Noir; backend: UltraHonkBackend }> {
  if (cachedNoir && cachedBackend) {
    return { noir: cachedNoir, backend: cachedBackend };
  }

  const circuit = await loadCircuit();
  const backend = new UltraHonkBackend(circuit.bytecode);
  const noir = new Noir(circuit);

  cachedNoir = noir;
  cachedBackend = backend;

  return { noir, backend };
}

export interface MerkleWitness {
  path: bigint[]; // sibling hashes, length 20
  indices: number[]; // 0 or 1, length 20
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
 * Convert a bigint to a hex-prefixed string suitable for Noir inputs.
 */
function toHex(n: bigint): string {
  return "0x" + n.toString(16).padStart(64, "0");
}

/**
 * Generate a liveness proof for the given identity and Merkle witness.
 *
 * Public outputs that get submitted on-chain:
 *  - root         (Merkle root matching on-chain state)
 *  - nullifierHash (H(nullifier, epoch) — unique per epoch)
 *  - signalHash   (H(epoch))
 *  - epoch        (current epoch number)
 */
export async function generateLivenessProof(
  inputs: LivenessProofInputs
): Promise<LivenessProof> {
  const { noir, backend } = await initProver();

  // Pad or truncate merkle path to exactly 20 elements
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

  // Execute circuit to get witness
  const { witness } = await noir.execute(circuitInputs);

  // Generate proof
  const proofData: ProofData = await backend.generateProof(witness);

  return {
    proof: proofData.proof,
    publicInputs: proofData.publicInputs,
  };
}

/**
 * Verify a liveness proof locally (for debugging / pre-submission validation).
 */
export async function verifyProofLocally(
  proof: LivenessProof
): Promise<boolean> {
  const { backend } = await initProver();
  return backend.verifyProof({
    proof: proof.proof,
    publicInputs: proof.publicInputs,
  });
}

/**
 * Serialize a proof to an array of felt252 strings for Starknet calldata.
 *
 * The on-chain verifier (Garaga) expects the proof in a specific encoding.
 * This produces the raw bytes as hex field elements.
 */
export function serializeProofForStarknet(proof: LivenessProof): string[] {
  const calldata: string[] = [];

  // Prepend public inputs
  for (const pi of proof.publicInputs) {
    calldata.push(pi);
  }

  // Encode raw proof bytes as chunks of 31 bytes each (field element max)
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
 * Node.js / script entrypoint for CLI proof generation and testing.
 * Usage: tsx src/lib/prover.ts
 */
if (typeof process !== "undefined" && process.argv[1]?.endsWith("prover.ts")) {
  console.log("Thanatos Protocol — Test Proof Generator");
  console.log("=========================================");
  console.log(
    "This script generates a test liveness proof with dummy inputs."
  );
  console.log(
    "Make sure frontend/public/circuits/liveness.json exists (run nargo compile first)."
  );

  const dummyInputs: LivenessProofInputs = {
    identity: {
      secret: 123456789n,
      nullifier: 987654321n,
      commitment: 0n, // will be computed inside circuit
    },
    merkle: {
      path: Array(20).fill(0n),
      indices: Array(20).fill(0),
    },
    root: 0n, // dummy root — will NOT satisfy merkle constraint; just for API testing
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
    .catch((err) => {
      console.error("Proof generation failed:", err.message);
      process.exit(1);
    });
}
