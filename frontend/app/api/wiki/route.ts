import { proxyToBackend } from "../../../lib/proxyToBackend";
// Proxied to the backend wiki router. GET ?slug → one page, else the list;
// POST { slug } → rebuild that page.
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("slug");
  return proxyToBackend(request, slug ? `/api/wiki/${encodeURIComponent(slug)}` : "/api/wiki");
}
export async function POST(request: Request) {
  const text = await request.text();
  let slug = "";
  try { slug = JSON.parse(text || "{}").slug ?? ""; } catch {}
  if (!slug) return new Response(JSON.stringify({ error: "slug required" }), { status: 400, headers: { "Content-Type": "application/json" } });
  return proxyToBackend(request, `/api/wiki/${encodeURIComponent(slug)}/rebuild`, text);
}
