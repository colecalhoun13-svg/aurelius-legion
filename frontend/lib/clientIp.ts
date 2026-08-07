// frontend/lib/clientIp.ts
//
// A spoof-resistant client IP for best-effort per-IP rate limiting on the public
// funnel routes (/api/standard, /api/start). Reads the SAME env var as the Express
// backend — `TRUST_PROXY` — so the two processes can never desync on how many
// proxies sit in front (council R2 unified the two variables that used to be
// `TRUST_PROXY` here vs `TRUST_PROXY_HOPS`, with opposite defaults).
//
// `TRUST_PROXY` = number of trusted proxy hops. Default 0 = TRUST NOTHING. The
// leftmost X-Forwarded-For entry is CLIENT-CONTROLLED, so with no configured
// proxy we must not trust it — a bot would rotate it for unlimited buckets. With
// N>0, each proxy APPENDS the address it observed, so the real client is the Nth
// entry from the RIGHT, which the client cannot forge past N trusted hops.
//
// On a typical edge deploy (Railway, one hop) set TRUST_PROXY=1 — the SAME value
// the Express side needs for req.ip to be correct. Behind the platform edge,
// x-real-ip is also set and overwrites any client value, so the default-0 path
// still buckets per-client via x-real-ip.
//
// This is a soft abuse guard, not a security boundary — the only thing these
// routes write is a reviewed Lead — but it must not be trivially bypassable.
export function clientIp(request: Request): string {
  const hops = Math.max(0, Number(process.env.TRUST_PROXY ?? "0") || 0);
  const xff = request.headers.get("x-forwarded-for");
  if (hops > 0 && xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) {
      const idx = parts.length - hops; // Nth from the right
      // A hop count set HIGHER than the real chain depth makes idx negative.
      // Fall through to x-real-ip/unknown rather than returning the spoofable
      // leftmost parts[0] — a mis-set-too-high count must fail safe, not open.
      if (idx >= 0 && idx < parts.length) return parts[idx]!;
    }
  }
  // hops=0 (direct, or unconfigured) or no usable XFF: prefer the platform-set
  // x-real-ip (edges set and overwrite it), else a single shared bucket. Never
  // trust the client-controlled leftmost XFF here.
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
