"use client";

import { Shield } from "lucide-react";
import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";
import { VaultSetup } from "@/components/VaultSetup";

export default function SetupPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <main className="max-w-3xl mx-auto px-6 pt-32 pb-16">
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
