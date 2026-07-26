"use client";

// The "Aurelius is holding something for you" heartbeat: polls the cheap
// badge count every 60s and mirrors it onto the installed app icon where
// the platform allows (iOS needs the PWA installed + notifications allowed —
// the in-app badge is the reliable channel, the icon badge is a bonus).
import { useEffect, useState } from "react";

export function useNeedsYou(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await fetch("/api/nav/badges");
        const j = r.ok ? await r.json() : null;
        if (!alive || !j) return;
        setCount(j.needsYou ?? 0);
        try {
          if (j.needsYou > 0) (navigator as any).setAppBadge?.(j.needsYou);
          else (navigator as any).clearAppBadge?.();
        } catch { /* platform says no — in-app badge still shows */ }
      } catch { /* transient — next tick */ }
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  return count;
}
