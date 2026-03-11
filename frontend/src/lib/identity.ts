/**
 * Identity management for Thanatos Protocol.
 *
 * A Semaphore identity consists of:
 *  - identity_secret:    a random 31-byte field element
 *  - identity_nullifier: a random 31-byte field element
 *  - identity_commitment = Poseidon2(identity_secret, identity_nullifier)  [BN254 field]
 *
 * All ZK-related hashes (commitment, nullifier_hash, signal_hash, Merkle root)
 * use BN254 Poseidon2 to match the Noir circuit. Values are validated to fit
 * in felt252 (Starknet's field), retrying if they overflow.
 */

import { Barretenberg } from "@aztec/bb.js";

export interface Identity {
  secret: bigint;
  nullifier: bigint;
  commitment: bigint;
}

export interface StoredIdentity {
  secret: string;  // hex string
  nullifier: string; // hex string
  commitment: string; // hex string
  createdAt: number;
}

// BN254 scalar field modulus
const BN254_PRIME =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

// Starknet felt252 max (Stark prime - 1)
const FELT252_MAX =
  3618502788666131213697322783095070105623107215331596699973092056135872020480n;

/** Singleton Barretenberg WASM instance */
let _bb: Barretenberg | null = null;
async function getBb(): Promise<Barretenberg> {
  if (!_bb) {
    const { Barretenberg } = await import("@aztec/bb.js");
    _bb = await Barretenberg.new({ threads: 1 });
  }
  return _bb;
}

/** Convert bigint to 32-byte Uint8Array (big-endian) */
function bigintToBytes(n: bigint): Uint8Array {
  const hex = n.toString(16).padStart(64, "0");
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Convert 32-byte Uint8Array (big-endian) to bigint */
function bytesToBigint(bytes: Uint8Array): bigint {
  let n = 0n;
  for (const b of bytes) {
    n = (n << 8n) | BigInt(b);
  }
  return n;
}

/**
 * BN254 Poseidon2 hash — matches the Noir circuit exactly.
 * Uses the Barretenberg WASM backend from @aztec/bb.js.
 */
export async function poseidon2Hash(inputs: bigint[]): Promise<bigint> {
  const bb = await getBb();
  const inputBytes = inputs.map(bigintToBytes);
  const result = await bb.poseidon2Hash({ inputs: inputBytes });
  return bytesToBigint(result.hash);
}

/**
 * Reads cryptographically random bytes from the browser's CSPRNG.
 * Returns a value safely within the BN254 scalar field.
 */
function randomFieldElement(): bigint {
  const bytes = new Uint8Array(31); // 31 bytes = 248 bits, always < BN254 prime
  crypto.getRandomValues(bytes);
  let val = 0n;
  for (const b of bytes) {
    val = (val << 8n) | BigInt(b);
  }
  return val % BN254_PRIME;
}

/**
 * Check that a BN254 field element fits in a Starknet felt252.
 * About 83% of BN254 values fit; we retry on overflow.
 */
export function fitsInFelt252(n: bigint): boolean {
  return n <= FELT252_MAX;
}

/**
 * Generate a new Semaphore identity.
 * Retries until the identity_commitment fits in felt252 (Starknet storage).
 */
export async function generateIdentity(): Promise<Identity> {
  for (let attempt = 0; attempt < 200; attempt++) {
    const secret = randomFieldElement();
    const nullifier = randomFieldElement();
    const commitment = await poseidon2Hash([secret, nullifier]);
    if (fitsInFelt252(commitment)) {
      return { secret, nullifier, commitment };
    }
  }
  throw new Error("Failed to generate felt252-compatible identity after 200 attempts");
}

/**
 * Recompute the identity commitment from stored secret and nullifier.
 */
export async function computeIdentityCommitment(
  secret: bigint,
  nullifier: bigint
): Promise<bigint> {
  return poseidon2Hash([secret, nullifier]);
}

/**
 * Derive the nullifier hash for a given epoch.
 * nullifier_hash = Poseidon2(identity_nullifier, epoch)
 *
 * This is the value submitted on-chain and checked in the ZK circuit.
 */
export async function computeNullifierHash(
  nullifier: bigint,
  epoch: bigint
): Promise<bigint> {
  return poseidon2Hash([nullifier, epoch]);
}

/**
 * Derive the signal hash for a given epoch.
 * signal_hash = Poseidon2(epoch)
 */
export async function computeSignalHash(epoch: bigint): Promise<bigint> {
  return poseidon2Hash([epoch]);
}

/**
 * Compute the current epoch number from the interval length.
 * epoch = floor(unix_timestamp_seconds / interval_seconds)
 */
export function getCurrentEpoch(intervalSeconds: number): bigint {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return BigInt(Math.floor(nowSeconds / intervalSeconds));
}

/**
 * Returns the Unix timestamp (seconds) when the current epoch ends.
 */
export function getEpochDeadline(intervalSeconds: number): number {
  const epoch = Number(getCurrentEpoch(intervalSeconds));
  return (epoch + 1) * intervalSeconds;
}

/**
 * Serialize an identity to a storable JSON object.
 */
export function serializeIdentity(identity: Identity): StoredIdentity {
  return {
    secret: "0x" + identity.secret.toString(16).padStart(64, "0"),
    nullifier: "0x" + identity.nullifier.toString(16).padStart(64, "0"),
    commitment: "0x" + identity.commitment.toString(16).padStart(64, "0"),
    createdAt: Date.now(),
  };
}

/**
 * Deserialize an identity from stored JSON.
 */
export function deserializeIdentity(stored: StoredIdentity): Identity {
  return {
    secret: BigInt(stored.secret),
    nullifier: BigInt(stored.nullifier),
    commitment: BigInt(stored.commitment),
  };
}

const STORAGE_KEY = "thanatos_identity";

export function storeIdentity(identity: Identity): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeIdentity(identity)));
}

export function loadIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return deserializeIdentity(JSON.parse(raw) as StoredIdentity);
  } catch {
    return null;
  }
}

export function clearIdentity(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function exportIdentityBackup(identity: Identity): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(serializeIdentity(identity), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `thanatos-identity-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importIdentityBackup(jsonString: string): Identity {
  const stored: StoredIdentity = JSON.parse(jsonString);
  if (!stored.secret || !stored.nullifier || !stored.commitment) {
    throw new Error("Invalid identity backup: missing required fields");
  }
  return deserializeIdentity(stored);
}
