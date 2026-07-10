import { NextResponse } from "next/server";
import { getLatestRituals, generateMorningBriefing } from "../../../../aurelius/rituals/engine";

// DB + LLM backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getLatestRituals());
  } catch (error: any) {
    console.error("Rituals error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load rituals" }, { status: 500 });
  }
}

// POST fires the morning briefing on demand (the "brief me" button).
export async function POST() {
  try {
    const { instance, briefing } = await generateMorningBriefing();
    return NextResponse.json({ instanceId: instance.id, briefing });
  } catch (error: any) {
    console.error("Briefing error:", error);
    return NextResponse.json({ error: error?.message ?? "Briefing failed" }, { status: 500 });
  }
}
