import { proxyToBackend } from "../../../../lib/proxyToBackend";
// Research Drop — proxied to the backend's hardened ingest pipeline.
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return proxyToBackend(request, "/api/corpus/upload"); }
