// The backend's public URL, resolved honestly at click time. Priority:
// 1. NEXT_PUBLIC_BACKEND_URL when set (baked at build).
// 2. Codespaces-style forwarded domains: the frontend lives at
//    <name>-3000.<forwarding-domain>, the backend at <name>-3001 — swap the
//    port segment so Connect links work from the phone PWA too.
// 3. localhost:3001 (local dev, both servers on one machine).
export function backendUrl(): string {
  if (process.env.NEXT_PUBLIC_BACKEND_URL) return process.env.NEXT_PUBLIC_BACKEND_URL;
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    if (hostname.includes("-3000")) {
      return `${protocol}//${hostname.replace("-3000", "-3001")}`;
    }
  }
  return "http://localhost:3001";
}
