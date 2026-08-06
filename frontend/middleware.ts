// THE APP LOCK (go-live council CRITICAL). The backend key protected nothing
// while the frontend's own API routes — which import the brain directly —
// sat on a public domain with no auth, and the chat proxy LAUNDERED the
// backend key for anonymous visitors. With APP_UNLOCK_SECRET set, every page
// and API route demands the signed unlock cookie; /unlock is the one-time
// door (enter the secret once per device, cookie lives a year). Dormant
// until configured (hard rule 4) so local dev stays frictionless — the
// Railway runbook makes setting it mandatory.

import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  /^\/unlock$/,
  /^\/api\/unlock$/,
  // THE FRONT DOOR. A funnel that demands the unlock secret captures nobody,
  // so the prospect-facing form and its write endpoint are public. They are
  // narrow by construction: /api/start creates a Lead, returns no id, reads
  // nothing, and is rate-limited per IP. Nothing else here is exempt.
  /^\/start$/,
  /^\/api\/start$/,
  /^\/manifest\.webmanifest$/,
  /^\/icons\//,
  /^\/favicon/,
  /^\/apple-touch-icon/,
];

// HMAC(secret, fixed-tag) — the cookie carries a derived token, never the
// secret itself. Edge runtime → Web Crypto.
async function expectedToken(secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("aurelius-unlock-v1"));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function middleware(req: NextRequest) {
  const secret = process.env.APP_UNLOCK_SECRET?.trim();
  if (!secret) return NextResponse.next(); // dormant until configured

  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => p.test(pathname))) return NextResponse.next();

  const cookie = req.cookies.get("aurelius_unlock")?.value ?? "";
  if (cookie && timingSafeEq(cookie, await expectedToken(secret))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "locked — open /unlock in the app first" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  // Carry the destination through the door — a share-sheet payload
  // (/share?url=…) on a locked device must survive the unlock, not vanish.
  const dest = pathname + (req.nextUrl.search || "");
  url.pathname = "/unlock";
  url.search = dest && dest !== "/" ? `?next=${encodeURIComponent(dest)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except Next's own static assets (the crest, chunks, fonts).
  matcher: ["/((?!_next/static|_next/image).*)"],
};
