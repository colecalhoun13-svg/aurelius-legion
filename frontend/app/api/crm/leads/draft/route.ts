import { proxyToBackend } from "../../../../../lib/proxyToBackend";
// Lead acquisition — POST { kind: warm_list | sweep | draft }.
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return proxyToBackend(request, "/api/crm/leads-acquire"); }
