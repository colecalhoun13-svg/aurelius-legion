"use client";

export default function TopBar() {
  return (
    <header className="w-full h-14 border-b border-aurelius-border bg-aurelius-panel flex items-center justify-between px-6">
      <div className="text-aurelius-text tracking-wide">
        Operator Console
      </div>

      <div className="text-aurelius-gold font-medium tracking-wide">
        ACTIVE
      </div>
    </header>
  );
}
