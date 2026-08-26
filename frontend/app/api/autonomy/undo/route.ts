import { proxyToBackend } from "../../../../lib/proxyToBackend";

// Undo an executed action — proxied to the backend so the registered inverse
// runs in the one process that owns the action registry, not a second copy.
export const dynamic = "force-dynamic";

// POST { signalId }
export async function POST(request: Request) {
  return proxyToBackend(request, "/api/autonomy/undo");
}
