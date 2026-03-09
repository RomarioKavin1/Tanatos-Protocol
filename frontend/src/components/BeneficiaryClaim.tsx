"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAccount, useProvider } from "@starknet-react/core";
import {
  Inbox,
  Search,
  CheckCircle,
  XCircle,
  Loader2,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { hash } from "starknet";
import { isVaultActivated, claimVault, getVaultController } from "@/lib/contracts";
import { isValidAddress } from "@/lib/starknet";
import type { Account } from "starknet";

type ClaimState = "search" | "checking" | "not_found" | "not_activated" | "activated" | "claiming" | "claimed";

export function BeneficiaryClaim() {
  const { account, address } = useAccount();
  const { provider } = useProvider();

  const [claimState, setClaimState] = useState<ClaimState>("search");
  const [vaultCommitmentInput, setVaultCommitmentInput] = useState("");
  const [claimKeyInput, setClaimKeyInput] = useState("");
  const [vaultCommitment, setVaultCommitment] = useState<bigint | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");

  // Pre-fill recipient with connected wallet
  useEffect(() => {
    if (address && !recipient) {
      setRecipient(address);
    }
  }, [address, recipient]);

  /**
   * Derive the vault commitment from the creator's identity commitment and the shared salt.
   * vault_commitment = Poseidon(identity_commitment, salt)
   */
  const deriveCommitmentFromInputs = (): bigint | null => {
    try {
      const cleaned = vaultCommitmentInput.trim();
      if (!cleaned) return null;
      // Accept direct commitment or derive from components
      return BigInt(cleaned);
    } catch {
      return null;
    }
  };

  const handleSearch = async () => {
    const commitment = deriveCommitmentFromInputs();
    if (commitment === null) {
      toast.error("Invalid vault commitment. Enter a valid hex or decimal value.");
      return;
    }

    setVaultCommitment(commitment);
    setClaimState("checking");

    try {
      const activated = await isVaultActivated(provider, commitment);
      setClaimState(activated ? "activated" : "not_activated");
    } catch (err) {
      console.error(err);
      setClaimState("not_found");
      toast.error("Could not find vault. Check the commitment and try again.");
    }
  };

  const handleClaim = async () => {
    if (!account || !vaultCommitment) return;

    if (!isValidAddress(recipient)) {
      toast.error("Enter a valid Starknet recipient address.");
      return;
    }

    // Build the claim proof: for MVP, encode the claim key as felt252 array
    // In production, this would be a ZK proof of knowledge of the private key
    const claimProof: string[] = claimKeyInput
      .match(/.{1,31}/g)
      ?.map((chunk) => {
        const hex = Buffer.from(chunk, "utf8").toString("hex");
        return "0x" + hex.padStart(62, "0");
      }) ?? ["0x1"]; // fallback non-empty proof

    setClaimState("claiming");

    try {
      const receipt = await claimVault(account as Account, {
        vaultCommitment,
        claimProof,
        recipient,
      });

      setTxHash("transaction_hash" in receipt ? receipt.transaction_hash : "");
      setClaimState("claimed");
      toast.success("Vault claimed successfully!");
    } catch (err: unknown) {
      setClaimState("activated");
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast.error(`Claim failed: ${msg}`);
      console.error(err);
    }
  };

  const handleReset = () => {
    setClaimState("search");
    setVaultCommitmentInput("");
    setClaimKeyInput("");
    setVaultCommitment(null);
    setTxHash(null);
  };

  return (
    <div className="max-w-lg mx-auto">
      <div
        className="p-8 rounded-2xl"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <div className="flex items-center gap-3 mb-6">
          <Inbox className="w-8 h-8" style={{ color: "var(--secondary)" }} />
          <div>
            <h2 className="text-xl font-bold">Claim Vault</h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Claim an activated vault as the beneficiary
            </p>
          </div>
        </div>

        {/* Search form */}
        {(claimState === "search" || claimState === "not_found") && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">
                Vault Commitment
              </label>
              <input
                type="text"
                placeholder="0x... (hex field element)"
                value={vaultCommitmentInput}
                onChange={(e) => setVaultCommitmentInput(e.target.value)}
                className="w-full px-4 py-3 rounded-xl text-sm font-mono"
                style={{
                  background: "var(--background)",
                  border: `1px solid ${claimState === "not_found" ? "var(--destructive)" : "var(--card-border)"}`,
                  color: "var(--foreground)",
                  outline: "none",
                }}
              />
              <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                The vault commitment was shared with you by the vault creator (or derived from
                their identity commitment + salt).
              </p>
            </div>

            {claimState === "not_found" && (
              <div
                className="flex items-center gap-2 p-3 rounded-xl mb-4"
                style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)" }}
              >
                <XCircle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--destructive)" }} />
                <p className="text-sm" style={{ color: "var(--destructive)" }}>
                  Vault not found or contract not reachable. Check the commitment.
                </p>
              </div>
            )}

            <button
              onClick={handleSearch}
              className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
              style={{ background: "var(--secondary)", color: "white" }}
            >
              <Search className="w-4 h-4" />
              Look Up Vault
            </button>
          </motion.div>
        )}

        {/* Checking */}
        {claimState === "checking" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center py-10 gap-4"
          >
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--secondary)" }} />
            <p style={{ color: "var(--muted-foreground)" }}>Checking vault status...</p>
          </motion.div>
        )}

        {/* Not activated */}
        {claimState === "not_activated" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div
              className="flex items-start gap-3 p-4 rounded-xl mb-6"
              style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}
            >
              <XCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }} />
              <div>
                <p className="font-semibold" style={{ color: "var(--accent)" }}>
                  Vault Not Yet Activated
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                  The vault owner is still alive and checking in. The vault will activate
                  automatically after {3} consecutive missed check-ins.
                </p>
              </div>
            </div>

            <div
              className="p-4 rounded-xl mb-6"
              style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}
            >
              <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>Vault Commitment</p>
              <p className="text-sm font-mono break-all">
                0x{vaultCommitment?.toString(16).padStart(64, "0")}
              </p>
            </div>

            <button
              onClick={handleReset}
              className="w-full py-3 rounded-xl font-medium transition-all hover:opacity-80"
              style={{ background: "var(--card-border)" }}
            >
              Search Again
            </button>
          </motion.div>
        )}

        {/* Activated — can claim */}
        {claimState === "activated" && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div
              className="flex items-start gap-3 p-4 rounded-xl mb-6"
              style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}
            >
              <CheckCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "var(--success)" }} />
              <div>
                <p className="font-semibold" style={{ color: "var(--success)" }}>
                  Vault Activated — Ready to Claim
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                  The vault owner has missed their check-in threshold. Enter your claim key
                  and recipient address to claim the funds.
                </p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Claim Key</label>
                <input
                  type="text"
                  placeholder="Your secret claim key (shared by the vault creator)"
                  value={claimKeyInput}
                  onChange={(e) => setClaimKeyInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{
                    background: "var(--background)",
                    border: "1px solid var(--card-border)",
                    color: "var(--foreground)",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Recipient Address</label>
                <input
                  type="text"
                  placeholder="0x... Starknet address"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm font-mono"
                  style={{
                    background: "var(--background)",
                    border: `1px solid ${
                      recipient && !isValidAddress(recipient)
                        ? "var(--destructive)"
                        : "var(--card-border)"
                    }`,
                    color: "var(--foreground)",
                    outline: "none",
                  }}
                />
              </div>
            </div>

            <button
              onClick={handleClaim}
              disabled={!account || !claimKeyInput || !isValidAddress(recipient)}
              className="w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--success)" }}
            >
              {!account ? "Connect Wallet First" : (
                <>
                  Claim Vault Funds
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </motion.div>
        )}

        {/* Claiming in progress */}
        {claimState === "claiming" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center py-10 gap-4"
          >
            <Loader2 className="w-10 h-10 animate-spin" style={{ color: "var(--success)" }} />
            <p style={{ color: "var(--muted-foreground)" }}>Submitting claim to Starknet...</p>
          </motion.div>
        )}

        {/* Claimed */}
        {claimState === "claimed" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-8"
          >
            <CheckCircle
              className="w-16 h-16 mx-auto mb-4"
              style={{ color: "var(--success)" }}
            />
            <h3 className="text-2xl font-bold mb-2">Claim Successful!</h3>
            <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
              The vault funds have been transferred to your recipient address.
            </p>
            {txHash && (
              <a
                href={`https://sepolia.starkscan.co/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium transition-all hover:opacity-80"
                style={{
                  background: "var(--card-border)",
                  color: "var(--foreground)",
                }}
              >
                View Transaction
                <ArrowRight className="w-4 h-4" />
              </a>
            )}
          </motion.div>
        )}
      </div>

      {/* Instructions for beneficiary */}
      {(claimState === "search" || claimState === "not_found") && (
        <div
          className="mt-6 p-6 rounded-2xl"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <h3 className="font-semibold mb-3">What you need to claim</h3>
          <ul className="space-y-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
            <li className="flex gap-2">
              <span style={{ color: "var(--secondary)" }}>1.</span>
              The <strong>vault commitment</strong> — a hex string shared by the vault creator.
            </li>
            <li className="flex gap-2">
              <span style={{ color: "var(--secondary)" }}>2.</span>
              The <strong>claim key</strong> — a secret shared with you by the vault creator.
            </li>
            <li className="flex gap-2">
              <span style={{ color: "var(--secondary)" }}>3.</span>
              A <strong>Starknet wallet</strong> to pay gas for the claim transaction.
            </li>
            <li className="flex gap-2">
              <span style={{ color: "var(--secondary)" }}>4.</span>
              The vault must be <strong>activated</strong> (owner missed 3+ check-ins) before claiming.
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
