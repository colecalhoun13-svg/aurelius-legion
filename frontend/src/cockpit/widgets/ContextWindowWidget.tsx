"use client";

import React from "react";
import { ContextWindowSnapshot } from "@/cockpit/types";

interface Props {
  snapshots: ContextWindowSnapshot[];
}

export function ContextWindowWidget({ snapshots }: Props) {
  const latest = snapshots[0];

  if (!latest) {
    return (
      <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
        <h2 className="text-xl font-semibold mb-2">Context Window</h2>
        <p className="text-sm opacity-70">No data yet.</p>
      </div>
    );
  }

  const usedPct =
    (latest.tokensUsed / (latest.tokensAvailable || latest.tokensUsed)) * 100;

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Context Window</h2>
      <p className="text-sm mb-2">
        {latest.tokensUsed.toLocaleString()} /{" "}
        {latest.tokensAvailable.toLocaleString()} tokens
      </p>
      <div className="h-3 w-full bg-neutral-800 rounded">
        <div
          className="h-3 bg-emerald-500 rounded"
          style={{ width: `${Math.min(usedPct, 100)}%` }}
        />
      </div>
      <p className="text-xs opacity-70 mt-1">
        Updated {new Date(latest.timestamp).toLocaleTimeString()}
      </p>
    </div>
  );
}
