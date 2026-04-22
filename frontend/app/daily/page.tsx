import React from "react";
import { Card } from "../../components/ui/Card";
import { Panel } from "../../components/ui/Panel";
import CommandBar from "../../components/CommandBar";
import BackgroundWreath from "../../components/layout/BackgroundWreath";

async function fetchDailySnapshot() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ""}/api/daily`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch daily snapshot");
  }

  const data = await res.json();
  return data.snapshot;
}

export default async function DailyPage() {
  const snapshot = await fetchDailySnapshot();

  return (
    <div className="relative min-h-screen bg-black text-slate-100">
      <BackgroundWreath />
      <div className="relative z-10 flex flex-col min-h-screen">
        <CommandBar />
        <main className="flex-1 p-6 grid grid-cols-12 gap-4">
          {/* Example layout – we’ll refine once we see snapshot shape */}
          <section className="col-span-4 space-y-4">
            <Panel title="System Vitals">
              <pre className="text-xs">
                {JSON.stringify(snapshot.systemVitals, null, 2)}
              </pre>
            </Panel>
            <Panel title="Operator Vitals">
              <pre className="text-xs">
                {JSON.stringify(snapshot.operatorVitals, null, 2)}
              </pre>
            </Panel>
          </section>

          <section className="col-span-4 space-y-4">
            <Panel title="Ingestion Summary">
              <pre className="text-xs">
                {JSON.stringify(snapshot.ingestion, null, 2)}
              </pre>
            </Panel>
            <Panel title="Memory Summary">
              <pre className="text-xs">
                {JSON.stringify(snapshot.memory, null, 2)}
              </pre>
            </Panel>
          </section>

          <section className="col-span-4 space-y-4">
            <Panel title="Tasks & Timeline">
              <pre className="text-xs">
                {JSON.stringify(snapshot.tasks, null, 2)}
              </pre>
            </Panel>
            <Panel title="Research Summary">
              <pre className="text-xs">
                {JSON.stringify(snapshot.research, null, 2)}
              </pre>
            </Panel>
          </section>
        </main>
      </div>
    </div>
  );
}
