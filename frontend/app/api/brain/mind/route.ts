import { proxyToBackend } from "../../../../lib/proxyToBackend";
// The compiled lens + pattern confirm/retire staging — proxied so the executor
// runs in the backend process (pattern.confirm/retire gate to a Bridge confirm).
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/system/brain-mind"); }
export async function POST(request: Request) { return proxyToBackend(request, "/api/system/brain-mind"); }
