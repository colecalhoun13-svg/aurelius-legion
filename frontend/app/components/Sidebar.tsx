"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AureliusCrest from "../../components/identity/AureliusCrest";
import { operatorRegistry, OperatorDefinition } from "../../lib/operators/operatorRegistry";

export default function Sidebar() {
  const pathname = usePathname();
  const navItems: OperatorDefinition[] = Object.values(operatorRegistry);

  return (
    <aside className="w-64 h-full border-r border-aurelius-gold/25 bg-aurelius-panel/90 flex flex-col">
      {/* Crest header — per the command-deck mockup */}
      <div className="flex items-center justify-center py-6 border-b border-aurelius-gold/25">
        <AureliusCrest size={110} />
      </div>

      <nav className="flex flex-col space-y-1 p-4">
        {navItems.map((item) => {
          const active = pathname === item.path;

          return (
            <Link
              key={item.name}
              href={item.path}
              className={`px-3 py-2 rounded-md transition-colors ${
                active
                  ? "bg-aurelius-gold/15 text-aurelius-gold font-semibold border-l-2 border-aurelius-gold"
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
