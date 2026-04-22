"use client";

import React from "react";
import { CockpitLayout } from "@/cockpit/layout/CockpitLayout";
import { AutonomyWidget } from "@/cockpit/widgets/AutonomyWidget";
import { ResearchWidget } from "@/cockpit/widgets/ResearchWidget";
import { MemoryWidget } from "@/cockpit/widgets/MemoryWidget";
import { OperatorWidget } from "@/cockpit/widgets/OperatorWidget";
import { SystemWidget } from "@/cockpit/widgets/SystemWidget";
import { MissionLogWidget } from "@/cockpit/widgets/MissionLogWidget";

import { RouterWidget } from "@/cockpit/widgets/RouterWidget";
import { ModelRegistryWidget } from "@/cockpit/widgets/ModelRegistryWidget";
import { TaskEngineWidget } from "@/cockpit/widgets/TaskEngineWidget";
import { MemoryTimelineWidget } from "@/cockpit/widgets/MemoryTimelineWidget";
import { EngineLoadWidget } from "@/cockpit/widgets/EngineLoadWidget";
import { ApiThroughputWidget } from "@/cockpit/widgets/ApiThroughputWidget";
import { ErrorHeatmapWidget } from "@/cockpit/widgets/ErrorHeatmapWidget";
import { ModelLatencyWidget } from "@/cockpit/widgets/ModelLatencyWidget";
import { AutonomyTimelineWidget } from "@/cockpit/widgets/AutonomyTimelineWidget";
import { KnowledgeGraphWidget } from "@/cockpit/widgets/KnowledgeGraphWidget";
import { ContextWindowWidget } from "@/cockpit/widgets/ContextWindowWidget";
import { TokenFlowWidget } from "@/cockpit/widgets/TokenFlowWidget";
import { MemoryEmbeddingsWidget } from "@/cockpit/widgets/MemoryEmbeddingsWidget";
import { AttentionWidget } from "@/cockpit/widgets/AttentionWidget";
import { EventStreamWidget } from "@/cockpit/widgets/EventStreamWidget";
import { CognitiveLoadWidget } from "@/cockpit/widgets/CognitiveLoadWidget";

import { useCockpitData } from "@/cockpit/hooks/useCockpitData";

export default function CockpitPage() {
  const data = useCockpitData();

  return (
    <CockpitLayout>
      <div className="space-y-6">
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <OperatorWidget status={data.operatorStatus} />
          <SystemWidget status={data.systemStatus} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <AutonomyWidget events={data.autonomyEvents} />
          <ResearchWidget insights={data.researchInsights} />
          <MemoryWidget memory={data.memoryView} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MissionLogWidget logs={data.missionLog} />
          <RouterWidget events={data.routerEvents} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ModelRegistryWidget models={data.modelRegistry} />
          <TaskEngineWidget engines={data.taskEngines} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <MemoryTimelineWidget points={data.memoryTimeline} />
          <EngineLoadWidget points={data.engineLoad} />
          <ApiThroughputWidget points={data.apiThroughput} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ErrorHeatmapWidget cells={data.errorHeatmap} />
          <ModelLatencyWidget points={data.modelLatency} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AutonomyTimelineWidget steps={data.autonomyTimeline} />
          <KnowledgeGraphWidget nodes={data.kgNodes} edges={data.kgEdges} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ContextWindowWidget snapshots={data.contextSnapshots} />
          <TokenFlowWidget points={data.tokenFlow} />
          <MemoryEmbeddingsWidget points={data.memoryEmbeddings} />
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <AttentionWidget metrics={data.attentionMetrics} />
          <EventStreamWidget events={data.eventStream} />
          <CognitiveLoadWidget samples={data.cognitiveLoad} />
        </section>
      </div>
    </CockpitLayout>
  );
}
