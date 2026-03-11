"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Shield,
  Clock,
  Key,
  Zap,
  Lock,
  Eye,
  ArrowRight,
  Github,
  ChevronRight,
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
    title: "Configurable Switch",
    description:
      "Set your own check-in interval. Miss N consecutive intervals and your vault activates automatically.",
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
      "Create a Semaphore identity securely in your browser. This forms your private proof key.",
  },
  {
    step: "02",
    title: "Configure Vault",
    description:
      "Set your check-in interval, deposit assets, and lock your beneficiary's encrypted claim key.",
  },
  {
    step: "03",
    title: "Check In Privately",
    description:
      "Generate a ZK proof locally to prove you're alive, submitted entirely on-chain for privacy.",
  },
  {
    step: "04",
    title: "Automatic Inheritance",
    description:
      "Miss the threshold, and your vault unlocks. Your beneficiary claims using their private key.",
  },
];

export default function HomePage() {
  const { scrollYProgress } = useScroll();
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0]);
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, 50]);

  return (
    <div className="min-h-screen relative overflow-hidden text-[#fcfcfc]">
      {/* Dynamic Background Effects */}
      <div className="bg-ambient-glow" />
      <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.03] mix-blend-overlay pointer-events-none" />

      {/* Navigation */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 glass-panel border-b border-t-0 border-l-0 border-r-0 rounded-none"
      >
        <div className="flex items-center gap-3 group cursor-pointer">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/30 group-hover:border-primary/60 transition-colors">
            <Shield className="w-5 h-5 text-primary group-hover:text-red-400 transition-colors" />
            <div className="absolute inset-0 bg-primary/20 blur-md rounded-xl opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <span className="font-extrabold text-xl tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-neutral-400">
            Thanatos
          </span>
        </div>
        <div className="hidden md:flex items-center space-x-1 p-1.5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
          {["Dashboard", "Setup Vault", "Claim"].map((item) => {
            const path = item === "Setup Vault" ? "/setup" : `/${item.toLowerCase()}`;
            return (
              <Link
                key={item}
                href={path}
                className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white rounded-xl hover:bg-white/10 transition-all duration-300 relative group"
              >
                {item}
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary opacity-0 group-hover:opacity-100 transition-all" />
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/thanatos-protocol"
            target="_blank"
            rel="noreferrer"
            className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-neutral-400 transition-all"
          >
            <Github className="w-4 h-4" />
          </a>
          <ConnectWallet />
        </div>
      </motion.nav>

      {/* Hero Section */}
      <motion.section
        style={{ opacity: heroOpacity, y: heroY }}
        className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 pt-24 pb-12"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
          className="max-w-4xl mx-auto flex flex-col items-center z-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 backdrop-blur-sm text-red-300/90 shadow-[0_0_15px_rgba(225,29,72,0.15)]">
            <Zap className="w-3.5 h-3.5 text-primary animate-pulse" />
            Built on Starknet &bull; ZK-Powered &bull; Fully Private
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-8 leading-[1.1]">
            Your legacy. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-br from-primary via-red-500 to-orange-400 drop-shadow-sm">
              Your control.
            </span>
            <br />
            No one else.
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-12 leading-relaxed text-neutral-400 font-medium">
            Thanatos Protocol is a zero-knowledge dead man&apos;s switch for private crypto
            inheritance. Prove you&apos;re alive with ZK proofs. Disappear, and your vault
            automatically unlocks for your chosen beneficiary.
          </p>

          <div className="flex flex-col sm:flex-row gap-5 justify-center w-full max-w-md sm:max-w-none">
            <Link href="/setup">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold text-white bg-gradient-to-r from-primary to-rose-600 shadow-[0_0_40px_rgba(225,29,72,0.4)] overflow-hidden transition-all hover:shadow-[0_0_60px_rgba(225,29,72,0.6)]"
              >
                <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                <span className="relative z-10">Setup Your Vault</span>
                <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
              </motion.button>
            </Link>
            <Link href="/claim">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-bold bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-neutral-200"
              >
                Claim as Beneficiary
              </motion.button>
            </Link>
          </div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
          animate={{ y: [0, 8, 0], opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
        >
          <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-500">Scroll</span>
          <div className="w-5 h-8 rounded-full border border-neutral-600 flex items-start justify-center p-1">
            <div className="w-1 h-2 rounded-full bg-primary" />
          </div>
        </motion.div>
      </motion.section>

      {/* How It Works */}
      <section className="py-32 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-20"
          >
            <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">
              Trustless Execution
            </h2>
            <div className="w-24 h-1 bg-gradient-to-r from-primary to-transparent mx-auto rounded-full mb-6" />
            <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
              Four steps separating you from autonomous, cryptographic legacy management.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.15, duration: 0.6 }}
                className="glass-panel p-8 rounded-3xl relative overflow-hidden group"
              >
                {/* Background glow on hover */}
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="text-6xl font-black mb-6 text-white/5 group-hover:text-primary/10 transition-colors duration-500 transform group-hover:scale-110 origin-left">
                  {item.step}
                </div>
                <h3 className="font-bold text-xl mb-4 text-white relative z-10 flex items-center gap-2">
                  {item.title}
                  <ChevronRight className="w-4 h-4 text-primary opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                </h3>
                <p className="text-sm font-medium leading-relaxed text-neutral-400 relative z-10 group-hover:text-neutral-300 transition-colors">
                  {item.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-32 px-6 relative z-10 bg-neutral-950/50 border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-20 flex flex-col items-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">
              Why Thanatos?
            </h2>
            <p className="text-lg text-neutral-400 max-w-2xl mx-auto">
              Privacy-preserving inheritance, built from first principles to ensure your assets remain yours, until they aren't.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                whileHover={{ y: -5 }}
                className="p-8 rounded-3xl bg-black/40 border border-white/5 hover:border-primary/30 transition-all duration-300 group"
              >
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary/10 group-hover:border-primary/30 transition-all duration-300">
                  <feature.icon className="w-6 h-6 text-neutral-300 group-hover:text-primary transition-colors" />
                </div>
                <h3 className="font-bold text-xl mb-3 text-white">
                  {feature.title}
                </h3>
                <p className="text-sm font-medium leading-relaxed text-neutral-400 group-hover:text-neutral-300 transition-colors">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-40 px-6 relative z-10 text-center">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent pointer-events-none" />
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-3xl mx-auto relative"
        >
          <div className="absolute -inset-4 bg-primary/20 blur-3xl rounded-full opacity-50 -z-10" />
          <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter">
            Secure Your Legacy
          </h2>
          <p className="text-xl text-neutral-400 mb-12 max-w-xl mx-auto font-medium">
            Join the future of trustless, private crypto inheritance. No custody. No compromise.
          </p>
          <Link href="/setup">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group relative inline-flex items-center gap-3 px-12 py-5 rounded-full font-bold text-lg text-white bg-gradient-to-r from-primary to-rose-600 shadow-[0_0_50px_rgba(225,29,72,0.5)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              <span className="relative z-10">Get Started — It&apos;s Free</span>
              <ArrowRight className="w-6 h-6 relative z-10 group-hover:translate-x-1.5 transition-transform" />
            </motion.button>
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 relative z-10 border-t border-white/10 bg-black/60 backdrop-blur-md">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-lg tracking-tight">Thanatos Protocol</span>
          </div>

          <div className="text-center md:text-left text-sm font-medium text-neutral-500">
            <p>Open source. Trustless. Forever.</p>
            <p className="mt-1 opacity-70">
              Smart contracts are unaudited. Use at your own risk on testnet first.
            </p>
          </div>

          <div className="flex gap-4">
            <a href="https://github.com/thanatos-protocol" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-all">
              <Github className="w-5 h-5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

