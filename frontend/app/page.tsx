"use client";

import { AureliusChat } from "../components/AureliusChat";
import AureliusChrome from "./components/AureliusChrome";

export default function Home() {
  return (
    <AureliusChrome>
      <div className="flex items-center justify-center h-full">
        <AureliusChat />
      </div>
    </AureliusChrome>
  );
}
