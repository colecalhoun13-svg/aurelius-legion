"use client";

import React from "react";
import { VectorIndexSlice } from "@/cockpit/types";

interface Props {
  slices: VectorIndexSlice[];
}

// What the semantic index is made of — embeddings per source type.
export function VectorIndexWidget({ slices }: Props) {
  const total = slices.reduce((n, s) => n + s.count, 0) || 1;

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Vector Index</h2>
      {slices.length === 0 ? (
        <p className="text-sm opacity-70">Index is empty.</p>
      ) : (
        <div className="space-y-2 text-sm">
          {slices.map((s) => (
            <div key={s.id}>
              <div className="flex justify-between text-xs mb-0.5">
                <span>{s.label}</span>
                <span className="opacity-70">{s.count.toLocaleString()}</span>
              </div>
              <div className="h-2 w-full bg-neutral-800 rounded">
                <div
                  className="h-2 bg-emerald-500 rounded"
                  style={{ width: `${Math.max(2, (s.count / total) * 100)}%` }}
                />
              </div>
            </div>
          ))}
          <p className="text-xs opacity-70 pt-1">{total.toLocaleString()} embeddings total</p>
        </div>
      )}
    </div>
  );
}
