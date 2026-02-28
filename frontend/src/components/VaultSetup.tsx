"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useProvider } from "@starknet-react/core";
import {
  Shield,
  Key,
  Clock,
  Coins,
  Check,
  ChevronRight,
  Download,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  generateIdentity,
  storeIdentity,
  exportIdentityBackup,
  computeNullifierHash,
  getCurrentEpoch,
  type Identity,
} from "@/lib/identity";
import {
  registerVault,
  depositToVault,
  deriveVaultCommitment,
  CONTRACT_ADDRESSES,
} from "@/lib/contracts";
import type { Account } from "starknet";

// ---------------------------------------------------------------------------
// Step configuration
// ---------------------------------------------------------------------------
const STEPS = [
  { id: 1, title: "Generate Identity", icon: Key },
  { id: 2, title: "Configure Interval", icon: Clock },
  { id: 3, title: "Beneficiary Setup", icon: Shield },
  { id: 4, title: "Deposit Assets", icon: Coins },
];

const INTERVAL_OPTIONS = [
  { label: "Weekly", seconds: 7 * 24 * 3600, note: "7 days between check-ins" },
  { label: "Bi-weekly", seconds: 14 * 24 * 3600, note: "14 days between check-ins" },
  { label: "Monthly", seconds: 30 * 24 * 3600, note: "30 days between check-ins" },
  { label: "Quarterly", seconds: 90 * 24 * 3600, note: "90 days between check-ins" },
  { label: "Custom", seconds: 0, note: "Set your own interval" },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function VaultSetup() {
  const { account } = useAccount();
  const { provider } = useProvider();

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1 state
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [identityBackedUp, setIdentityBackedUp] = useState(false);

  // Step 2 state
  const [selectedInterval, setSelectedInterval] = useState(INTERVAL_OPTIONS[2]); // monthly default
  const [customInterval, setCustomInterval] = useState("");

  // Step 3 state
  const [beneficiaryKey, setBeneficiaryKey] = useState("");
  const [vaultSalt, setVaultSalt] = useState("");

  // Step 4 state
  const [tokenAddress, setTokenAddress] = useState(CONTRACT_ADDRESSES.STRK_TOKEN);
  const [depositAmount, setDepositAmount] = useState("");

  // ---------------------------------------------------------------------------
  // Step 1: Identity generation
  // ---------------------------------------------------------------------------
  const handleGenerateIdentity = async () => {
    setIsLoading(true);
    try {
      const id = await generateIdentity();
      setIdentity(id);
      storeIdentity(id);
      toast.success("Identity generated and saved locally.");
    } catch (err) {
      toast.error("Failed to generate identity.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportBackup = () => {
    if (!identity) return;
    exportIdentityBackup(identity);
    setIdentityBackedUp(true);
    toast.success("Identity backup downloaded.");
  };

  // ---------------------------------------------------------------------------
  // Step 4: Register + Deposit
  // ---------------------------------------------------------------------------
  const handleDeploy = async () => {
    if (!account || !identity) return;

    const intervalSeconds =
      selectedInterval.seconds > 0
        ? selectedInterval.seconds
        : parseInt(customInterval) * 3600;

    if (intervalSeconds < 86400) {
      toast.error("Interval must be at least 24 hours.");
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid deposit amount.");
      return;
    }

    // Parse beneficiary: we store the raw key as field elements
    const beneficiaryFields = beneficiaryKey
      .match(/.{1,62}/g)
      ?.map((chunk) => BigInt("0x" + Buffer.from(chunk, "utf8").toString("hex"))) ?? [];

    // Derive the salt from vaultSalt string
    const salt = vaultSalt
      ? BigInt("0x" + Buffer.from(vaultSalt, "utf8").toString("hex").slice(0, 62))
      : identity.nullifier;

    const vaultCommitment = deriveVaultCommitment(identity.commitment, salt);
    const epoch = getCurrentEpoch(intervalSeconds);
    const nullifierHash = await computeNullifierHash(identity.nullifier, epoch);
    const amountWei = BigInt(Math.floor(amount * 1e18));

    setIsLoading(true);
    try {
      // 1. Register identity on-chain
      toast.loading("Registering identity on Starknet...", { id: "deploy" });
      await registerVault(account as Account, {
        identityCommitment: identity.commitment,
        vaultCommitment,
        intervalSeconds,
        nullifierHash,
      });

      // 2. Deposit tokens
      toast.loading("Depositing tokens to vault...", { id: "deploy" });
      await depositToVault(account as Account, {
        vaultCommitment,
        encryptedBeneficiary: beneficiaryFields,
        token: tokenAddress,
        amount: amountWei,
      });

      toast.success("Vault deployed successfully!", { id: "deploy" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      toast.error(`Deployment failed: ${msg}`, { id: "deploy" });
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return identity !== null && identityBackedUp;
      case 2: return selectedInterval.seconds > 0 || parseInt(customInterval) >= 24;
      case 3: return beneficiaryKey.length > 0;
      case 4: return parseFloat(depositAmount) > 0;
      default: return false;
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-10">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all"
                style={{
                  background:
                    currentStep > step.id
                      ? "var(--success)"
                      : currentStep === step.id
                      ? "var(--primary)"
                      : "var(--card)",
                  border:
                    currentStep === step.id
                      ? "2px solid var(--primary)"
                      : "2px solid var(--card-border)",
                  color: currentStep >= step.id ? "white" : "var(--muted-foreground)",
                }}
              >
                {currentStep > step.id ? (
                  <Check className="w-5 h-5" />
                ) : (
                  step.id
                )}
              </div>
              <span
                className="text-xs mt-2 font-medium hidden sm:block"
                style={{
                  color: currentStep === step.id ? "var(--foreground)" : "var(--muted-foreground)",
                }}
              >
                {step.title}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-3"
                style={{
                  background: currentStep > step.id ? "var(--success)" : "var(--card-border)",
                  minWidth: "40px",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.25 }}
          className="p-8 rounded-2xl"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          {/* Step 1: Identity */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Generate Your Identity</h2>
              <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
                A Semaphore identity is a cryptographic keypair stored only in your browser.
                You will use it to generate ZK proofs without revealing your identity on-chain.
              </p>

              {!identity ? (
                <button
                  onClick={handleGenerateIdentity}
                  disabled={isLoading}
                  className="w-full py-4 rounded-xl font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ background: "var(--primary)" }}
                >
                  <Key className="w-5 h-5" />
                  {isLoading ? "Generating..." : "Generate Identity"}
                </button>
              ) : (
                <div>
                  <div
                    className="p-4 rounded-xl mb-4"
                    style={{ background: "var(--background)", border: "1px solid var(--card-border)" }}
                  >
                    <p className="text-xs font-mono mb-1" style={{ color: "var(--muted-foreground)" }}>
                      Identity Commitment (public)
                    </p>
                    <p className="text-sm font-mono break-all">
                      0x{identity.commitment.toString(16).padStart(64, "0")}
                    </p>
                  </div>

                  <div
                    className="flex items-start gap-3 p-4 rounded-xl mb-6"
                    style={{
                      background: "rgba(245,158,11,0.1)",
                      border: "1px solid rgba(245,158,11,0.3)",
                    }}
                  >
                    <AlertTriangle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "var(--accent)" }} />
                    <p className="text-sm" style={{ color: "var(--accent)" }}>
                      <strong>Critical:</strong> Download your identity backup now. If you lose it,
                      you cannot prove liveness and your vault will activate after missed check-ins.
                    </p>
                  </div>

                  <button
                    onClick={handleExportBackup}
                    className="w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
                    style={{
                      background: identityBackedUp ? "rgba(34,197,94,0.15)" : "var(--accent)",
                      color: identityBackedUp ? "var(--success)" : "var(--background)",
                      border: identityBackedUp ? "1px solid var(--success)" : "none",
                    }}
                  >
                    {identityBackedUp ? (
                      <>
                        <Check className="w-4 h-4" /> Backup Downloaded
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" /> Download Identity Backup
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Interval */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Configure Check-in Interval</h2>
              <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
                How often do you want to check in? After missing 3 consecutive intervals
                (plus a 24-hour grace period), your vault will activate.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-6">
                {INTERVAL_OPTIONS.filter((o) => o.seconds > 0).map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setSelectedInterval(opt)}
                    className="p-4 rounded-xl text-left transition-all"
                    style={{
                      background:
                        selectedInterval.label === opt.label
                          ? "rgba(124,58,237,0.15)"
                          : "var(--background)",
                      border:
                        selectedInterval.label === opt.label
                          ? "2px solid var(--primary)"
                          : "2px solid var(--card-border)",
                    }}
                  >
                    <div className="font-semibold">{opt.label}</div>
                    <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                      {opt.note}
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block" style={{ color: "var(--muted-foreground)" }}>
                  Custom interval (hours)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 168 (7 days)"
                  value={customInterval}
                  onChange={(e) => {
                    setCustomInterval(e.target.value);
                    setSelectedInterval(INTERVAL_OPTIONS[4]);
                  }}
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{
                    background: "var(--background)",
                    border: "1px solid var(--card-border)",
                    color: "var(--foreground)",
                    outline: "none",
                  }}
                />
              </div>
            </div>
          )}

          {/* Step 3: Beneficiary */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Setup Beneficiary</h2>
              <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
                Enter your beneficiary&apos;s claim key — this can be their Starknet address,
                a shared secret, or a public key. It will be stored encrypted on-chain.
                Share the corresponding private key with them off-band.
              </p>

              <div className="mb-6">
                <label className="text-sm font-medium mb-2 block">
                  Beneficiary Claim Key
                </label>
                <input
                  type="text"
                  placeholder="0x... or email or any identifier"
                  value={beneficiaryKey}
                  onChange={(e) => setBeneficiaryKey(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm font-mono"
                  style={{
                    background: "var(--background)",
                    border: "1px solid var(--card-border)",
                    color: "var(--foreground)",
                    outline: "none",
                  }}
                />
                <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>
                  This is stored encrypted on-chain. Only someone with the matching private
                  key can claim the vault.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Vault Salt (optional, for extra privacy)
                </label>
                <input
                  type="text"
                  placeholder="Random salt to randomize vault commitment"
                  value={vaultSalt}
                  onChange={(e) => setVaultSalt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{
                    background: "var(--background)",
                    border: "1px solid var(--card-border)",
                    color: "var(--foreground)",
                    outline: "none",
                  }}
                />
                <p className="text-xs mt-2" style={{ color: "var(--muted-foreground)" }}>
                  Share this salt with your beneficiary so they can locate your vault.
                </p>
              </div>
            </div>
          )}

          {/* Step 4: Deposit */}
          {currentStep === 4 && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Deposit Assets</h2>
              <p className="mb-6" style={{ color: "var(--muted-foreground)" }}>
                Deposit tokens into your vault. These will be transferred to your beneficiary
                when the vault activates. A 0.1% protocol fee applies.
              </p>

              <div className="mb-4">
                <label className="text-sm font-medium mb-2 block">Token Contract Address</label>
                <input
                  type="text"
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm font-mono"
                  style={{
                    background: "var(--background)",
                    border: "1px solid var(--card-border)",
                    color: "var(--foreground)",
                    outline: "none",
                  }}
                />
              </div>

              <div className="mb-8">
                <label className="text-sm font-medium mb-2 block">
                  Amount (in token units, e.g. STRK)
                </label>
                <input
                  type="number"
                  placeholder="100"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl text-sm"
                  style={{
                    background: "var(--background)",
                    border: "1px solid var(--card-border)",
                    color: "var(--foreground)",
                    outline: "none",
                  }}
                />
                {depositAmount && parseFloat(depositAmount) > 0 && (
                  <p className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
                    Net deposit after 0.1% fee:{" "}
                    {(parseFloat(depositAmount) * 0.999).toFixed(4)} tokens
                  </p>
                )}
              </div>

              <button
                onClick={handleDeploy}
                disabled={isLoading || !account}
                className="w-full py-4 rounded-xl font-bold text-white transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--primary)" }}
              >
                {isLoading
                  ? "Deploying..."
                  : !account
                  ? "Connect Wallet First"
                  : "Deploy Vault on Starknet"}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
          disabled={currentStep === 1}
          className="px-6 py-3 rounded-xl font-medium transition-all hover:opacity-80 disabled:opacity-30"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          Back
        </button>

        {currentStep < 4 && (
          <button
            onClick={() => setCurrentStep((s) => Math.min(4, s + 1))}
            disabled={!canProceed()}
            className="px-6 py-3 rounded-xl font-semibold text-white flex items-center gap-2 transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "var(--primary)" }}
          >
            Continue
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
