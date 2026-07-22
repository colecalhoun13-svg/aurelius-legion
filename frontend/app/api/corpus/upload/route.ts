import { NextResponse } from "next/server";

// Research Drop — browser upload → the second brain's hardened ingest
// pipeline (same guards as the inbox folder: allowlist, size cap, defusing,
// content-hash dedup, honest failure on scanned PDFs).
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const filename = body?.filename ? String(body.filename) : "";
    const contentBase64 = body?.contentBase64 ? String(body.contentBase64) : "";
    if (!filename || !contentBase64) {
      return NextResponse.json({ ok: false, error: "filename + contentBase64 required" }, { status: 400 });
    }
    const { uploadDocument } = await import("../../../../../aurelius/corpus/upload");
    const result = await uploadDocument({
      filename,
      contentBase64,
      domain: body?.domain ? String(body.domain) : undefined,
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  } catch (error: any) {
    console.error("Research Drop upload error:", error);
    return NextResponse.json({ ok: false, error: error?.message ?? "upload failed" }, { status: 500 });
  }
}
