// ===============================================
// AURELIUS OS 3.4 — ROOT LAYOUT (Stable Minimal Shell)
// ===============================================

import "./globals.css";

export const metadata = {
  title: "Aurelius OS v3.4",
  description: "Operate with discipline.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-zinc-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
