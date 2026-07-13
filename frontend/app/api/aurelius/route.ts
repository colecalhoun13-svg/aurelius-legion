import { NextResponse } from "next/server";

// The chat plane. The Aurelius conversational handler lives in the backend
// Express app (index.ts :: POST /api/aurelius) with a large amount of
// routing/reflection/save logic, so we proxy to it rather than duplicate it.
//
// Critical: this proxy runs SERVER-SIDE, so it reaches the backend over
// loopback (127.0.0.1:3001) — no Codespaces port-forwarding, no public URL,
// nothing to go stale when the codespace host changes. The browser only ever
// talks to this same-origin route. Override the target with BACKEND_ORIGIN
// if the backend runs elsewhere (e.g. the Mac Mini deploy).
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN?.trim() || "http://127.0.0.1:3001";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const res = await fetch(`${BACKEND_ORIGIN}/api/aurelius`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    // The backend (port 3001) isn't reachable — almost always "it isn't
    // running." Say so plainly instead of a generic 500.
    console.error("[api/aurelius] backend unreachable:", error?.message ?? error);
    return NextResponse.json(
      {
        error:
          "Backend not reachable on " +
          BACKEND_ORIGIN +
          " — start it with `cd aurelius && npx tsx index.ts`.",
      },
      { status: 502 }
    );
  }
}
