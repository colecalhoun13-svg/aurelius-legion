import { proxyToBackend } from "../../../lib/proxyToBackend";
// Athlete Zero — proxied to the backend athleteRouter (/zero).
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/athletes/zero"); }
export async function POST(request: Request) { return proxyToBackend(request, "/api/athletes/zero"); }
