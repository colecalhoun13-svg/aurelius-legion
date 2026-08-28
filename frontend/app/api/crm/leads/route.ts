import { proxyToBackend } from "../../../../lib/proxyToBackend";
// Lead writes — POST { action:"convert" | new lead }, PATCH update.
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return proxyToBackend(request, "/api/crm/leads-save"); }
export async function PATCH(request: Request) { return proxyToBackend(request, "/api/crm/leads-save"); }
