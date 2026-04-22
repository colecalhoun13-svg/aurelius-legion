"use client";

import React from "react";
import { ErrorHeatmapCell } from "@/cockpit/types";

interface Props {
  cells: ErrorHeatmapCell[];
}

export function ErrorHeatmapWidget({ cells }: Props) {
  const max = cells.reduce((m, c) => Math.max(m, c.count), 1);

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Error Heatmap</h2>
      <div className="space-y-2 text-sm">
        {cells.map((c) => {
          const intensity = c.count / max;
          return (
            <div key={c.area} className="flex items-center justify-between">
              <span>{c.area}</span>
              <div className="flex items-center gap-2">
                <div
                  className="h-3 w-16 rounded"
                  style={{
                    backgroundColor: `rgba(239,68,68,${intensity || 0.1})`,
                  }}
                />
                <span>{c.count}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
