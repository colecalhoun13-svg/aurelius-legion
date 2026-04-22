"use client";

import React from "react";
import { ModelRegistryEntry } from "@/cockpit/types";

interface Props {
  models: ModelRegistryEntry[];
}

export function ModelRegistryWidget({ models }: Props) {
  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Model Registry</h2>
      <div className="space-y-2 text-sm max-h-64 overflow-y-auto">
        {models.map((m) => (
          <div key={m.id} className="p-2 bg-neutral-800 rounded">
            <p><strong>{m.name}</strong> ({m.provider})</p>
            <p>Context: {m.contextWindow.toLocaleString()} tokens</p>
            <p>Status: {m.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
