"use client";

import React from "react";
import { TokenFlowPoint } from "@/cockpit/types";

interface Props {
  points: TokenFlowPoint[];
}

export function TokenFlowWidget({ points }: Props) {
  const sorted = [...points].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Token Flow</h2>

      <div className="space-y-3 text-sm max-h-64 overflow-y-auto">
        {sorted.map((p, i) => (
          <div key={i} className="p-2 bg-neutral-800 rounded">
            <div className="flex justify-between">
              <span className="opacity-70 text-xs">
                {new Date(p.timestamp).toLocaleTimeString()}
              </span>
              <span className="opacity-70 text-xs">Δ {p.tokensIn - p.tokensOut}</span>
            </div>

            <div className="mt-1">
              <p><strong>In:</strong> {p.tokensIn.toLocaleString()}</p>
              <p><strong>Out:</strong> {p.tokensOut.toLocaleString()}</p>
            </div>

            <div className="mt-2">
              <div className="h-2 w-full bg-neutral-800 rounded mb-1">
                <div
                  className="h-2 bg-emerald-500 rounded"
                  style={{
                    width: `${Math.min((p.tokensIn / 2000) * 100, 100)}%`,
                  }}
                />
              </div>
              <div className="h-2 w-full bg-neutral-800 rounded">
                <div
                  className="h-2 bg-red-500 rounded"
                  style={{
                    width: `${Math.min((p.tokensOut / 2000) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
