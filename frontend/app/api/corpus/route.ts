import { NextResponse } from "next/server";
import { listCorpus, ingestDocument, ingestUrl } from "../../../../aurelius/corpus/ingest";

// DB-backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ documents: await listCorpus() });
  } catch (error: any) {
    console.error("Corpus list error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load corpus" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.url && typeof body.url === "string") {
      const result = await ingestUrl(body.url, { domain: body.domain });
      return NextResponse.json(result);
    }
    if (!body.title || !body.content) {
      return NextResponse.json({ error: "title + content (or url) required" }, { status: 400 });
    }
    const result = await ingestDocument({
      title: body.title,
      content: body.content,
      domain: body.domain,
      sourceType: body.sourceType ?? "note",
    });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Corpus ingest error:", error);
    return NextResponse.json({ error: error?.message ?? "Ingestion failed" }, { status: 500 });
  }
}
