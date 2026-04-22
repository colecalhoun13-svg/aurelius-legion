"use client";

import React from "react";
import { CognitiveLoadSample } from "@/cockpit/types";

interface Props {
  samples: CognitiveLoadSample[];
}

export function CognitiveLoadWidget({ samples }: Props) {
  const latest = samples[samples.length - 1];

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Cognitive Load</h2>

      {latest ? (
        <>
          <p className="text-sm mb-2">
            Current Load: {(latest.load * 100).toFixed(1)}%
          </p>
          <div className="h-3 w-full bg-neutral-800 rounded">
            <div
              className="h-3 bg-purple-500 rounded"
              style={{ width: `${latest.load * 100}%` }}
            />
          </div>
          <p className="text-xs opacity-70 mt-1">
            Updated {new Date(latest.timestamp).toLocaleTimeString()}
          </p>
        </>
      ) : (
        <p className="text-sm opacity-70">No data yet.</p>
      )}
    </div>
  );
}
