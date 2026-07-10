import { NextResponse } from "next/server";
import { listMissions, launchMission } from "../../../../aurelius/missions/engine";

// DB + LLM backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ missions: await listMissions() });
  } catch (error: any) {
    console.error("Missions list error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load missions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.objective || typeof body.objective !== "string") {
      return NextResponse.json({ error: "objective required" }, { status: 400 });
    }
    const mission = await launchMission({
      title: body.title,
      objective: body.objective,
      domain: body.domain,
      operatorName: body.operatorName,
    });
    return NextResponse.json({ mission });
  } catch (error: any) {
    console.error("Mission launch error:", error);
    return NextResponse.json({ error: error?.message ?? "Launch failed" }, { status: 500 });
  }
}
