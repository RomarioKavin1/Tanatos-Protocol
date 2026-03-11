"use client";

import { Shield } from "lucide-react";
import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";
import { VaultSetup } from "@/components/VaultSetup";

export default function SetupPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Nav */}
      <nav
        className="flex items-center justify-between px-6 py-4"
        style={{
          borderBottom: "1px solid var(--card-border)",
          background: "rgba(10,10,15,0.8)",
          backdropFilter: "blur(12px)",
        }}
      >
        <Link href="/" className="flex items-center gap-2">
          <Shield className="w-6 h-6" style={{ color: "var(--primary)" }} />
          <span className="font-bold text-lg tracking-tight">Thanatos</span>
        </Link>
        <ConnectWallet />
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black mb-4">Setup Your Vault</h1>
          <p style={{ color: "var(--muted-foreground)" }}>
            Follow the steps below to configure your dead man's switch and deploy your
            inheritance vault on Starknet.
          </p>
        </div>

        <VaultSetup />
      </main>
    </div>
  );
}
