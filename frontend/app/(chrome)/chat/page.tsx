"use client";

// CHAT — the voice, full page. One box, the whole mind: every page is a
// view of it; this is the room itself. The page renders the EXISTING
// AureliusChat component (unmodified — it keeps its seat on Home too)
// full-height under the ceremony header. Nothing else lives here.

import { AureliusChat } from "../../../components/AureliusChat";

export default function ChatPage() {
  return (
    <div className="au-horizon">
      <header className="text-center pt-2">
        <h1 className="au-title" style={{ fontSize: "clamp(2rem,5vw,2.6rem)", lineHeight: 1.1 }}>
          Aurelius
        </h1>
        <p className="au-kicker" style={{ display: "block", marginTop: ".5rem" }}>
          one box, the whole mind
        </p>
      </header>

      {/* The room: a flex column so the chat's own flex-1 scroll box fills it. */}
      <div className="flex flex-col min-h-[70vh] max-w-3xl mx-auto mt-6">
        <AureliusChat />
      </div>
    </div>
  );
}
