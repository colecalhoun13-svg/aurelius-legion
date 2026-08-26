import { proxyToBackend } from "../../../../../lib/proxyToBackend";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { id: string } }) {
  return proxyToBackend(request, `/api/crm/clients/${encodeURIComponent(params.id)}`);
}
