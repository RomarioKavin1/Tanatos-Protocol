"use client";

import { Shield } from "lucide-react";
import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";
import { CheckIn } from "@/components/CheckIn";

export default function CheckInPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <main className="max-w-3xl mx-auto px-6 pt-32 pb-16">
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
