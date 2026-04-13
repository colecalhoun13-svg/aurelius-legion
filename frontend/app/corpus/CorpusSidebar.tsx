// ===============================================
// AURELIUS OS 3.4 — SIDEBAR
// Includes full Aurelius Crest at the top.
// Matches the mockups exactly.
// ===============================================

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AureliusCrest from "../../components/identity/AureliusCrest";
import { operatorRegistry, OperatorDefinition } from "../../lib/operators/operatorRegistry";

export default function Sidebar() {
  const pathname = usePathname();
  const navItems: OperatorDefinition[] = Object.values(operatorRegistry);

  return (
    <aside className="w-64 h-full border-r border-aurelius-border bg-aurelius-panel flex flex-col p-4">
      
      {/* ===============================================
          FULL CREST HEADER
         =============================================== */}
      <div className="flex justify-center mb-8 mt-2">
        <AureliusCrest size={100} />
      </div>

      {/* ===============================================
          NAVIGATION
         =============================================== */}
      <nav className="flex flex-col space-y-3">
        {navItems.map((item) => {
          const active = pathname === item.path;

          return (
            <Link
              key={item.name}
              href={item.path}
              className={`px-3 py-2 rounded-md transition-colors ${
                active
                  ? "bg-aurelius-gold text-black font-semibold"
                  : "text-aurelius-text hover:text-aurelius-gold"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
