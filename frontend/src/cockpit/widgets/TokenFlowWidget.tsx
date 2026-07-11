"use client";

import React from "react";
import { TokenFlowPoint } from "@/cockpit/types";

interface Props {
  points: TokenFlowPoint[];
}

// Daily token spend, straight from runLLM's call log.
export function TokenFlowWidget({ points }: Props) {
  const max = Math.max(...points.map((p) => p.tokens), 1);

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Token Flow (7d)</h2>
      {points.length === 0 ? (
        <p className="text-sm opacity-70">No LLM calls logged this week.</p>
      ) : (
        <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
          {points.map((p) => (
            <div key={p.timestamp}>
              <div className="flex justify-between text-xs mb-0.5">
                <span>{p.timestamp.slice(0, 10)}</span>
                <span className="opacity-70">
                  {p.tokens.toLocaleString()} tok · {p.calls} calls
                </span>
              </div>
              <div className="h-2 w-full bg-neutral-800 rounded">
                <div
                  className="h-2 bg-emerald-500 rounded"
                  style={{ width: `${Math.max(2, (p.tokens / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
