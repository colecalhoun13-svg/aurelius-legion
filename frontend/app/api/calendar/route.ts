import { proxyToBackend } from "../../../lib/proxyToBackend";
// Proxied to the backend calendar router's composite grid (events + connection
// + scheduled tasks) and event-create.
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/calendar/grid"); }
export async function POST(request: Request) { return proxyToBackend(request, "/api/calendar/grid"); }
