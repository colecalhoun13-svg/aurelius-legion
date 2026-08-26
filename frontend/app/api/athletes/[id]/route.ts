import { proxyToBackend } from "../../../../lib/proxyToBackend";
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { id: string } }) {
  return proxyToBackend(request, `/api/athletes/${encodeURIComponent(params.id)}`);
}
export async function POST(request: Request, { params }: { params: { id: string } }) {
  return proxyToBackend(request, `/api/athletes/${encodeURIComponent(params.id)}`);
}
