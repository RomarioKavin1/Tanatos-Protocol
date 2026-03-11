/**
 * Starknet provider and chain configuration for Thanatos Protocol.
 */

import { RpcProvider, constants } from "starknet";

// ---------------------------------------------------------------------------
// Chain IDs
// ---------------------------------------------------------------------------
export const CHAIN_IDS = {
  MAINNET: constants.StarknetChainId.SN_MAIN,
  SEPOLIA: constants.StarknetChainId.SN_SEPOLIA,
} as const;

// ---------------------------------------------------------------------------
// RPC endpoints
// ---------------------------------------------------------------------------
const RPC_URLS = {
  mainnet:
    process.env.NEXT_PUBLIC_MAINNET_RPC_URL ??
    "https://starknet-mainnet.public.blastapi.io/rpc/v0_7",
  sepolia:
    process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL ??
    "https://starknet-sepolia.public.blastapi.io/rpc/v0_7",
} as const;

// ---------------------------------------------------------------------------
// Provider factories
// ---------------------------------------------------------------------------
export function getSepoliaProvider(): RpcProvider {
  return new RpcProvider({ nodeUrl: RPC_URLS.sepolia });
}

export function getMainnetProvider(): RpcProvider {
  return new RpcProvider({ nodeUrl: RPC_URLS.mainnet });
}

/**
 * Returns the appropriate provider based on the NEXT_PUBLIC_NETWORK env var.
 * Defaults to Sepolia for safety.
 */
export function getDefaultProvider(): RpcProvider {
  const network = process.env.NEXT_PUBLIC_NETWORK ?? "sepolia";
  return network === "mainnet" ? getMainnetProvider() : getSepoliaProvider();
}

// ---------------------------------------------------------------------------
// Network metadata
// ---------------------------------------------------------------------------
export interface NetworkInfo {
  name: string;
  chainId: string;
  explorerUrl: string;
  faucetUrl?: string;
}

export const NETWORKS: Record<string, NetworkInfo> = {
  mainnet: {
    name: "Starknet Mainnet",
    chainId: CHAIN_IDS.MAINNET,
    explorerUrl: "https://starkscan.co",
  },
  sepolia: {
    name: "Starknet Sepolia Testnet",
    chainId: CHAIN_IDS.SEPOLIA,
    explorerUrl: "https://sepolia.starkscan.co",
    faucetUrl: "https://blastapi.io/faucets/starknet-sepolia-eth",
  },
};

/**
 * Return a link to a transaction on the block explorer.
 */
export function getTxUrl(txHash: string, network = "sepolia"): string {
  const info = NETWORKS[network] ?? NETWORKS.sepolia;
  return `${info.explorerUrl}/tx/${txHash}`;
}

/**
 * Return a link to a contract on the block explorer.
 */
export function getContractUrl(address: string, network = "sepolia"): string {
  const info = NETWORKS[network] ?? NETWORKS.sepolia;
  return `${info.explorerUrl}/contract/${address}`;
}

/**
 * Shorten an address for display: 0x1234...5678
 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return "";
  const cleaned = address.startsWith("0x") ? address : "0x" + address;
  if (cleaned.length <= chars * 2 + 2) return cleaned;
  return `${cleaned.slice(0, chars + 2)}...${cleaned.slice(-chars)}`;
}

/**
 * Format a Unix timestamp as a human-readable relative time.
 */
export function formatTimeRemaining(deadlineTimestamp: number): string {
  const nowMs = Date.now();
  const diffMs = deadlineTimestamp * 1000 - nowMs;

  if (diffMs <= 0) return "Overdue";

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

/**
 * Check if a Starknet address is valid (basic format check).
 */
export function isValidAddress(address: string): boolean {
  if (!address.startsWith("0x")) return false;
  const hex = address.slice(2);
  return hex.length > 0 && hex.length <= 64 && /^[0-9a-fA-F]+$/.test(hex);
}
