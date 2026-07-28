import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

// The one-time door. POST { key } — timing-safe compare against
// APP_UNLOCK_SECRET; success sets the year-long httpOnly cookie the
// middleware checks. The cookie carries HMAC(secret, tag), never the secret.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const secret = process.env.APP_UNLOCK_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: true, note: "lock dormant — no APP_UNLOCK_SECRET set" });

  const body = await request.json().catch(() => ({}));
  const attempt = Buffer.from(String(body?.key ?? ""));
  const truth = Buffer.from(secret);
  const ok = attempt.length === truth.length && timingSafeEqual(attempt, truth);
  if (!ok) return NextResponse.json({ error: "that's not the key" }, { status: 401 });

  const token = createHmac("sha256", secret).update("aurelius-unlock-v1").digest("hex");
  const res = NextResponse.json({ ok: true });
  res.cookies.set("aurelius_unlock", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
