// ===============================================
// AURELIUS OS 3.4 — ROOT LAYOUT (Stable Minimal Shell)
// ===============================================

import "./globals.css";
import type { Viewport } from "next";
import AureliusStartup from "../components/identity/AureliusStartup";

export const metadata = {
  title: "Aurelius OS",
  description: "Operator-class second mind. Operate with discipline.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent" as const,
    title: "Aurelius",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-zinc-100 min-h-screen">
        <AureliusStartup>{children}</AureliusStartup>
      </body>
    </html>
  );
}
