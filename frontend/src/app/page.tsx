"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Shield,
  Clock,
  Key,
  Zap,
  Lock,
  Eye,
  ArrowRight,
  Github,
} from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";

const features = [
  {
    icon: Shield,
    title: "Zero-Knowledge Liveness",
    description:
      "Prove you're alive without revealing your identity. Semaphore-based ZK proofs keep your check-ins completely private.",
  },
  {
    icon: Clock,
    title: "Configurable Dead Man Switch",
    description:
      "Set your own check-in interval (weekly, monthly, quarterly). Miss N consecutive intervals and your vault activates automatically.",
  },
  {
    icon: Key,
    title: "Private Beneficiary",
    description:
      "Your beneficiary's identity is encrypted on-chain. Only they can claim using the secret you shared off-chain.",
  },
  {
    icon: Zap,
    title: "Keeper Network",
    description:
      "Staked keepers monitor deadlines and earn rewards for reporting missed check-ins. Fully decentralized automation.",
  },
  {
    icon: Lock,
    title: "Non-Custodial",
    description:
      "Funds stay in smart contracts. No intermediaries. No counterparty risk. Your keys, your crypto, your rules.",
  },
  {
    icon: Eye,
    title: "Starknet Native",
    description:
      "Built on Starknet for cheap ZK proof verification, fast finality, and native Cairo contract composability.",
  },
];

const steps = [
  {
    step: "01",
    title: "Generate Identity",
    description:
      "Create a Semaphore identity (secret + nullifier). Store it securely — this is your proof key.",
  },
  {
    step: "02",
    title: "Configure Vault",
    description:
      "Set your check-in interval, deposit assets, and provide your beneficiary's encrypted claim key.",
  },
  {
    step: "03",
    title: "Check In Periodically",
    description:
      "Generate a ZK proof locally in your browser. Submit it on-chain to prove you're alive.",
  },
  {
    step: "04",
    title: "Automatic Inheritance",
    description:
      "If you miss N check-ins, your vault activates. Your beneficiary claims with their private key.",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Navigation */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4"
        style={{
          background: "rgba(10,10,15,0.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--card-border)",
        }}
      >
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6" style={{ color: "var(--primary)" }} />
          <span className="font-bold text-lg tracking-tight">Thanatos</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <Link href="/dashboard" className="text-sm opacity-70 hover:opacity-100 transition-opacity">
            Dashboard
          </Link>
          <Link href="/setup" className="text-sm opacity-70 hover:opacity-100 transition-opacity">
            Setup Vault
          </Link>
          <Link href="/claim" className="text-sm opacity-70 hover:opacity-100 transition-opacity">
            Claim
          </Link>
          <a
            href="https://github.com/thanatos-protocol"
            target="_blank"
            rel="noreferrer"
            className="opacity-70 hover:opacity-100 transition-opacity"
          >
            <Github className="w-4 h-4" />
          </a>
        </div>
        <ConnectWallet />
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 pt-20">
        {/* Background glow */}
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: "radial-gradient(circle, #7c3aed, transparent)" }}
        />

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
            style={{
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.3)",
              color: "var(--primary)",
            }}
          >
            <Zap className="w-3 h-3" />
            Built on Starknet &bull; ZK-Powered &bull; Fully Private
          </div>

          <h1 className="text-5xl md:text-7xl font-black tracking-tight mb-6 leading-none">
            Your crypto.
            <br />
            <span style={{ color: "var(--primary)" }}>Your heirs.</span>
            <br />
            No one else.
          </h1>

          <p
            className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed"
            style={{ color: "var(--muted-foreground)" }}
          >
            Thanatos Protocol is a zero-knowledge dead man&apos;s switch for private crypto
            inheritance. Prove you&apos;re alive with ZK proofs. Disappear, and your vault
            automatically unlocks for your chosen beneficiary — without ever revealing their
            identity on-chain.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/setup"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold text-white transition-all hover:scale-105"
              style={{ background: "var(--primary)" }}
            >
              Setup Your Vault
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/claim"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold transition-all hover:scale-105"
              style={{
                background: "var(--card)",
                border: "1px solid var(--card-border)",
              }}
            >
              Claim as Beneficiary
            </Link>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-8"
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{ color: "var(--muted)" }}
        >
          <div className="w-5 h-8 rounded-full border-2 flex items-start justify-center p-1" style={{ borderColor: "var(--muted)" }}>
            <div className="w-1 h-2 rounded-full" style={{ background: "var(--muted)" }} />
          </div>
        </motion.div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p style={{ color: "var(--muted-foreground)" }}>
              Four steps to trustless inheritance.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="relative p-6 rounded-2xl"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--card-border)",
                }}
              >
                <div
                  className="text-4xl font-black mb-4 opacity-20"
                  style={{ color: "var(--primary)" }}
                >
                  {item.step}
                </div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-6" style={{ background: "var(--card)" }}>
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold mb-4">Why Thanatos?</h2>
            <p style={{ color: "var(--muted-foreground)" }}>
              Privacy-preserving inheritance, built from first principles.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="p-6 rounded-2xl"
                style={{
                  background: "var(--background)",
                  border: "1px solid var(--card-border)",
                }}
              >
                <feature.icon
                  className="w-8 h-8 mb-4"
                  style={{ color: "var(--primary)" }}
                />
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto"
        >
          <h2 className="text-4xl font-bold mb-4">Ready to secure your legacy?</h2>
          <p className="mb-10" style={{ color: "var(--muted-foreground)" }}>
            Join the future of trustless, private crypto inheritance. No custody. No compromise.
          </p>
          <Link
            href="/setup"
            className="inline-flex items-center gap-2 px-10 py-5 rounded-xl font-bold text-lg text-white transition-all hover:scale-105"
            style={{ background: "var(--primary)" }}
          >
            Get Started — It&apos;s Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer
        className="py-8 px-6 text-center text-sm"
        style={{
          borderTop: "1px solid var(--card-border)",
          color: "var(--muted-foreground)",
        }}
      >
        <div className="flex items-center justify-center gap-2 mb-2">
          <Shield className="w-4 h-4" style={{ color: "var(--primary)" }} />
          <span className="font-semibold" style={{ color: "var(--foreground)" }}>
            Thanatos Protocol
          </span>
        </div>
        <p>Open source. Trustless. Forever.</p>
        <p className="mt-1 opacity-50">
          Smart contracts are unaudited. Use at your own risk on testnet first.
        </p>
      </footer>
    </div>
  );
}
