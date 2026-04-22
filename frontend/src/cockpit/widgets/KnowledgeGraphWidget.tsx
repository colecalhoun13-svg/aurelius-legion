"use client";

import React from "react";
import { KnowledgeGraphNode, KnowledgeGraphEdge } from "@/cockpit/types";

interface Props {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

export function KnowledgeGraphWidget({ nodes, edges }: Props) {
  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Knowledge Graph</h2>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <h3 className="font-semibold mb-1">Nodes</h3>
          <div className="space-y-1">
            {nodes.map((n) => (
              <div key={n.id} className="p-1 bg-neutral-800 rounded">
                <strong>{n.label}</strong> <span className="opacity-70">({n.type})</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="font-semibold mb-1">Edges</h3>
          <div className="space-y-1">
            {edges.map((e) => (
              <div key={e.id} className="p-1 bg-neutral-800 rounded">
                {e.from} → {e.to} {e.label && <span>({e.label})</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
