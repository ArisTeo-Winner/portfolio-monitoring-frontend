import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProvider } from "@/providers/app-provider";

// The CSP nonce is minted per request in `src/middleware.ts`. Next.js only
// stamps that nonce onto its inline hydration scripts when the route renders
// dynamically; a statically prerendered page freezes a stale/absent nonce and
// the browser blocks every inline script (no hydration). Forcing dynamic
// rendering app-wide keeps the header nonce and the script nonce in lockstep.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crypto Portfolio Monitoring",
  description: "Frontend separado para auth, portfolio y transacciones.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen antialiased">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
