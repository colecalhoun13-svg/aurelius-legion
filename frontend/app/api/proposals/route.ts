import { proxyToBackend } from "../../../lib/proxyToBackend";
// Proxied to the backend proposals router. POST { id, decision, ... } → the
// backend resolves at /:id/resolve (it looks up the operator itself).
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/proposals"); }
export async function POST(request: Request) {
  const text = await request.text();
  let id = "";
  try { id = JSON.parse(text || "{}").id ?? ""; } catch {}
  if (!id) return new Response(JSON.stringify({ error: "id + decision required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  return proxyToBackend(request, `/api/proposals/${encodeURIComponent(id)}/resolve`, text);
}
