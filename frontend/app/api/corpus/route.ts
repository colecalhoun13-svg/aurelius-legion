import { proxyToBackend } from "../../../lib/proxyToBackend";
// Proxied to the backend corpus router. GET → catalog; POST → ingest (url or
// title+content) at /ingest.
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/corpus"); }
export async function POST(request: Request) { return proxyToBackend(request, "/api/corpus/ingest"); }
