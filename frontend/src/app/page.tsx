"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Github, Code, ArrowUpRight } from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";

const features = [
  {
    title: "Elysian Privacy",
    description:
      "Cairo-native Semaphore ZK proofs. Check-ins are cryptographically unlinkable — no wallet address on-chain, no correlation possible across epochs.",
  },
  {
    title: "The River Styx",
    description:
      "Funds flow through Cairo smart contracts on Starknet. Beneficiary identity is sealed under a Poseidon commitment until the moment of claim.",
  },
  {
    title: "Hypnos' Threshold",
    description:
      "Epoch-bound nullifiers prevent replay. Each check-in period is cryptographically unique. Three misses triggers irreversible vault activation.",
  },
  {
    title: "Obol Distribution",
    description:
      "A Noir circuit, compiled to UltraHonk and verified on-chain by Garaga. Every proof is verified by the chain itself. No oracle. No trust.",
  },
];

const steps = [
  {
    step: "[01]",
    title: "SEVERANCE.",
    description: "Generate a Semaphore identity in your browser. The commitment is public; the secret never leaves your device.",
  },
  {
    step: "[02]",
    title: "PACT.",
    description: "Deposit assets into your Cairo vault. The beneficiary address is sealed under a Poseidon hash — invisible on-chain until claim.",
  },
  {
    step: "[03]",
    title: "PULSE.",
    description: "Prove you exist with a Noir ZK proof. Barretenberg generates it in-browser; Garaga's Cairo verifier confirms it on Starknet.",
  },
  {
    step: "[04]",
    title: "SILENCE.",
    description: "When the proofs stop, the vault unlocks. Cairo enforces the transfer. No lawyers. No multisig. No human in the loop.",
  },
];

const stack = [
  { label: "SEMAPHORE", sub: "Cairo-native group membership" },
  { label: "NOIR", sub: "Client-side ZK circuit" },
  { label: "GARAGA", sub: "On-chain UltraHonk verifier" },
  { label: "STARKNET", sub: "Cairo smart contracts" },
];

