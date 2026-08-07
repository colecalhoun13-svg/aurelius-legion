// frontend/lib/clientIp.ts
//
// A spoof-resistant client IP for best-effort per-IP rate limiting on the public
// funnel routes (/api/standard, /api/start). The LEFTMOST X-Forwarded-For entry
// is CLIENT-CONTROLLED: a bot sets `X-Forwarded-For: <random>` per request and
// the proxy merely prepends the real address, so trusting `xff[0]` hands every
// attacker an unlimited supply of fresh rate-limit buckets. Each proxy APPENDS
// the address it actually observed, so the trustworthy entry is counted from the
// RIGHT: with N trusted proxies in front (TRUST_PROXY_HOPS, default 1 — one
// hosting edge), the real client is the Nth entry from the right, which the
// client cannot forge. Falls back to x-real-ip, then a constant.
//
// This is a soft abuse guard, not a security boundary — the only thing these
// routes write is a reviewed Lead — but it must not be trivially bypassable.
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) {
      const hops = Math.max(1, Number(process.env.TRUST_PROXY_HOPS ?? "1") || 1);
      const idx = parts.length - hops; // Nth from the right
      return parts[idx >= 0 ? idx : 0] || parts[parts.length - 1]!;
    }
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
