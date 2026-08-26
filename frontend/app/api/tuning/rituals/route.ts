import { proxyToBackend } from "../../../../lib/proxyToBackend";
// The rituals dial — now LIVE: proxied to the backend process that actually
// holds the node-schedule registry, so retime/pause/resume work.
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/system/schedule"); }
export async function POST(request: Request) { return proxyToBackend(request, "/api/system/schedule"); }
