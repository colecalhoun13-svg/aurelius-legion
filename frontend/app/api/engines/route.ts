import { NextResponse } from "next/server";
import { registerAllEngines } from "../../../../aurelius/core/registerEngines";
import { listEngines } from "../../../../aurelius/core/engineRegistry";

// Registry is process-local — never statically evaluate at build time.
export const dynamic = "force-dynamic";

// Mirrors llm/router.ts TIERS — which mind answers which kind of call.
const ROUTING = [
  { tier: "strategic", provider: "anthropic", model: "claude-sonnet-4-6", when: "Default — planning, judgment, the operator voice", env: "ANTHROPIC_API_KEY" },
  { tier: "high leverage", provider: "anthropic", model: "claude-opus-4-7", when: "Hard calls where being wrong is expensive", env: "ANTHROPIC_API_KEY" },
  { tier: "fast", provider: "groq", model: "llama-3.3-70b-versatile", when: "Quick, low-stakes turns", env: "GROQ_API_KEY" },
  { tier: "structured", provider: "openai", model: "gpt-5.4-mini", when: "Strict-format extraction and parsing", env: "OPENAI_API_KEY" },
  { tier: "realtime", provider: "xai", model: "grok-4-1-fast-reasoning", when: "Needs live information", env: "XAI_API_KEY" },
  { tier: "multimodal", provider: "gemini", model: "gemini-2.5-pro", when: "Images and mixed media", env: "GEMINI_API_KEY" },
  { tier: "math cheap", provider: "deepseek", model: "deepseek-reasoner", when: "Numeric grinding on a budget", env: "DEEPSEEK_API_KEY" },
];

export async function GET() {
  try {
    registerAllEngines();
    const engines = listEngines().map((e: any) => ({
      name: e.name,
      description: e.description ?? "",
    }));
    const routing = ROUTING.map((r) => ({
      ...r,
      configured: Boolean(process.env[r.env]?.trim()),
      env: undefined,
    }));
    const embeddings = {
      provider: (process.env.EMBEDDINGS_PROVIDER ?? "openai").trim().toLowerCase(),
    };
    return NextResponse.json({ engines, routing, embeddings });
  } catch (error: any) {
    console.error("Engines error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load engines" }, { status: 500 });
  }
}