export default function HomePage() {
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, 50]);

  return (
    <div className="min-h-screen relative text-foreground font-sans selection:bg-foreground selection:text-background">
      {/* Noise Overlay */}
      <div className="bg-noise" />

      {/* Hero Section */}
      <motion.section
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative flex flex-col justify-center min-h-screen px-6 pt-32 pb-12"
      >
        <div className="w-full h-full flex flex-col justify-between max-w-7xl mx-auto">

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-end mb-24">
            <div className="md:col-span-8">
              <h1 className="text-6xl md:text-[7rem] font-bold tracking-tighter leading-[0.9] uppercase">
                Zero<br />
                Knowledge<br />
                Legacy.
              </h1>
            </div>
            <div className="md:col-span-4 pb-4 flex flex-col items-start gap-6">
              <div className="w-12 h-[1px] bg-foreground" />
              <p className="text-xs font-mono text-muted-foreground uppercase leading-relaxed max-w-xs">
                A trustless dead man's switch.
                Prove liveness cryptographically.
                Pass on assets silently.
              </p>
            </div>
          </div>

          {/* Brutalist Abstract Hero Imagery */}
          <div className="w-full relative h-[40vh] md:h-[50vh] bg-card overflow-hidden border border-card-border flex items-center justify-center group cursor-pointer">
            <div className="absolute inset-0 bg-noise opacity-10 mix-blend-overlay pointer-events-none" />

            {/* Glitching/Offset Geometry representing "Severance" */}
            <div className="relative w-full h-full flex items-center justify-center perspective-[1000px]">

              {/* Back Layer - Ghosted/Echo */}
              <motion.div
                initial={{ rotateX: 20, rotateY: -10, scale: 0.9, opacity: 0 }}
                animate={{ rotateX: 0, rotateY: 0, scale: 1, opacity: 0.2 }}
                transition={{ duration: 2, ease: "easeOut", delay: 0.2 }}
                className="absolute w-48 h-64 md:w-64 md:h-80 border-2 border-foreground bg-transparent -ml-16 -mt-8"
              />

              {/* Middle Layer - Solid Void */}
              <motion.div
                initial={{ rotateX: -10, rotateY: 20, y: 50, opacity: 0 }}
                animate={{ rotateX: 0, rotateY: 0, y: 0, opacity: 1 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="absolute w-48 h-64 md:w-64 md:h-80 bg-foreground border border-foreground flex items-center justify-center shadow-2xl z-10 overflow-hidden"
              >
                {/* Slanted Cut / Severance Line */}
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "200%" }}
                  transition={{ duration: 3, ease: "easeInOut", repeat: Infinity, repeatDelay: 5 }}
                  className="absolute w-1 h-[150%] bg-background rotate-45"
                />
              </motion.div>

              {/* Front Layer - Glitch Frame */}
              <motion.div
                initial={{ scale: 1.1, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 1, ease: "easeIn", delay: 0.5 }}
                className="absolute w-48 h-64 md:w-64 md:h-80 border-2 border-background mix-blend-difference ml-12 mt-12 z-20"
              />

              {/* Floating Debris/Fragments */}
              <motion.div
                animate={{ y: [-10, 10, -10], rotate: [0, 90, 0] }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute w-8 h-8 bg-foreground/50 border border-foreground right-[15%] top-[20%]"
              />
              <motion.div
                animate={{ y: [15, -15, 15], rotate: [45, -45, 45] }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute w-12 h-12 bg-transparent border-2 border-foreground/30 left-[20%] bottom-[25%]"
              />
            </div>

            {/* Technical Identifier */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 1 }}
              className="absolute bottom-6 right-6 flex flex-col items-end"
            >
              <span className="text-xs font-mono font-bold tracking-widest text-foreground uppercase mix-blend-difference">
                PROTOCOL.SEVERANCE // TRUTH
              </span>
              <span className="text-[10px] font-mono tracking-widest text-muted-foreground uppercase">
                ZKP_STATE: UNKNOWN
              </span>
            </motion.div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 left-6 flex items-center gap-4 text-xs font-mono uppercase text-muted-foreground">
          <motion.div
            animate={{ x: [0, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
          >
            <ArrowRight className="w-4 h-4" />
          </motion.div>
          <span>Scroll to uncover</span>
        </div>
      </motion.section>

      {/* Ticker Tape */}
      <div className="w-full bg-foreground text-background py-3 overflow-hidden border-y border-foreground flex relative">
        <motion.div
          animate={{ x: [0, -1035] }}
          transition={{ ease: "linear", duration: 15, repeat: Infinity }}
          className="flex whitespace-nowrap gap-12 text-sm font-bold tracking-[0.2em] uppercase items-center"
        >
          {Array(10).fill(0).map((_, i) => (
            <span key={i} className="flex items-center gap-12">
              <span>MEMENTO MORI</span>
              <span className="w-1.5 h-1.5 bg-background rounded-full" />
              <span>TRUSTLESS EXECUTION</span>
              <span className="w-1.5 h-1.5 bg-background rounded-full" />
            </span>
          ))}
        </motion.div>
      </div>

      {/* Statement Section */}
      <section className="py-24 px-6 border-t border-card-border bg-card relative overflow-hidden">
        {/* Large subtle background text */}
        <div className="absolute -top-10 -right-10 text-[15rem] md:text-[20rem] font-black text-foreground/[0.02] tracking-tighter leading-none select-none pointer-events-none z-0">
          Θάνατος
        </div>

        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 relative z-10">
          <div>
            <span className="text-xs font-mono uppercase text-muted-foreground block mb-8">
              [01] Immutable Wills.
            </span>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
              A Trustless Dead Man's Switch.
            </h2>
            <Link href="/setup">
              <button className="mt-12 group flex items-center gap-4 text-xs font-mono uppercase border-b border-foreground pb-2 hover:text-muted-foreground hover:border-muted-foreground transition-all">
                Enter The Vault
                <ArrowUpRight className="w-4 h-4 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
              </button>
            </Link>
          </div>
          <div className="flex flex-col justify-end">
            <p className="text-muted-foreground text-lg leading-relaxed">
              For Thanatos, death wasn't violent; it was an inevitable, peaceful transition. Our protocol mimics this silence. Prove you exist periodically via Semaphore ZK circuits. Once the proofs cease, your encrypted assets flow securely across the river Styx to your chosen heir. No intermediaries required.
            </p>
          </div>
        </div>
      </section>

      {/* Tech Stack Strip */}
      <section className="border-t border-card-border">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-card-border border-b border-card-border">
          {stack.map((item, i) => (
            <div key={i} className="p-6 flex flex-col gap-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase">
                BUILT WITH {i + 1}/{stack.length}
              </span>
              <span className="text-lg font-black tracking-tighter uppercase">{item.label}</span>
              <span className="text-xs text-muted-foreground font-mono">{item.sub}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Grid Features */}
      <section className="py-0 border-t border-card-border">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-card-border border-b border-card-border">
          {features.map((feature, i) => (
            <div key={i} className="p-8 pb-12 brutal-panel group">
              <span className="text-[10px] font-mono text-muted-foreground mb-12 block">
                --- FEATURE {i + 1}
              </span>
              <h3 className="text-xl font-bold mb-4 uppercase tracking-tight">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-32 px-6">
        <div className="max-w-7xl mx-auto">
          <span className="text-xs font-mono uppercase text-muted-foreground block mb-12">
            [02] The Sequence
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-24">
            {steps.map((item, i) => (
              <div key={i} className="border-t border-card-border pt-8 group">
                <div className="flex justify-between items-start mb-6">
                  <h3 className="text-3xl font-bold uppercase tracking-tighter group-hover:ml-4 transition-all duration-300">
                    {item.title}
                  </h3>
                  <span className="text-sm font-mono text-muted-foreground">{item.step}</span>
                </div>
                <p className="text-muted-foreground max-w-md text-lg leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ticker Tape Bottom */}
      <div className="w-full py-4 overflow-hidden border-y border-card-border flex relative mt-24">
        <motion.div
          animate={{ x: [-1035, 0] }}
          transition={{ ease: "linear", duration: 20, repeat: Infinity }}
          className="flex whitespace-nowrap gap-16 text-xs text-muted-foreground font-mono uppercase items-center"
        >
          {Array(10).fill(0).map((_, i) => (
            <span key={i} className="flex items-center gap-16">
              <span>CRYPTOGRAPHIC LEGACY MANAGEMENT</span>
              <span>+++</span>
              <span>THE PROTOCOL DEMANDS SILENCE</span>
              <span>+++</span>
            </span>
          ))}
        </motion.div>
      </div>

      {/* Footer */}
      <footer className="pt-24 pb-8 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-24">
            <div className="md:col-span-2">
              <span className="text-[10px] font-mono text-muted-foreground uppercase block mb-4">
                --- Fragments of Trust, Gently Returned.
              </span>
              <h2 className="text-4xl font-bold tracking-tight max-w-sm leading-tight">
                Some legacies are meant to stay quiet.
              </h2>
            </div>

            <div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase block mb-4">
                Network
              </span>
              <ul className="space-y-2 text-sm">
                <li>Starknet Mainnet</li>
                <li>Sepolia Testnet</li>
              </ul>
            </div>

            <div>
              <span className="text-[10px] font-mono text-muted-foreground uppercase block mb-4">
                Connect
              </span>
              <ul className="space-y-2 text-sm">
                <li><a href="https://github.com/RomarioKavin1/Tanatos-Protocol" target="_blank" rel="noreferrer" className="hover:text-muted-foreground transition-colors">GitHub</a></li>
                <li><a href="https://github.com/RomarioKavin1/Tanatos-Protocol/blob/main/README.md" target="_blank" rel="noreferrer" className="hover:text-muted-foreground transition-colors">Documentation</a></li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-card-border text-xs font-mono text-muted-foreground uppercase">
            <p>&copy; 2026 Thanatos Protocol. All rights reserved.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

