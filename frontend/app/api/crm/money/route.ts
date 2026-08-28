import { proxyToBackend } from "../../../../lib/proxyToBackend";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/crm/money"); }
export async function POST(request: Request) { return proxyToBackend(request, "/api/crm/money"); }
