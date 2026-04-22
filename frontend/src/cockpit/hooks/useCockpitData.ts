import { useEffect, useState } from "react";
import {
  AutonomyEvent,
  ResearchInsight,
  MemoryView,
  OperatorStatus,
  SystemStatus,
  MissionLogEntry,
  RouterRouteEvent,
  ModelRegistryEntry,
  TaskEngineStatus,
  MemoryTimelinePoint,
  EngineLoadPoint,
  ApiThroughputPoint,
  ErrorHeatmapCell,
  ModelLatencyPoint,
  AutonomyLoopStep,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  ContextWindowSnapshot,
  TokenFlowPoint,
  MemoryEmbeddingPoint,
  AttentionMetric,
  EventStreamEntry,
  CognitiveLoadSample,
} from "@/cockpit/types";

export function useCockpitData() {
  const [autonomyEvents, setAutonomyEvents] = useState<AutonomyEvent[]>([]);
  const [researchInsights, setResearchInsights] = useState<ResearchInsight[]>([]);
  const [memoryView, setMemoryView] = useState<MemoryView[]>([]);
  const [operatorStatus, setOperatorStatus] = useState<OperatorStatus | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [missionLog, setMissionLog] = useState<MissionLogEntry[]>([]);

  const [routerEvents, setRouterEvents] = useState<RouterRouteEvent[]>([]);
  const [modelRegistry, setModelRegistry] = useState<ModelRegistryEntry[]>([]);
  const [taskEngines, setTaskEngines] = useState<TaskEngineStatus[]>([]);
  const [memoryTimeline, setMemoryTimeline] = useState<MemoryTimelinePoint[]>([]);
  const [engineLoad, setEngineLoad] = useState<EngineLoadPoint[]>([]);
  const [apiThroughput, setApiThroughput] = useState<ApiThroughputPoint[]>([]);
  const [errorHeatmap, setErrorHeatmap] = useState<ErrorHeatmapCell[]>([]);
  const [modelLatency, setModelLatency] = useState<ModelLatencyPoint[]>([]);
  const [autonomyTimeline, setAutonomyTimeline] = useState<AutonomyLoopStep[]>([]);
  const [kgNodes, setKgNodes] = useState<KnowledgeGraphNode[]>([]);
  const [kgEdges, setKgEdges] = useState<KnowledgeGraphEdge[]>([]);
  const [contextSnapshots, setContextSnapshots] = useState<ContextWindowSnapshot[]>([]);
  const [tokenFlow, setTokenFlow] = useState<TokenFlowPoint[]>([]);
  const [memoryEmbeddings, setMemoryEmbeddings] = useState<MemoryEmbeddingPoint[]>([]);
  const [attentionMetrics, setAttentionMetrics] = useState<AttentionMetric[]>([]);
  const [eventStream, setEventStream] = useState<EventStreamEntry[]>([]);
  const [cognitiveLoad, setCognitiveLoad] = useState<CognitiveLoadSample[]>([]);

  useEffect(() => {
    async function load() {
      const [
        autonomyRes,
        researchRes,
        memoryRes,
        operatorRes,
        systemRes,
        missionRes,
        routerRes,
        modelsRes,
        tasksRes,
        memTimelineRes,
        engineLoadRes,
        apiThroughputRes,
        errorHeatmapRes,
        modelLatencyRes,
        autonomyTimelineRes,
        kgNodesRes,
        kgEdgesRes,
        contextRes,
        tokenFlowRes,
        memEmbedRes,
        attentionRes,
        eventStreamRes,
        cognitiveRes,
      ] = await Promise.all([
        fetch("/api/cockpit/autonomy"),
        fetch("/api/cockpit/research"),
        fetch("/api/cockpit/memory"),
        fetch("/api/cockpit/operator"),
        fetch("/api/cockpit/system"),
        fetch("/api/cockpit/mission"),
        fetch("/api/cockpit/router"),
        fetch("/api/cockpit/models"),
        fetch("/api/cockpit/tasks"),
        fetch("/api/cockpit/memory-timeline"),
        fetch("/api/cockpit/engine-load"),
        fetch("/api/cockpit/api-throughput"),
        fetch("/api/cockpit/error-heatmap"),
        fetch("/api/cockpit/model-latency"),
        fetch("/api/cockpit/autonomy-timeline"),
        fetch("/api/cockpit/knowledge-graph/nodes"),
        fetch("/api/cockpit/knowledge-graph/edges"),
        fetch("/api/cockpit/context-window"),
        fetch("/api/cockpit/token-flow"),
        fetch("/api/cockpit/memory-embeddings"),
        fetch("/api/cockpit/attention"),
        fetch("/api/cockpit/event-stream"),
        fetch("/api/cockpit/cognitive-load"),
      ]);

      setAutonomyEvents(await autonomyRes.json());
      setResearchInsights(await researchRes.json());
      setMemoryView(await memoryRes.json());
      setOperatorStatus(await operatorRes.json());
      setSystemStatus(await systemRes.json());
      setMissionLog(await missionRes.json());

      setRouterEvents(await routerRes.json());
      setModelRegistry(await modelsRes.json());
      setTaskEngines(await tasksRes.json());
      setMemoryTimeline(await memTimelineRes.json());
      setEngineLoad(await engineLoadRes.json());
      setApiThroughput(await apiThroughputRes.json());
      setErrorHeatmap(await errorHeatmapRes.json());
      setModelLatency(await modelLatencyRes.json());
      setAutonomyTimeline(await autonomyTimelineRes.json());
      setKgNodes(await kgNodesRes.json());
      setKgEdges(await kgEdgesRes.json());
      setContextSnapshots(await contextRes.json());
      setTokenFlow(await tokenFlowRes.json());
      setMemoryEmbeddings(await memEmbedRes.json());
      setAttentionMetrics(await attentionRes.json());
      setEventStream(await eventStreamRes.json());
      setCognitiveLoad(await cognitiveRes.json());
    }

    load();
  }, []);

  return {
    autonomyEvents,
    researchInsights,
    memoryView,
    operatorStatus,
    systemStatus,
    missionLog,
    routerEvents,
    modelRegistry,
    taskEngines,
    memoryTimeline,
    engineLoad,
    apiThroughput,
    errorHeatmap,
    modelLatency,
    autonomyTimeline,
    kgNodes,
    kgEdges,
    contextSnapshots,
    tokenFlow,
    memoryEmbeddings,
    attentionMetrics,
    eventStream,
    cognitiveLoad,
  };
}
