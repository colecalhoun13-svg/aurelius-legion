"use client";

import React from "react";
import { EngineLoadPoint } from "@/cockpit/types";

interface Props {
  points: EngineLoadPoint[];
}

export function EngineLoadWidget({ points }: Props) {
  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Engine Load</h2>
      <div className="space-y-2 text-sm">
        {points.map((p) => (
          <div key={p.engine} className="flex justify-between">
            <span>{p.engine}</span>
            <span>{(p.load * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
