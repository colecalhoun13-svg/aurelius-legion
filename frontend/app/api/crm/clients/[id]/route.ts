import { NextResponse } from "next/server";
import { clientDetail } from "../../../../../../aurelius/crm/service";

export const dynamic = "force-dynamic";

/** One client with engagements, sessions, invoices, payments and lifetime value. */
// Next 14 passes `params` as a plain object (the Promise form is Next 15).
// Matching the convention the rest of app/api uses — see corpus/[id].
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const detail = await clientDetail(params.id);
    if (!detail) return NextResponse.json({ error: "No such client." }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load client" }, { status: 500 });
  }
}
