"use client";

import React from "react";
import { CompiledSnapshot } from "@/cockpit/types";

interface Props {
  snapshots: CompiledSnapshot[];
}

// Compiled understanding — the "getting smarter without the LLM" plane:
// cached reasoning, derived patterns, and how often the cache answered
// instead of a model this week.
export function CompiledWidget({ snapshots }: Props) {
  const s = snapshots[0];

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Compiled Understanding</h2>
      {s ? (
        <>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 bg-neutral-800 rounded">
              <p className="text-2xl font-semibold">{s.cacheEntries}</p>
              <p className="text-xs opacity-70">reasoning cache entries</p>
            </div>
            <div className="p-2 bg-neutral-800 rounded">
              <p className="text-2xl font-semibold">{s.patterns}</p>
              <p className="text-xs opacity-70">compiled patterns</p>
            </div>
            <div className="p-2 bg-neutral-800 rounded">
              <p className="text-2xl font-semibold">{s.llmCalls}</p>
              <p className="text-xs opacity-70">LLM calls (7d)</p>
            </div>
            <div className="p-2 bg-neutral-800 rounded">
              <p className="text-2xl font-semibold">{s.cacheReuses}</p>
              <p className="text-xs opacity-70">cache reuses (7d)</p>
            </div>
          </div>
          <p className="text-xs opacity-70 mt-2">
            Updated {new Date(s.timestamp).toLocaleTimeString()}
          </p>
        </>
      ) : (
        <p className="text-sm opacity-70">No data yet.</p>
      )}
    </div>
  );
}
