"use client";

import Link from "next/link";
import { Github } from "lucide-react";
import { ConnectWallet } from "@/components/ConnectWallet";

export function Navbar() {
    return (
        <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-4 bg-background/80 backdrop-blur-sm border-b border-card-border">
            <Link href="/" className="flex items-center gap-2 group cursor-pointer">
                <span className="font-extrabold text-2xl tracking-tighter uppercase flex items-center gap-2">
                    <span className="text-muted-foreground mr-1">ΘΑΝΑΤΟΣ</span>
                    THANATOS.
                </span>
                <span className="text-xs font-mono text-muted-foreground ml-2 hidden sm:block transition-colors">
                    [ZK INHERITANCE PROTOCOL]
                </span>
            </Link>

            <div className="hidden md:flex flex-1 justify-center">
                <div className="flex items-center space-x-8 text-xs font-bold uppercase tracking-widest">
                    {["Dashboard", "Setup", "Claim"].map((item) => (
                        <Link
                            key={item}
                            href={`/${item.toLowerCase()}`}
                            className="text-muted-foreground hover:text-foreground transition-colors py-2 relative group"
                        >
                            {item}
                            <span className="absolute bottom-0 left-0 w-full h-[1px] bg-foreground origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />
                        </Link>
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-4">
                <a
                    href="https://github.com/RomarioKavin1/Tanatos-Protocol"
                    target="_blank"
                    rel="noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                >
                    <Github className="w-5 h-5" />
                </a>
                <ConnectWallet />
            </div>
        </nav>
    );
}
