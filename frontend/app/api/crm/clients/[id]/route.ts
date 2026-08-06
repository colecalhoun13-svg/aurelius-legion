import { NextResponse } from "next/server";
import { clientDetail } from "../../../../../../aurelius/crm/service";

export const dynamic = "force-dynamic";

/** One client with engagements, sessions, invoices, payments and lifetime value. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const detail = await clientDetail(id);
    if (!detail) return NextResponse.json({ error: "No such client." }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load client" }, { status: 500 });
  }
}
