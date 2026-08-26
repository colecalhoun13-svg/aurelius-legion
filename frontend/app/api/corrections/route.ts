import { proxyToBackend } from "../../../lib/proxyToBackend";
// Proxied to the backend's corrections router (identical contract).
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/corrections"); }
export async function POST(request: Request) { return proxyToBackend(request, "/api/corrections"); }
