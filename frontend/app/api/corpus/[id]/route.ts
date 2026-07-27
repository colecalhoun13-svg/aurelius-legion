import { NextResponse } from "next/server";
import { getCorpusDoc, forgetDocument } from "../../../../../aurelius/corpus/ingest";

// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const doc = await getCorpusDoc(params.id);
    if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ document: doc });
  } catch (error: any) {
    console.error("Corpus doc error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load document" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const result = await forgetDocument(params.id);
    if (!result.forgotten) return NextResponse.json({ error: result.reason ?? "couldn't forget" }, { status: 400 });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Corpus forget error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to forget" }, { status: 500 });
  }
}
