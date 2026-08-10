import { NextResponse } from "next/server";
import { athleteRoster } from "../../../../aurelius/crm/performance";
import { addClient, promoteClient } from "../../../../aurelius/crm/service";
import { BATTERY, logBattery, batteryRecords } from "../../../../aurelius/training/battery";

// The Athletes roster — every athlete (paying client AND training-only), their
// headline numbers, when they last logged — plus Cole's canonical test battery
// and the roster-wide record wall. Writes here are inward and reversible-by-
// Cole: add an athlete, promote (the ONE door into the business, always behind
// an explicit confirm in the UI), or log a testing day in one battery pass.
// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [athletes, records] = await Promise.all([athleteRoster(), batteryRecords()]);
    return NextResponse.json({ athletes, battery: BATTERY, records });
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
      case "battery": {
        // One testing-day pass: blanks were never sent; each entry runs the
        // full PR/target machinery server-side.
        const clientId = String(body?.clientId ?? "");
        if (!clientId) throw new Error("Which athlete?");
        const entries = Array.isArray(body?.entries)
          ? body.entries.map((e: any) => ({
              label: String(e?.label ?? ""),
              value: Number(e?.value),
              unit: e?.unit ? String(e.unit) : undefined,
            }))
          : [];
        const out = await logBattery(clientId, entries);
        return NextResponse.json(out);
      }
      default:
        throw new Error(`Unknown action: ${body?.action}. Expected add, promote, or battery.`);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Athlete action failed" }, { status: 400 });
  }
}
