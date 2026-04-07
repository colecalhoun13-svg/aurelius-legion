// app/layout.tsx
import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Aurelius Legion",
  description: "A sovereign, operator‑class personal OS.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0A0A0A] text-[#E8E6E3]`}>
        <div className="min-h-screen flex flex-col">
          {/* Aurelius Legion Global Shell */}
          <header className="w-full border-b border-[#1A1A1A] bg-[#0D0D0D] py-4 px-6 flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-wide text-[#D4AF37]">
              AURELIUS LEGION
            </h1>
            <span className="text-sm text-[#777]">
              Operator‑Class OS v3.4
            </span>
          </header>

          {/* Main Content */}
          <main className="flex-1 flex flex-row">
            {/* Sidebar Placeholder (will be replaced in Phase 2) */}
            <aside className="w-56 border-r border-[#1A1A1A] bg-[#0D0D0D] p-4 hidden md:block">
              <nav className="space-y-4 text-sm">
                <div className="text-[#D4AF37] font-semibold">Navigation</div>
                <ul className="space-y-2">
                  <li className="hover:text-[#D4AF37] cursor-pointer">Operate</li>
                  <li className="hover:text-[#D4AF37] cursor-pointer">Business</li>
                  <li className="hover:text-[#D4AF37] cursor-pointer">Wealth</li>
                  <li className="hover:text-[#D4AF37] cursor-pointer">Train</li>
                  <li className="hover:text-[#D4AF37] cursor-pointer">Calendar</li>
                </ul>
              </nav>
            </aside>

            {/* Page Content */}
            <section className="flex-1 p-6">
              {children}
            </section>
          </main>
        </div>
      </body>
    </html>
  );
}

