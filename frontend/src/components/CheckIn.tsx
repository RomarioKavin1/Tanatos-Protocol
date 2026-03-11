"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAccount, useProvider } from "@starknet-react/core";
import { Shield, Zap, CheckCircle, Clock, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  loadIdentity,
  computeNullifierHash,
  computeSignalHash,
  getCurrentEpoch,
  getEpochDeadline,
} from "@/lib/identity";
import { generateLivenessProof, serializeProofForStarknet } from "@/lib/prover";
import {
  submitCheckin,
  getLastCheckin,
  getMissedCount,
  getGroupRoot,
  getMemberCount,
  getLeaf,
  getCheckinInterval,
} from "@/lib/contracts";
import { formatTimeRemaining } from "@/lib/starknet";
import type { Account } from "starknet";

const DEFAULT_INTERVAL_SECONDS = 30 * 24 * 3600;

type ProofStep =
  | "idle"
  | "loading_circuit"
  | "computing_witness"
  | "generating_proof"
  | "submitting"
  | "done"
  | "error";

const STEP_LABELS: Record<ProofStep, string> = {
  idle: "Ready",
  loading_circuit: "Loading ZK circuit...",
  computing_witness: "Computing witness...",
  generating_proof: "Generating proof (this takes ~30s)...",
  submitting: "Submitting to Starknet...",
  done: "Check-in complete!",
  error: "Error",
};

