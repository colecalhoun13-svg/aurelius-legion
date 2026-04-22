import React from "react";

type Props = {
  children: React.ReactNode;
};

export function CockpitLayout({ children }: Props) {
  return (
    <div className="min-h-screen bg-[#050608] text-white flex">
      <aside className="w-64 border-r border-zinc-800 p-4">
        <h1 className="text-xl font-semibold mb-6">Aurelius Cockpit</h1>
        <nav className="space-y-2 text-sm text-zinc-300">
          <div>Autonomy</div>
          <div>Research</div>
          <div>Memory</div>
          <div>Operators</div>
          <div>System</div>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
