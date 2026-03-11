"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useProvider } from "@starknet-react/core";
import {
  Shield,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Zap,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";
import {
  loadIdentity,
  getEpochDeadline,
  type Identity,
} from "@/lib/identity";
import {
  getLastCheckin,
  getMissedCount,
  isVaultActivated,
  getGroupRoot,
  getCheckinInterval,
} from "@/lib/contracts";
import { formatTimeRemaining } from "@/lib/starknet";

// Default 30-day interval — configurable
const DEFAULT_INTERVAL = 30 * 24 * 3600;

interface VaultStatus {
  lastCheckin: number;
  missedCount: number;
  isActivated: boolean;
  groupRoot: string;
  deadline: number;
}

export default function DashboardPage() {
  const { provider } = useProvider();
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [intervalSeconds, setIntervalSeconds] = useState(DEFAULT_INTERVAL);
  const [timeNow, setTimeNow] = useState(Date.now());

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTimeNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load identity on mount
  useEffect(() => {
    const id = loadIdentity();
    setIdentity(id);
  }, []);

  const fetchStatus = async () => {
    if (!identity || !provider) return;
    setIsLoading(true);

    try {
      const [lastCheckin, missedCount, activated, rootRaw, intervalResult] =
        await Promise.allSettled([
          getLastCheckin(provider, identity.commitment),
          getMissedCount(provider, identity.commitment),
          isVaultActivated(provider, identity.commitment),
          getGroupRoot(provider),
          getCheckinInterval(provider, identity.commitment),
        ]);

      // Update interval from chain if available
      if (intervalResult.status === "fulfilled" && intervalResult.value > 0) {
        setIntervalSeconds(intervalResult.value);
      }

      setStatus({
        lastCheckin: lastCheckin.status === "fulfilled" ? lastCheckin.value : 0,
        missedCount: missedCount.status === "fulfilled" ? missedCount.value : 0,
        isActivated: activated.status === "fulfilled" ? activated.value : false,
        groupRoot:
          rootRaw.status === "fulfilled"
            ? "0x" + rootRaw.value.toString(16).padStart(64, "0")
            : "N/A",
        deadline: getEpochDeadline(intervalSeconds),
      });
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Failed to fetch vault status:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (identity && provider) {
      fetchStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, provider]);

  const deadlineMs = status ? status.deadline * 1000 : null;
  const isUrgent = deadlineMs ? deadlineMs - timeNow < 3 * 24 * 3600 * 1000 : false;
  const isOverdue = deadlineMs ? deadlineMs - timeNow < 0 : false;

  if (!identity) {
    return (
      <div className="min-h-screen pt-24" style={{ background: "var(--background)" }}>
        <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
          <Shield className="w-16 h-16 mb-6" style={{ color: "var(--muted)" }} />
          <h2 className="text-2xl font-bold mb-4">No Vault Found</h2>
          <p className="mb-8" style={{ color: "var(--muted-foreground)" }}>
            You haven&apos;t set up a vault yet, or your identity is not stored on this device.
          </p>
          <Link
            href="/setup"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-none font-semibold text-background"
            style={{ background: "var(--primary)" }}
          >
            Setup Your Vault
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <main className="max-w-4xl mx-auto px-6 pt-32 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-black mb-1">Vault Dashboard</h1>
            <p style={{ color: "var(--muted-foreground)" }}>
              Monitor your dead man&apos;s switch status
            </p>
          </div>
          <button
            onClick={fetchStatus}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-none text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* Status alert */}
        {status?.isActivated && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-5 rounded-none mb-8"
            style={{ background: "rgba(239,68,68,0.1)", border: "2px solid var(--destructive)" }}
          >
            <XCircle className="w-6 h-6 mt-0.5 flex-shrink-0" style={{ color: "var(--destructive)" }} />
            <div>
              <p className="font-bold text-lg" style={{ color: "var(--destructive)" }}>
                VAULT ACTIVATED
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                Your vault has been activated. If this was not intentional, contact your
                beneficiary immediately to discuss the claim.
              </p>
            </div>
          </motion.div>
        )}

        {isOverdue && !status?.isActivated && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-5 rounded-none mb-8"
            style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.5)" }}
          >
            <AlertTriangle className="w-6 h-6 mt-0.5 flex-shrink-0" style={{ color: "var(--destructive)" }} />
            <div>
              <p className="font-bold" style={{ color: "var(--destructive)" }}>
                Check-in Overdue!
              </p>
              <p className="text-sm mt-1" style={{ color: "var(--muted-foreground)" }}>
                You have missed your check-in deadline. Check in immediately to prevent vault
                activation.
              </p>
            </div>
          </motion.div>
        )}

        {/* Main status grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {/* Deadline card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="md:col-span-2 p-6 rounded-none"
            style={{
              background: "var(--card)",
              border: `1px solid ${isOverdue ? "var(--destructive)" : isUrgent ? "rgba(245,158,11,0.5)" : "var(--card-border)"}`,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock
                className="w-5 h-5"
                style={{ color: isOverdue ? "var(--destructive)" : isUrgent ? "var(--accent)" : "var(--primary)" }}
              />
              <span className="text-sm font-medium" style={{ color: "var(--muted-foreground)" }}>
                Next Check-in Deadline
              </span>
            </div>
            <p
              className="text-4xl font-black mb-1"
              style={{
                color: isOverdue
                  ? "var(--destructive)"
                  : isUrgent
                    ? "var(--accent)"
                    : "var(--foreground)",
              }}
            >
              {status ? formatTimeRemaining(status.deadline) : "--"}
            </p>
            {status && (
              <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                Deadline: {new Date(status.deadline * 1000).toLocaleString()}
              </p>
            )}
          </motion.div>

          {/* Vault status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-6 rounded-none flex flex-col justify-between"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-sm font-medium mb-3" style={{ color: "var(--muted-foreground)" }}>
              Vault Status
            </p>
            {status?.isActivated ? (
              <div className="flex items-center gap-2">
                <XCircle className="w-6 h-6" style={{ color: "var(--destructive)" }} />
                <span className="font-bold text-lg" style={{ color: "var(--destructive)" }}>
                  ACTIVATED
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CheckCircle className="w-6 h-6" style={{ color: "var(--success)" }} />
                <span className="font-bold text-lg" style={{ color: "var(--success)" }}>
                  SECURE
                </span>
              </div>
            )}
          </motion.div>
        </div>

        {/* Secondary stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div
            className="p-6 rounded-none"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
              Last Check-in
            </p>
            <p className="text-xl font-bold">
              {status?.lastCheckin
                ? new Date(status.lastCheckin * 1000).toLocaleDateString()
                : "N/A"}
            </p>
          </div>

          <div
            className="p-6 rounded-none"
            style={{
              background: "var(--card)",
              border: `1px solid ${(status?.missedCount ?? 0) > 0 ? "rgba(239,68,68,0.4)" : "var(--card-border)"}`,
            }}
          >
            <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
              Consecutive Misses
            </p>
            <p
              className="text-3xl font-black"
              style={{ color: (status?.missedCount ?? 0) > 0 ? "var(--destructive)" : "var(--success)" }}
            >
              {status?.missedCount ?? 0}
              <span className="text-lg font-normal" style={{ color: "var(--muted-foreground)" }}>
                {" "}/ 3
              </span>
            </p>
          </div>

          <div
            className="p-6 rounded-none"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
              Group Root
            </p>
            <p className="text-sm font-mono break-all opacity-60">
              {status?.groupRoot?.slice(0, 18)}...
            </p>
          </div>
        </div>

        {/* Identity info */}
        <div
          className="p-6 rounded-none mb-8"
          style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
        >
          <h3 className="font-semibold mb-4">Identity Information</h3>
          <div>
            <p className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
              Identity Commitment (public)
            </p>
            <p className="text-xs font-mono break-all opacity-70">
              0x{identity.commitment.toString(16).padStart(64, "0")}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/checkin"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-none font-bold text-background transition-all hover:opacity-90"
            style={{ background: "var(--primary)" }}
          >
            <Zap className="w-5 h-5" />
            Check In Now
          </Link>
          <Link
            href="/setup"
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 rounded-none font-medium transition-all hover:opacity-80"
            style={{ background: "var(--card)", border: "1px solid var(--card-border)" }}
          >
            Manage Vault Settings
          </Link>
        </div>

        {lastRefresh && (
          <p className="text-xs text-center mt-4" style={{ color: "var(--muted)" }}>
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        )}
      </main>
    </div>
  );
}
