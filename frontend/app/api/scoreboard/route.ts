import { proxyToBackend } from "../../../lib/proxyToBackend";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/system/scoreboard"); }
