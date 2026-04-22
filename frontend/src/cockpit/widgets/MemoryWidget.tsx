"use client";

import React from "react";
import { MemoryView } from "@/cockpit/types";

interface Props {
  memory: MemoryView[];
}

export function MemoryWidget({ memory }: Props) {
  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Memory</h2>

      <div className="space-y-2">
        {memory.map((mem) => (
          <div key={mem.id} className="p-2 bg-neutral-800 rounded">
            <p><strong>Category:</strong> {mem.category}</p>
            <p><strong>Value:</strong> {mem.value}</p>
            <p className="text-xs opacity-70">
              Updated {new Date(mem.lastUpdated).toLocaleTimeString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
