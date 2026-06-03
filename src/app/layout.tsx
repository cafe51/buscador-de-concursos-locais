// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Radar de Concursos - Monitoramento de Editais",
  description: "Monitore editais de concursos públicos e processos seletivos de órgãos municipais da região.",
};

import Footer from "../components/Footer";
import TerminalPanel from "../components/TerminalPanel";
import { initDevLogger } from "@/lib/devLogger";

if (typeof window === "undefined") {
  initDevLogger();
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50">
        <div className="flex-1 flex flex-col">{children}</div>
        <Footer />
        <TerminalPanel />
      </body>
    </html>
  );
}
