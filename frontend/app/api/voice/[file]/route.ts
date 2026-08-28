import { NextResponse } from "next/server";

// VOICE PROXY. The backend serves Cole's voice clips at /api/voice/<file>
// behind its API-key lock, and on loopback only (127.0.0.1:3001) — the browser
// can't reach loopback, and the Next origin has no such route, so the relative
// url synthesizeSpeech returns would 404 (reachability review). This same-origin
// route streams the clip through, mirroring /api/aurelius: the browser talks to
// this, this talks to the backend over loopback with the server-side key. The
// clip is Cole's own words, so this route sits behind the app unlock like every
// other /api route (middleware.ts) — reachable to him, not to the world.
const BACKEND_ORIGIN = process.env.BACKEND_ORIGIN?.trim() || "http://127.0.0.1:3001";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { file: string } }) {
  // The param becomes part of a backend path — strip anything but a safe
  // basename so it can't traverse, and require the .mp3 the synthesizer writes.
  const file = (params.file || "").replace(/[^a-zA-Z0-9._-]/g, "");
  if (!/^[a-zA-Z0-9._-]+\.mp3$/.test(file)) {
    return NextResponse.json({ error: "bad file" }, { status: 400 });
  }
  try {
    const res = await fetch(`${BACKEND_ORIGIN}/api/voice/${file}`, {
      headers: { ...(process.env.AURELIUS_API_KEY ? { "x-aurelius-key": process.env.AURELIUS_API_KEY } : {}) },
    });
    if (!res.ok) return NextResponse.json({ error: "clip not found" }, { status: res.status });
    const buf = Buffer.from(await res.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=604800" },
    });
  } catch {
    return NextResponse.json({ error: `Voice backend unreachable on ${BACKEND_ORIGIN}` }, { status: 502 });
  }
}
