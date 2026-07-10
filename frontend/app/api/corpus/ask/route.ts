import { NextResponse } from "next/server";
import { ask } from "../../../../../aurelius/corpus/ask";

// DB + LLM backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.question || typeof body.question !== "string") {
      return NextResponse.json({ error: "question required" }, { status: 400 });
    }
    return NextResponse.json(await ask(body.question));
  } catch (error: any) {
    console.error("Ask error:", error);
    return NextResponse.json({ error: error?.message ?? "Ask failed" }, { status: 500 });
  }
}
