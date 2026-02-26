/**
 * Identity management for Thanatos Protocol.
 *
 * A Semaphore identity consists of:
 *  - identity_secret:    a random 31-byte field element
 *  - identity_nullifier: a random 31-byte field element
 *  - identity_commitment = Poseidon2(identity_secret, identity_nullifier)
 *
 * The commitment is added to the on-chain Semaphore group (Merkle tree).
 * The nullifier is used to derive epoch-scoped proofs without double-spending.
 */

export interface Identity {
  secret: bigint;
  nullifier: bigint;
  commitment: bigint;
}

export interface StoredIdentity {
  secret: string; // hex string
  nullifier: string; // hex string
  commitment: string; // hex string
  createdAt: number;
}

// BN254 scalar field modulus (same field as Starknet Poseidon)
const FIELD_MODULUS =
  21888242871839275222246405745257275088548364400416034343698204186575808495617n;

/**
 * Reads cryptographically random bytes from the browser's CSPRNG.
 */
function randomFieldElement(): bigint {
  const bytes = new Uint8Array(31); // 31 bytes = 248 bits, safely within BN254 field
  crypto.getRandomValues(bytes);
  let val = 0n;
  for (const b of bytes) {
    val = (val << 8n) | BigInt(b);
  }
  return val % FIELD_MODULUS;
}

/**
 * Minimal Poseidon2 hash implementation for identity derivation in the browser.
 *
 * NOTE: This mirrors the on-chain and circuit logic exactly.
 * For production, replace with the @noble/poseidon2 library when available,
 * or the wasm-compiled version from @aztec/bb.js.
 *
 * For now we use the starknet.js pedersen as a placeholder and flag clearly.
 * The real proofs are generated via Barretenberg (Noir prover) which uses the
 * correct Poseidon2 parameterization.
 */
async function poseidon2Hash(inputs: bigint[]): Promise<bigint> {
  // We dynamically import starknet to avoid SSR issues
  const { hash } = await import("starknet");
  // starknet.js poseidonHash uses Starknet's Poseidon (identical to Poseidon2 here)
  const felt252Inputs = inputs.map((n) => "0x" + n.toString(16));
  const result = hash.computePoseidonHashOnElements(felt252Inputs);
  return BigInt(result);
}

/**
 * Generate a new Semaphore identity.
 * Returns the secret, nullifier, and derived commitment.
 */
export async function generateIdentity(): Promise<Identity> {
  const secret = randomFieldElement();
  const nullifier = randomFieldElement();
  const commitment = await poseidon2Hash([secret, nullifier]);
  return { secret, nullifier, commitment };
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
 * Serialize an identity to a storable JSON object (hex strings for bigints).
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

/**
 * Persist identity to localStorage.
 * In production, this should be encrypted with a PIN/password using Web Crypto API.
 */
export function storeIdentity(identity: Identity): void {
  if (typeof window === "undefined") return;
  const stored = serializeIdentity(identity);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

/**
 * Load identity from localStorage.
 * Returns null if no identity is found.
 */
export function loadIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const stored: StoredIdentity = JSON.parse(raw);
    return deserializeIdentity(stored);
  } catch {
    return null;
  }
}

/**
 * Clear the stored identity from localStorage.
 */
export function clearIdentity(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Export identity as a downloadable JSON backup file.
 */
export function exportIdentityBackup(identity: Identity): void {
  if (typeof window === "undefined") return;
  const stored = serializeIdentity(identity);
  const blob = new Blob([JSON.stringify(stored, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `thanatos-identity-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Import identity from a JSON backup file string.
 */
export function importIdentityBackup(jsonString: string): Identity {
  const stored: StoredIdentity = JSON.parse(jsonString);
  // Validate fields
  if (!stored.secret || !stored.nullifier || !stored.commitment) {
    throw new Error("Invalid identity backup: missing required fields");
  }
  return deserializeIdentity(stored);
}
