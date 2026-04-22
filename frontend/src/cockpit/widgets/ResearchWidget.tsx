import React from "react";

type ResearchInsight = {
  insight: string;
  confidence: number;
};

type Props = {
  insights: ResearchInsight[];
};

export function ResearchWidget({ insights }: Props) {
  return (
    <div className="border border-zinc-800 rounded-lg p-4">
      <h2 className="text-lg font-semibold mb-2">Research Insights</h2>
      <div className="space-y-2 text-sm text-zinc-300">
        {insights.map((i, idx) => (
          <div key={idx}>
            <div className="text-xs text-zinc-500">
              Confidence: {(i.confidence * 100).toFixed(0)}%
            </div>
            <div>{i.insight}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
