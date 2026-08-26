import { proxyToBackend } from "../../../lib/proxyToBackend";
// Integration status is authoritative in the backend (it sees all env keys).
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/system/tools"); }
