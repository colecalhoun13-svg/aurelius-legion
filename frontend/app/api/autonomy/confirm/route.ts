import { proxyToBackend } from "../../../../lib/proxyToBackend";

// Confirm an action — proxied to the backend so the finalizer (which may be an
// OUTWARD send/publish) runs ONLY in the backend process, behind its lock, with
// the one authoritative action registry. Never in this frontend process.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return proxyToBackend(request, "/api/autonomy/confirm");
}
