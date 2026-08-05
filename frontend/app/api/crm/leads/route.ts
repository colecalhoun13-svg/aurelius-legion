import { NextResponse } from "next/server";
import { addLead, updateLead, convertLead } from "../../../../../aurelius/crm/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // `convert` is an action on an existing lead, not a new one — routing it
    // here keeps the page to a single endpoint for everything lead-shaped.
    if (body?.action === "convert") {
      if (!body.id) throw new Error("Converting needs the lead's id.");
      return NextResponse.json(await convertLead(String(body.id), body));
    }
    return NextResponse.json(await addLead(body));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to save the lead" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    if (!body?.id) throw new Error("Updating needs the lead's id.");
    return NextResponse.json(await updateLead(String(body.id), body));
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to update the lead" }, { status: 400 });
  }
}
