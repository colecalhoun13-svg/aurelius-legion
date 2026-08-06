import { NextResponse } from "next/server";
import { captureInboundLead } from "../../../../aurelius/crm/leadEngine";

export const dynamic = "force-dynamic";

// THE ONE UNAUTHENTICATED WRITE ON THE FRONTEND.
//
// A funnel that demands an API key captures nobody, so /start and this route
// are exempt from the app lock. That makes them the only public attack surface
// here, so both are deliberately narrow: this creates a Lead and nothing else.
// It cannot read, cannot list, cannot reach any other engine, and returns no id
// — an anonymous caller learns nothing about the pipeline it just entered.
//
// Input is sanitised inside captureInboundLead (defuseDirectives on every free
// text field), because a "message" from a stranger is untrusted text that later
// lands in a prompt.

const hits = new Map<string, { n: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";

  const now = Date.now();
  const win = hits.get(ip);
  if (!win || now > win.resetAt) {
    hits.set(ip, { n: 1, resetAt: now + WINDOW_MS });
  } else if (++win.n > MAX_PER_WINDOW) {
    return NextResponse.json(
      { error: "That's a few too many submissions. Try again later, or just email Cole directly." },
      { status: 429 }
    );
  }
  // Keep the map from growing without bound on a long-running process.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
  }

  try {
    const body = await request.json();
    const out = await captureInboundLead({
      name: body?.name,
      email: body?.email,
      phone: body?.phone,
      sport: body?.sport,
      message: body?.message,
      ref: body?.ref,
      source: "website",
    });
    if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });
    // Never leak the lead id to an anonymous caller.
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Try again, or email Cole directly." }, { status: 400 });
  }
}
