"use client";

import { useAccount, useConnect, useDisconnect } from "@starknet-react/core";
import { useState } from "react";
import { Wallet, ChevronDown, LogOut, Copy, Check } from "lucide-react";
import { shortenAddress } from "@/lib/starknet";
import { clsx } from "clsx";

export function ConnectWallet() {
  const { account, address, status } = useAccount();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const [showMenu, setShowMenu] = useState(false);
  const [showConnectors, setShowConnectors] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === "connected" && address) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-2 px-4 py-2 rounded-none text-sm font-medium transition-all hover:opacity-90"
          style={{
            background: "var(--card)",
            border: "1px solid var(--card-border)",
          }}
        >
          <div
            className="w-2 h-2 rounded-full"
            style={{ background: "var(--success)" }}
          />
          {shortenAddress(address)}
          <ChevronDown
            className={clsx("w-3 h-3 transition-transform", showMenu && "rotate-180")}
          />
        </button>

        {showMenu && (
          <div
            className="absolute right-0 top-12 w-52 rounded-none overflow-hidden shadow-xl z-50"
            style={{
              background: "var(--card)",
              border: "1px solid var(--card-border)",
            }}
          >
            <button
              onClick={handleCopyAddress}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:opacity-80 transition-opacity"
            >
              {copied ? (
                <Check className="w-4 h-4" style={{ color: "var(--success)" }} />
              ) : (
                <Copy className="w-4 h-4" style={{ color: "var(--muted-foreground)" }} />
              )}
              {copied ? "Copied!" : "Copy address"}
            </button>
            <div
              style={{ height: "1px", background: "var(--card-border)" }}
            />
            <button
              onClick={() => {
                disconnect();
                setShowMenu(false);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:opacity-80 transition-opacity"
              style={{ color: "var(--destructive)" }}
            >
              <LogOut className="w-4 h-4" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowConnectors(!showConnectors)}
        disabled={isConnecting}
        className="flex items-center gap-2 px-4 py-2 rounded-none text-sm font-semibold text-background transition-all hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--primary)" }}
      >
        <Wallet className="w-4 h-4" />
        {isConnecting ? "Connecting..." : "Connect Wallet"}
      </button>

      {showConnectors && (
        <div
          className="absolute right-0 top-12 w-52 rounded-none overflow-hidden shadow-xl z-50"
          style={{
            background: "var(--card)",
            border: "1px solid var(--card-border)",
          }}
        >
          <div className="px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--muted-foreground)" }}>
              Choose Wallet
            </p>
          </div>
          {connectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => {
                connect({ connector });
                setShowConnectors(false);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 text-sm text-left hover:opacity-80 transition-opacity"
            >
              {connector.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={
                    typeof connector.icon === "string"
                      ? connector.icon
                      : (connector.icon as { light?: string })?.light ?? ""
                  }
                  alt={connector.name}
                  className="w-5 h-5 rounded"
                />
              ) : (
                <Wallet className="w-5 h-5" style={{ color: "var(--primary)" }} />
              )}
              {connector.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
