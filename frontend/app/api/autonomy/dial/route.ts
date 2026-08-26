import { proxyToBackend } from "../../../../lib/proxyToBackend";

// The Autonomy dial — proxied to the backend, which owns the composite read
// (grants + trust ledger + suggestions + undoable actions + flow) and the
// grant/revoke writes. Cole's UI click is his explicit hand on the switch.
export const dynamic = "force-dynamic";

// GET → the dial state (?days=N widens the undoable-actions horizon).
export async function GET(request: Request) {
  return proxyToBackend(request, "/api/autonomy/dial");
}

// POST { op: "grant" | "revoke", actionClass }
export async function POST(request: Request) {
  return proxyToBackend(request, "/api/autonomy/dial");
}
