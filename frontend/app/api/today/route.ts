import { proxyToBackend } from "../../../lib/proxyToBackend";
// Proxied to the backend. ?date= carried through.
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/productivity/today"); }
