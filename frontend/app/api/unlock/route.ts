import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { clientIp } from "../../../lib/clientIp";

// The one-time door. POST { key } — timing-safe compare against
// APP_UNLOCK_SECRET; success sets the year-long httpOnly cookie the
// middleware checks. The cookie carries HMAC(secret, tag), never the secret.
export const dynamic = "force-dynamic";

// RATE LIMIT (Release 0 — front door). The unlock cookie is FULL authority: it
// lets a caller drive every /api route, including autonomy/confirm (ship a staged
// outward action). The secret is a human-typed passphrase, so an unthrottled POST
// was an online brute-force to total takeover (security review, highest-severity
// finding). Per-IP throttle with a lockout: a burst of wrong keys from one IP is
// refused with 429 and a cooldown, which a real one-time unlock never hits. In
// memory is correct for single-instance; it degrades safe (fails closed to 429).
const attempts = new Map<string, { n: number; resetAt: number; lockedUntil: number }>();
const WINDOW_MS = 10 * 60 * 1000; // 10 min rolling window
const MAX_PER_WINDOW = 10; // a real unlock takes 1; 10 is generous slack
const LOCKOUT_MS = 15 * 60 * 1000; // after the cap, cool down 15 min

export async function POST(request: Request) {
  const secret = process.env.APP_UNLOCK_SECRET?.trim();
  if (!secret) return NextResponse.json({ ok: true, note: "lock dormant — no APP_UNLOCK_SECRET set" });

  const ip = clientIp(request); // spoof-resistant: not the client-controlled leftmost XFF
  const now = Date.now();
  const rec = attempts.get(ip);
  if (rec && now < rec.lockedUntil) {
    return NextResponse.json(
      { error: "Too many attempts — locked for a few minutes. Slow down." },
      { status: 429 }
    );
  }
  // Keep the map bounded on a long-running process.
  if (attempts.size > 5000) {
    for (const [k, v] of attempts) if (now > v.resetAt && now > v.lockedUntil) attempts.delete(k);
  }

  const body = await request.json().catch(() => ({}));
  const attempt = Buffer.from(String(body?.key ?? ""));
  const truth = Buffer.from(secret);
  const ok = attempt.length === truth.length && timingSafeEqual(attempt, truth);

  if (!ok) {
    // Count this failure; trip the lockout at the cap.
    if (!rec || now > rec.resetAt) {
      attempts.set(ip, { n: 1, resetAt: now + WINDOW_MS, lockedUntil: 0 });
    } else {
      rec.n += 1;
      if (rec.n >= MAX_PER_WINDOW) rec.lockedUntil = now + LOCKOUT_MS;
    }
    return NextResponse.json({ error: "that's not the key" }, { status: 401 });
  }

  // Success — clear any failure record for this IP.
  attempts.delete(ip);

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
