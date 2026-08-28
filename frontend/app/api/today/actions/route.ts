import { proxyToBackend } from "../../../../lib/proxyToBackend";
// The Today view's single write endpoint — proxied so every productivity write
// runs in the backend process. Body: { action, ...payload }.
export const dynamic = "force-dynamic";
export async function POST(request: Request) { return proxyToBackend(request, "/api/productivity/actions"); }
