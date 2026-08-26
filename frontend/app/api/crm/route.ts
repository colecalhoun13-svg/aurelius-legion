import { proxyToBackend } from "../../../lib/proxyToBackend";
// The Business dashboard — proxied to the backend composite.
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return proxyToBackend(request, "/api/crm/dashboard"); }
