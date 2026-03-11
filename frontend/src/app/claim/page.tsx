"use client";

import { Shield } from "lucide-react";
import Link from "next/link";
import { ConnectWallet } from "@/components/ConnectWallet";
import { BeneficiaryClaim } from "@/components/BeneficiaryClaim";

export default function ClaimPage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <main className="max-w-3xl mx-auto px-6 pt-32 pb-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-black mb-4">Claim Inheritance</h1>
          <p style={{ color: "var(--muted-foreground)" }}>
            If you have been designated as a beneficiary and the vault has activated,
            claim your inheritance here.
          </p>
        </div>

        <BeneficiaryClaim />
      </main>
    </div>
  );
}
