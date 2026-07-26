"use client";

// The chrome now comes from the route group's layout — this page just holds
// the chat. (PR5 of the UX program replaces this with the One Home.)
import { AureliusChat } from "../../components/AureliusChat";

export default function Home() {
  return (
    <div className="flex items-center justify-center h-full">
      <AureliusChat />
    </div>
  );
}
