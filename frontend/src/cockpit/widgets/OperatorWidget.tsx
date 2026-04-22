"use client";

import React from "react";
import { OperatorStatus } from "@/cockpit/types";

interface Props {
  status: OperatorStatus | null;
}

export function OperatorWidget({ status }: Props) {
  if (!status) return <div className="p-4 bg-neutral-900 rounded-lg">Loading...</div>;

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">Operator Status</h2>

      <div className="space-y-1 text-sm">
        <p><strong>Mode:</strong> {status.mode}</p>
        <p><strong>Uptime:</strong> {Math.floor(status.uptime / 3600)}h</p>
        <p><strong>Load:</strong> {(status.load * 100).toFixed(1)}%</p>
        <p><strong>Last Action:</strong> {status.lastAction}</p>
        <p><strong>Updated:</strong> {new Date(status.updatedAt).toLocaleTimeString()}</p>
      </div>
    </div>
  );
}
