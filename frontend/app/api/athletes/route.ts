import { NextResponse } from "next/server";
import { athleteRoster } from "../../../../aurelius/crm/performance";
import { addClient, promoteClient } from "../../../../aurelius/crm/service";

// The Athletes roster — every athlete (paying client AND training-only), their
// headline numbers, and when they last logged. Reads go through the backend's
// performance view; the two writes here are both inward and reversible-by-Cole:
// add an athlete, or promote a training-only athlete into the business (the
// ONE door, always behind an explicit confirm in the UI).
// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const athletes = await athleteRoster();
    return NextResponse.json({ athletes });
  } catch (error: any) {
    console.error("Athletes API error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load athletes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    switch (body?.action) {
      case "add": {
        const gradYearRaw = body.gradYear;
        const gradYear =
          gradYearRaw === undefined || gradYearRaw === null || gradYearRaw === "" ? undefined : Number(gradYearRaw);
        if (gradYear !== undefined && !Number.isInteger(gradYear)) throw new Error("Grad year must be a whole year.");
        const client = await addClient({
          name: String(body.name ?? ""),
          kind: body.kind ? String(body.kind) : undefined,
          sport: body.sport ? String(body.sport) : undefined,
          position: body.position ? String(body.position) : undefined,
          gradYear,
          notes: body.notes ? String(body.notes) : undefined,
        });
        return NextResponse.json({ id: client.id, name: client.name, kind: client.kind });
      }
      case "promote": {
        const id = String(body?.id ?? "");
        if (!id) throw new Error("Which athlete?");
        const client = await promoteClient(id);
        return NextResponse.json({ id: client.id, name: client.name, kind: client.kind });
      }
      default:
        throw new Error(`Unknown action: ${body?.action}. Expected add or promote.`);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Athlete action failed" }, { status: 400 });
  }
}
