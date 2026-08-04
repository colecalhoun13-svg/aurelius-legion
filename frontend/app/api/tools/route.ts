import { NextResponse } from "next/server";
import { registerAllTools } from "../../../../aurelius/tools/registerTools";
import { listTools } from "../../../../aurelius/tools/toolRegistry";
import { getIntegrations } from "../../../../aurelius/tools/integrationStatus";

export const dynamic = "force-dynamic";

// ASK THE BACKEND FIRST (deploy triage). Integration status is derived from
// environment variables, and on the two-service deploy half of them live only
// on the BACKEND service — TELEGRAM_*, FRED_API_KEY, GROQ_API_KEY, INSTAGRAM_*,
// INGEST_WATCH_DIR. Computing status in this container reported every one of
// them as "needs a key" while they were live one service over. So: ask the
// backend, which can see them, and only compute locally if it can't be reached.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN?.trim() || "http://127.0.0.1:3001";

async function integrationsFromBackend() {
  const res = await fetch(`${BACKEND_ORIGIN}/api/health/integrations`, {
    headers: process.env.AURELIUS_API_KEY ? { "x-aurelius-key": process.env.AURELIUS_API_KEY } : {},
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`backend ${res.status}`);
  const json = await res.json();
  if (!Array.isArray(json?.integrations)) throw new Error("malformed");
  return json.integrations;
}

export async function GET() {
  try {
    registerAllTools(); // idempotent — the registry de-dupes
    let integrations;
    let source = "backend";
    try {
      integrations = await integrationsFromBackend();
    } catch {
      // Backend asleep or unreachable: local status is partial (backend-only
      // keys read as missing) but better than a 500. Labelled so the page can
      // say so rather than quietly lying.
      integrations = await getIntegrations();
      source = "local";
    }
    return NextResponse.json({
      registered: listTools().map((t: any) => ({
        name: t.name,
        actions: t.actions.map((a: any) => a.name ?? a),
      })),
      integrations,
      source,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "failed" }, { status: 500 });
  }
}
