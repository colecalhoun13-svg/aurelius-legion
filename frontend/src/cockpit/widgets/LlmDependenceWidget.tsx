"use client";

import React from "react";
import { CognitiveLoadSample } from "@/cockpit/types";

interface Props {
  samples: CognitiveLoadSample[];
}

// llmDependenceRate per weekly snapshot. The scoreboard's headline:
// this line falling means Aurelius is getting smarter, not chattier.
export function LlmDependenceWidget({ samples }: Props) {
  const latest = samples[samples.length - 1];

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">LLM Dependence</h2>
      {latest ? (
        <>
          <p className="text-sm mb-2">
            This week: {(latest.load * 100).toFixed(1)}%{" "}
            <span className="text-xs opacity-70">(lower is smarter)</span>
          </p>
          <div className="flex items-end gap-1 h-16">
            {samples.map((s, i) => (
              <div
                key={i}
                className="flex-1 bg-purple-500/70 rounded-t"
                style={{ height: `${Math.max(4, s.load * 100)}%` }}
                title={`${new Date(s.timestamp).toLocaleDateString()}: ${(s.load * 100).toFixed(1)}%`}
              />
            ))}
          </div>
          <p className="text-xs opacity-70 mt-1">
            Weekly snapshots since {new Date(samples[0].timestamp).toLocaleDateString()}
          </p>
        </>
      ) : (
        <p className="text-sm opacity-70">No weekly snapshots yet — first one files Sunday 20:00.</p>
      )}
    </div>
  );
}
