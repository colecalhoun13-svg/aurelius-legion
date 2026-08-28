// SERVER-SIDE PROXY to the Express backend.
//
// The backend (index.ts) is the one true "brain": the database, the action
// registry, and the finalizers that actually send/publish/spend. A Next API
// route that IMPORTS backend code runs that code inside the *frontend* process
// — a second copy of the brain, and (for confirm/undo) a place an OUTWARD
// finalizer could fire outside the backend's own lock. This helper is how a
// route instead ASKS the backend: the browser talks only to the same-origin
// Next route, that route calls this, and this reaches the backend over loopback
// with the server-side key. One process owns every state change.
//
// Mirrors /api/aurelius: loopback by default (no port-forwarding to go stale),
// overridable with BACKEND_ORIGIN for a split deploy (e.g. the Mac Mini).
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN?.trim() || "http://127.0.0.1:3001";

/**
 * Forward `request` to `backendPath` on the Express backend, carrying the
 * method, body, and query string, and returning the backend's response verbatim
 * (status + JSON). On an unreachable backend, a plain 502 with the fix.
 */
export async function proxyToBackend(request: Request, backendPath: string, bodyText?: string): Promise<Response> {
  const method = request.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD";
  // A caller that already read the body (to pick the backend sub-path from it)
  // passes it here, since a Request body can only be read once.
  const body = hasBody ? (bodyText !== undefined ? bodyText : await request.text()) : undefined;
  const search = new URL(request.url).search;
  const target = `${BACKEND_ORIGIN}${backendPath}${search}`;

  try {
    const res = await fetch(target, {
      method,
      headers: {
        "Content-Type": "application/json",
        // Server-only (never NEXT_PUBLIC) — satisfies the backend's API-key lock
        // when set; a harmless extra header when it isn't.
        ...(process.env.AURELIUS_API_KEY ? { "x-aurelius-key": process.env.AURELIUS_API_KEY } : {}),
      },
      ...(hasBody ? { body } : {}),
      cache: "no-store",
    });
    const text = await res.text();
    return new Response(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: `Backend not reachable on ${BACKEND_ORIGIN} — is the Express service up?` }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
