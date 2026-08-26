import { proxyToBackend } from "../../../../lib/proxyToBackend";
// Proxied to the backend corpus router — one document by id.
export const dynamic = "force-dynamic";
export async function GET(request: Request, { params }: { params: { id: string } }) {
  return proxyToBackend(request, `/api/corpus/${encodeURIComponent(params.id)}`);
}
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  return proxyToBackend(request, `/api/corpus/${encodeURIComponent(params.id)}`);
}
