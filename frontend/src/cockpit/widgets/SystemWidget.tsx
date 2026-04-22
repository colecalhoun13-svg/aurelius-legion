"use client";

import React from "react";
import { SystemStatus } from "@/cockpit/types";

interface Props {
  status: SystemStatus | null;
}

export function SystemWidget({ status }: Props) {
  if (!status) return <div className="p-4 bg-neutral-900 rounded-lg">Loading...</div>;

  return (
    <div className="p-4 bg-neutral-900 rounded-lg border border-neutral-700">
      <h2 className="text-xl font-semibold mb-2">System Status</h2>

      <div className="space-y-1 text-sm">
        <p><strong>CPU Load:</strong> {(status.cpuLoad * 100).toFixed(1)}%</p>
        <p><strong>Memory Usage:</strong> {(status.memoryUsage * 100).toFixed(1)}%</p>
        <p><strong>Active Tasks:</strong> {status.activeTasks}</p>
        <p><strong>Queue Depth:</strong> {status.queueDepth}</p>
        <p><strong>Uptime:</strong> {Math.floor(status.uptime / 3600)}h</p>
        <p className="text-xs opacity-70">
          Updated {new Date(status.updatedAt).toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