export function CheckIn() {
  const { account } = useAccount();
  const { provider } = useProvider();

  const [proofStep, setProofStep] = useState<ProofStep>("idle");
  const [deadline, setDeadline] = useState<number | null>(null);
  const [lastCheckin, setLastCheckin] = useState<number | null>(null);
  const [missedCount, setMissedCount] = useState<number>(0);
  const [intervalSeconds, setIntervalSeconds] = useState(DEFAULT_INTERVAL_SECONDS);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [timeNow, setTimeNow] = useState(Date.now());

  // Tick every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => setTimeNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Refresh on-chain state
  useEffect(() => {
    const identity = loadIdentity();
    if (!identity || !provider) return;

    const load = async () => {
      try {
        const [last, missed, interval] = await Promise.all([
          getLastCheckin(provider, identity.commitment),
          getMissedCount(provider, identity.commitment),
          getCheckinInterval(provider, identity.commitment).catch(() => 0),
        ]);
        setLastCheckin(last);
        setMissedCount(missed);
        if (interval > 0) {
          setIntervalSeconds(interval);
        }
        setDeadline(getEpochDeadline(interval > 0 ? interval : intervalSeconds));
      } catch {
        setDeadline(getEpochDeadline(intervalSeconds));
      }
    };

    load();
  }, [provider, intervalSeconds]);

  const handleCheckin = async () => {
    const identity = loadIdentity();
    if (!identity) {
      toast.error("No identity found. Please set up your vault first.");
      return;
    }
    if (!account) {
      toast.error("Please connect your wallet.");
      return;
    }

    try {
      const epoch = getCurrentEpoch(intervalSeconds);
      const nullifierHash = await computeNullifierHash(identity.nullifier, epoch);

      // Fetch current group root from chain
      let onChainRoot = 0n;
      let memberCount = 0;
      try {
        const [root, count] = await Promise.all([
          getGroupRoot(provider),
          getMemberCount(provider),
        ]);
        onChainRoot = root;
        memberCount = count;
      } catch {
        // Contract not yet deployed — use empty tree root
      }

      setProofStep("loading_circuit");

      // Fetch all leaves from chain to reconstruct the Merkle tree
      const { computeMerklePath } = await import("@/lib/merkle");
      const leaves: bigint[] = [];
      for (let i = 0; i < memberCount; i++) {
        try {
          const leaf = await getLeaf(provider, i);
          leaves.push(leaf);
        } catch {
          leaves.push(0n);
        }
      }
      // Ensure at least our commitment is in the tree
      if (leaves.length === 0) {
        leaves.push(identity.commitment);
      }

      // Find our leaf index
      const myIndex = leaves.findIndex((l) => l === identity.commitment);
      const leafIndex = myIndex >= 0 ? myIndex : 0;

      setProofStep("computing_witness");

      // Compute Merkle path using BN254 Poseidon2 (matches Noir circuit)
      const { path, indices, root: computedRoot } = await computeMerklePath(
        leaves,
        leafIndex
      );

      // Use the on-chain root for the checkin call; use computed root for the proof
      const root = onChainRoot > 0n ? onChainRoot : computedRoot;
      const signalHash = await computeSignalHash(epoch);

      const merkleWitness = { path, indices };

      setProofStep("generating_proof");
      const proof = await generateLivenessProof({
        identity,
        merkle: merkleWitness,
        root,
        nullifierHash,
        signalHash,
        epoch,
      });

      setProofStep("submitting");
      const proofCalldata = serializeProofForStarknet(proof);

      const receipt = await submitCheckin(account as Account, {
        proof: proofCalldata,
        identityCommitment: identity.commitment,
        nullifierHash,
        signalHash,
        root,
        epoch,
      });

      setTxHash(receipt.transaction_hash);
      setProofStep("done");
      setDeadline(getEpochDeadline(intervalSeconds));
      toast.success("Check-in successful! You're alive.");
    } catch (err: unknown) {
      setProofStep("error");
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Check-in failed: ${msg}`);
      console.error(err);
    }
  };

  const isProving = [
    "loading_circuit",
    "computing_witness",
    "generating_proof",
    "submitting",
  ].includes(proofStep);

  const deadlineMs = deadline ? deadline * 1000 : null;
  const isUrgent = deadlineMs ? deadlineMs - timeNow < 3 * 24 * 3600 * 1000 : false;

  return (
    <div className="max-w-lg mx-auto">
      {/* Status card */}
      <div
        className="p-8 rounded-none mb-6"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8" style={{ color: "var(--primary)" }} />
          <div>
            <h2 className="text-xl font-bold">Liveness Check-in</h2>
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
              Generate a ZK proof to prove you're alive
            </p>
          </div>
        </div>

        {/* Deadline indicator */}
        {deadline && (
          <div
            className="p-4 rounded-none mb-6"
            style={{
              background: isUrgent
                ? "rgba(239,68,68,0.1)"
                : "rgba(124,58,237,0.1)",
              border: `1px solid ${isUrgent ? "rgba(239,68,68,0.3)" : "rgba(124,58,237,0.3)"}`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              {isUrgent ? (
                <AlertTriangle className="w-4 h-4" style={{ color: "var(--destructive)" }} />
              ) : (
                <Clock className="w-4 h-4" style={{ color: "var(--primary)" }} />
              )}
              <span className="text-sm font-semibold">
                {isUrgent ? "Check-in Urgent!" : "Next Deadline"}
              </span>
            </div>
            <p
              className="text-2xl font-bold"
              style={{ color: isUrgent ? "var(--destructive)" : "var(--primary)" }}
            >
              {formatTimeRemaining(deadline)}
            </p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div
            className="p-4 rounded-none"
            style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
              Last Check-in
            </p>
            <p className="font-semibold">
              {lastCheckin
                ? new Date(lastCheckin * 1000).toLocaleDateString()
                : "Never (or not loaded)"}
            </p>
          </div>
          <div
            className="p-4 rounded-none"
            style={{
              background: "var(--background)",
              border: `1px solid ${missedCount > 0 ? "rgba(239,68,68,0.4)" : "var(--card-border)"}`,
            }}
          >
            <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
              Missed Check-ins
            </p>
            <p
              className="font-semibold text-xl"
              style={{ color: missedCount > 0 ? "var(--destructive)" : "var(--foreground)" }}
            >
              {missedCount} / 3
            </p>
          </div>
        </div>

        {/* Proof progress */}
        {isProving && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-none"
            style={{ background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)" }}
          >
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--primary)" }}>
                  {STEP_LABELS[proofStep]}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  All computation happens locally in your browser.
                </p>
              </div>
            </div>

            {/* Progress bar */}
            <div
              className="mt-3 h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--background)" }}
            >
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--primary)" }}
                animate={{
                  width:
                    proofStep === "loading_circuit"
                      ? "20%"
                      : proofStep === "computing_witness"
                        ? "40%"
                        : proofStep === "generating_proof"
                          ? "75%"
                          : "95%",
                }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </motion.div>
        )}

        {/* Success state */}
        {proofStep === "done" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6 p-4 rounded-none flex items-center gap-3"
            style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)" }}
          >
            <CheckCircle className="w-6 h-6 flex-shrink-0" style={{ color: "var(--success)" }} />
            <div>
              <p className="font-semibold" style={{ color: "var(--success)" }}>
                Check-in Successful
              </p>
              {txHash && (
                <a
                  href={`https://sepolia.starkscan.co/tx/${txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs underline"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  View on Starkscan
                </a>
              )}
            </div>
          </motion.div>
        )}

        {/* Check-in button */}
        <button
          onClick={handleCheckin}
          disabled={isProving || proofStep === "done" || !account}
          className="w-full py-4 rounded-none font-bold text-background flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
          style={{ background: "var(--primary)" }}
        >
          {isProving ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Proving...
            </>
          ) : proofStep === "done" ? (
            <>
              <CheckCircle className="w-5 h-5" />
              Done
            </>
          ) : !account ? (
            "Connect Wallet First"
          ) : (
            <>
              <Zap className="w-5 h-5" />
              Generate Proof & Check In
            </>
          )}
        </button>
      </div>

      {/* Info box */}
      <div
        className="p-6 rounded-none"
        style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
      >
        <h3 className="font-semibold mb-3">How this works</h3>
        <ol className="space-y-2 text-sm" style={{ color: "var(--muted-foreground)" }}>
          <li className="flex gap-2">
            <span className="font-bold" style={{ color: "var(--primary)" }}>1.</span>
            Your identity (stored locally) is used to generate a Noir ZK proof in your browser.
          </li>
          <li className="flex gap-2">
            <span className="font-bold" style={{ color: "var(--primary)" }}>2.</span>
            The proof proves you know the secret behind your identity commitment without revealing it.
          </li>
          <li className="flex gap-2">
            <span className="font-bold" style={{ color: "var(--primary)" }}>3.</span>
            The proof is submitted to the LivenessRegistry contract on Starknet.
          </li>
          <li className="flex gap-2">
            <span className="font-bold" style={{ color: "var(--primary)" }}>4.</span>
            Your missed-check-in counter resets. The vault stays locked.
          </li>
        </ol>
      </div>
    </div>
  );
}
