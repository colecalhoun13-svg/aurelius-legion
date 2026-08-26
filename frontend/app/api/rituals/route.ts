import { proxyToBackend } from "../../../lib/proxyToBackend";
// Proxied to the backend rituals router. GET → latest; POST → run the briefing.
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/rituals/latest"); }
export async function POST(request: Request) { return proxyToBackend(request, "/api/rituals/morning/run"); }
