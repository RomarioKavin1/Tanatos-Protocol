/**
 * Contract interaction layer for Thanatos Protocol.
 *
 * Provides typed wrappers around the LivenessRegistry and VaultController
 * Starknet contracts using starknet.js v6.
 */

import {
  Contract,
  Account,
  CallData,
  cairo,
  hash,
  type Call,
  type GetTransactionReceiptResponse,
  type ProviderInterface,
} from "starknet";

// Use ProviderInterface to be compatible with both RpcProvider and the
// ProviderInterface returned by @starknet-react/core's useProvider hook
type Provider = ProviderInterface;

// ---------------------------------------------------------------------------
// Contract addresses — override via environment variables
// ---------------------------------------------------------------------------
export const CONTRACT_ADDRESSES = {
  LIVENESS_REGISTRY:
    process.env.NEXT_PUBLIC_LIVENESS_REGISTRY_ADDRESS ??
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  VAULT_CONTROLLER:
    process.env.NEXT_PUBLIC_VAULT_CONTROLLER_ADDRESS ??
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  KEEPER_REGISTRY:
    process.env.NEXT_PUBLIC_KEEPER_REGISTRY_ADDRESS ??
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  STRK_TOKEN:
    process.env.NEXT_PUBLIC_STRK_TOKEN_ADDRESS ??
    "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d", // Sepolia STRK
} as const;

