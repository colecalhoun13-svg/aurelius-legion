import { proxyToBackend } from "../../../lib/proxyToBackend";
// Proxied to the backend's missions router. POST handles both { run } (launch a
// proposed mission, fire-and-forget) and { objective } (new mission).
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/missions"); }
export async function POST(request: Request) { return proxyToBackend(request, "/api/missions"); }
