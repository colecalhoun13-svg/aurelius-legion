import { NextResponse } from "next/server";
import { assessStandard, summarizeStandard, type StandardInput } from "../../../../aurelius/assessment/benchmarks";
import { captureInboundLead } from "../../../../aurelius/crm/leadEngine";

export const dynamic = "force-dynamic";

// THE STANDARD — public, two-phase, and narrow.
//
// Phase 1 (numbers only): returns the static benchmark card. No PII, no write,
// no model — a pure function over a static table, so a bot hitting it costs
// nothing and waits on nothing.
// Phase 2 (numbers + email): ALSO creates a Lead (source "assessment"), with
// the numbers summarised into its notes and the ?ref carried through, then
// returns the same card plus a captured flag. Never returns the lead id.
//
// Rate-limited per IP exactly like /api/start — this is the second public
// write surface on the frontend.

const hits = new Map<string, { n: number; resetAt: number }>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 15; // higher than /start: phase 1 is a harmless compute

function toNum(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const win = hits.get(ip);
  if (!win || now > win.resetAt) hits.set(ip, { n: 1, resetAt: now + WINDOW_MS });
  else if (++win.n > MAX_PER_WINDOW) {
    return NextResponse.json({ error: "Too many tries. Give it a minute." }, { status: 429 });
  }
  if (hits.size > 5000) for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);

  try {
    const body = await request.json();
    const input: StandardInput = {
      sport: typeof body?.sport === "string" ? body.sport.slice(0, 60) : undefined,
      bodyweightLbs: toNum(body?.bodyweightLbs),
      squatLbs: toNum(body?.squatLbs),
      verticalInches: toNum(body?.verticalInches),
      gradYear: toNum(body?.gradYear),
    };
    const result = assessStandard(input);

    let captured = false;
    const email = typeof body?.email === "string" ? body.email.trim() : "";
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    // Only write a lead when they hand over an email AND a name — the card is
    // free; the pipeline entry is the gated exchange.
    if (email && name) {
      const out = await captureInboundLead({
        name,
        email,
        sport: input.sport,
        message: summarizeStandard(input, result),
        ref: typeof body?.ref === "string" ? body.ref : undefined,
        source: "assessment",
      });
      captured = !!out.ok;
    }

    return NextResponse.json({ result, captured });
  } catch {
    return NextResponse.json({ error: "Something went wrong. Try again, or email Cole directly." }, { status: 400 });
  }
}