// ---------------------------------------------------------------------------
// ABIs (minimal — only the functions we call)
// ---------------------------------------------------------------------------
export const LIVENESS_REGISTRY_ABI = [
  {
    type: "function",
    name: "register",
    inputs: [
      { name: "identity_commitment", type: "core::felt252" },
      { name: "vault_commitment", type: "core::felt252" },
      { name: "interval_seconds", type: "core::integer::u64" },
      { name: "nullifier_hash", type: "core::felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "checkin",
    inputs: [
      {
        name: "proof",
        type: "core::array::Array::<core::felt252>",
      },
      { name: "nullifier_hash", type: "core::felt252" },
      { name: "signal_hash", type: "core::felt252" },
      { name: "root", type: "core::felt252" },
      { name: "epoch", type: "core::felt252" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "report_missed",
    inputs: [{ name: "nullifier_hash", type: "core::felt252" }],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "get_last_checkin",
    inputs: [{ name: "nullifier_hash", type: "core::felt252" }],
    outputs: [{ type: "core::integer::u64" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_missed_count",
    inputs: [{ name: "nullifier_hash", type: "core::felt252" }],
    outputs: [{ type: "core::integer::u32" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_group_root",
    inputs: [],
    outputs: [{ type: "core::felt252" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_vault_commitment",
    inputs: [{ name: "nullifier_hash", type: "core::felt252" }],
    outputs: [{ type: "core::felt252" }],
    state_mutability: "view",
  },
] as const;

export const VAULT_CONTROLLER_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "vault_commitment", type: "core::felt252" },
      {
        name: "encrypted_beneficiary",
        type: "core::array::Array::<core::felt252>",
      },
      {
        name: "token",
        type: "core::starknet::contract_address::ContractAddress",
      },
      { name: "amount", type: "core::integer::u256" },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "activate",
    inputs: [{ name: "vault_commitment", type: "core::felt252" }],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "claim",
    inputs: [
      { name: "vault_commitment", type: "core::felt252" },
      {
        name: "claim_proof",
        type: "core::array::Array::<core::felt252>",
      },
      {
        name: "recipient",
        type: "core::starknet::contract_address::ContractAddress",
      },
    ],
    outputs: [],
    state_mutability: "external",
  },
  {
    type: "function",
    name: "is_activated",
    inputs: [{ name: "vault_commitment", type: "core::felt252" }],
    outputs: [{ type: "core::bool" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "is_claimed",
    inputs: [{ name: "vault_commitment", type: "core::felt252" }],
    outputs: [{ type: "core::bool" }],
    state_mutability: "view",
  },
  {
    type: "function",
    name: "get_encrypted_beneficiary",
    inputs: [{ name: "vault_commitment", type: "core::felt252" }],
    outputs: [{ type: "core::array::Array::<core::felt252>" }],
    state_mutability: "view",
  },
] as const;

// ---------------------------------------------------------------------------
// Contract factory functions
// ---------------------------------------------------------------------------
export function getRegistryContract(provider: Provider): Contract {
  return new Contract(
    LIVENESS_REGISTRY_ABI as unknown as object[],
    CONTRACT_ADDRESSES.LIVENESS_REGISTRY,
    provider
  );
}

export function getVaultController(provider: Provider): Contract {
  return new Contract(
    VAULT_CONTROLLER_ABI as unknown as object[],
    CONTRACT_ADDRESSES.VAULT_CONTROLLER,
    provider
  );
}

// ---------------------------------------------------------------------------
// Transaction helpers
// ---------------------------------------------------------------------------

/**
 * Register a new identity in the Semaphore group and link it to a vault.
 */
export async function registerVault(
  account: Account,
  params: {
    identityCommitment: bigint;
    vaultCommitment: bigint;
    intervalSeconds: number;
    nullifierHash: bigint;
  }
): Promise<GetTransactionReceiptResponse> {
  const call: Call = {
    contractAddress: CONTRACT_ADDRESSES.LIVENESS_REGISTRY,
    entrypoint: "register",
    calldata: CallData.compile({
      identity_commitment: "0x" + params.identityCommitment.toString(16),
      vault_commitment: "0x" + params.vaultCommitment.toString(16),
      interval_seconds: params.intervalSeconds,
      nullifier_hash: "0x" + params.nullifierHash.toString(16),
    }),
  };

  const tx = await account.execute(call);
  return account.waitForTransaction(tx.transaction_hash);
}

/**
 * Submit a liveness proof to the LivenessRegistry.
 * The proof array is the serialized Garaga-encoded proof.
 */
export async function submitCheckin(
  account: Account,
  params: {
    proof: string[];
    nullifierHash: bigint;
    signalHash: bigint;
    root: bigint;
    epoch: bigint;
  }
): Promise<GetTransactionReceiptResponse> {
  const call: Call = {
    contractAddress: CONTRACT_ADDRESSES.LIVENESS_REGISTRY,
    entrypoint: "checkin",
    calldata: CallData.compile({
      proof: params.proof,
      nullifier_hash: "0x" + params.nullifierHash.toString(16),
      signal_hash: "0x" + params.signalHash.toString(16),
      root: "0x" + params.root.toString(16),
      epoch: "0x" + params.epoch.toString(16),
    }),
  };

  const tx = await account.execute(call);
  return account.waitForTransaction(tx.transaction_hash);
}

/**
 * Deposit tokens into a vault with encrypted beneficiary data.
 */
export async function depositToVault(
  account: Account,
  params: {
    vaultCommitment: bigint;
    encryptedBeneficiary: bigint[];
    token: string;
    amount: bigint;
  }
): Promise<GetTransactionReceiptResponse> {
  // First approve token transfer
  const approveCall: Call = {
    contractAddress: params.token,
    entrypoint: "approve",
    calldata: CallData.compile({
      spender: CONTRACT_ADDRESSES.VAULT_CONTROLLER,
      amount: cairo.uint256(params.amount),
    }),
  };

  const depositCall: Call = {
    contractAddress: CONTRACT_ADDRESSES.VAULT_CONTROLLER,
    entrypoint: "deposit",
    calldata: CallData.compile({
      vault_commitment: "0x" + params.vaultCommitment.toString(16),
      encrypted_beneficiary: params.encryptedBeneficiary.map(
        (n) => "0x" + n.toString(16)
      ),
      token: params.token,
      amount: cairo.uint256(params.amount),
    }),
  };

  // Multicall: approve + deposit atomically
  const tx = await account.execute([approveCall, depositCall]);
  return account.waitForTransaction(tx.transaction_hash);
}

/**
 * Claim vault funds as the beneficiary.
 */
export async function claimVault(
  account: Account,
  params: {
    vaultCommitment: bigint;
    claimProof: string[];
    recipient: string;
  }
): Promise<GetTransactionReceiptResponse> {
  const call: Call = {
    contractAddress: CONTRACT_ADDRESSES.VAULT_CONTROLLER,
    entrypoint: "claim",
    calldata: CallData.compile({
      vault_commitment: "0x" + params.vaultCommitment.toString(16),
      claim_proof: params.claimProof,
      recipient: params.recipient,
    }),
  };

  const tx = await account.execute(call);
  return account.waitForTransaction(tx.transaction_hash);
}

/**
 * Read the current group root from the LivenessRegistry.
 */
export async function getGroupRoot(provider: Provider): Promise<bigint> {
  const contract = getRegistryContract(provider);
  const result = await contract.call("get_group_root", []);
  return BigInt(result as string);
}

/**
 * Read the last check-in timestamp for a nullifier.
 */
export async function getLastCheckin(
  provider: Provider,
  nullifierHash: bigint
): Promise<number> {
  const contract = getRegistryContract(provider);
  const result = await contract.call("get_last_checkin", [
    "0x" + nullifierHash.toString(16),
  ]);
  return Number(result);
}

/**
 * Read the missed check-in count for a nullifier.
 */
export async function getMissedCount(
  provider: Provider,
  nullifierHash: bigint
): Promise<number> {
  const contract = getRegistryContract(provider);
  const result = await contract.call("get_missed_count", [
    "0x" + nullifierHash.toString(16),
  ]);
  return Number(result);
}

/**
 * Check whether a vault has been activated.
 */
export async function isVaultActivated(
  provider: Provider,
  vaultCommitment: bigint
): Promise<boolean> {
  const contract = getVaultController(provider);
  const result = await contract.call("is_activated", [
    "0x" + vaultCommitment.toString(16),
  ]);
  return Boolean(result);
}

/**
 * Derive the vault commitment from a seed + salt.
 * vault_commitment = Poseidon(seed, salt)
 * The seed is the identity_commitment; the salt is a random value shared
 * off-chain with the beneficiary.
 */
export function deriveVaultCommitment(seed: bigint, salt: bigint): bigint {
  // Starknet Poseidon is used here for on-chain compatibility
  const result = hash.computePoseidonHashOnElements([
    "0x" + seed.toString(16),
    "0x" + salt.toString(16),
  ]);
  return BigInt(result);
}

/**
 * Scan for VaultActivated events for a given vault commitment.
 * Returns true if the vault has been activated (useful for beneficiary polling).
 */
export async function scanForActivation(
  provider: Provider,
  vaultCommitment: bigint
): Promise<boolean> {
  // In production: query event logs filtered by vault_commitment key.
  // For now: directly read contract state.
  return isVaultActivated(provider, vaultCommitment);
}
