import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AppProvider } from "@/providers/app-provider";

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
