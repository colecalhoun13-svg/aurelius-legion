// AURELIUS OS — SIDEBAR
"use client";

import Link from "next/link";

export default function Sidebar() {
  return (
    <div className="w-64 h-screen bg-aurelius-charcoal border-r border-aurelius-gold/40 p-6 flex flex-col gap-4">
      <h1 className="text-xl font-bold aurelius-gold mb-4">Aurelius OS</h1>

      <Link href="/dashboard" className="hover:text-aurelius-gold">Dashboard</Link>
      <Link href="/daily" className="hover:text-aurelius-gold">Daily Snapshot</Link>
      <Link href="/weekly" className="hover:text-aurelius-gold">Weekly Intelligence</Link>
      <Link href="/analytics" className="hover:text-aurelius-gold">Analytics</Link>
      <Link href="/memory" className="hover:text-aurelius-gold">Memory</Link>
      <Link href="/research" className="hover:text-aurelius-gold">Research Logs</Link>
      <Link href="/self-upgrade" className="hover:text-aurelius-gold">Self-Upgrade</Link>
    </div>
  );
}
