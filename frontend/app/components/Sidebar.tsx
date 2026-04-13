"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { operatorRegistry, OperatorDefinition } from "../../lib/operators/operatorRegistry";

export default function Sidebar() {
  const pathname = usePathname();
  const navItems: OperatorDefinition[] = Object.values(operatorRegistry);

  return (
    <aside className="w-64 h-full border-r border-aurelius-border bg-aurelius-panel flex flex-col p-4">
      <h1 className="text-xl font-semibold text-aurelius-gold mb-6 tracking-wide">
        AURELIUS
      </h1>

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
