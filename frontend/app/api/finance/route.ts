import { proxyToBackend } from "../../../lib/proxyToBackend";
// Cole's personal finance — proxied to the backend financeRouter.
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/finance"); }
export async function POST(request: Request) { return proxyToBackend(request, "/api/finance"); }
