import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "sonner";
import { Navbar } from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Thanatos Protocol | ZK Dead Man's Switch for Crypto Inheritance",
  description:
    "Trustless, private crypto inheritance on Starknet. Prove you're alive with zero-knowledge proofs. Your beneficiary stays completely anonymous until activation.",
  keywords: [
    "crypto inheritance",
    "dead man switch",
    "zero knowledge",
    "starknet",
    "ZK proof",
    "privacy",
  ],
  openGraph: {
    title: "Thanatos Protocol",
    description:
      "ZK-powered dead man's switch for private crypto inheritance on Starknet",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}
        style={{ background: "var(--background)", color: "var(--foreground)" }}
      >
        <Providers>
          <Navbar />
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              style: {
                background: "var(--card)",
                border: "1px solid var(--card-border)",
                color: "var(--foreground)",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
