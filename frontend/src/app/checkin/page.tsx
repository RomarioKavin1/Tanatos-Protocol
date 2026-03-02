"use client";

import { Shield } from "lucide-react";
import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";
import { CheckIn } from "@/components/CheckIn";

export default function CheckInPage() {
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
          <h1 className="text-4xl font-black mb-4">Prove You're Alive</h1>
          <p style={{ color: "var(--muted-foreground)" }}>
            Generate a zero-knowledge liveness proof in your browser and submit it on-chain.
            No personal data is revealed.
          </p>
        </div>

        <CheckIn />
      </main>
    </div>
  );
}
