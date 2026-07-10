import { NextResponse } from "next/server";
import { listWikiPages, getWikiPage, synthesizeWikiPage } from "../../../../aurelius/wiki/engine";

// DB + LLM backed — never statically evaluate at build time.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const slug = new URL(request.url).searchParams.get("slug");
    if (slug) {
      const page = await getWikiPage(slug);
      if (!page) return NextResponse.json({ error: "not found" }, { status: 404 });
      return NextResponse.json({ page });
    }
    return NextResponse.json({ pages: await listWikiPages() });
  } catch (error: any) {
    console.error("Wiki error:", error);
    return NextResponse.json({ error: error?.message ?? "Failed to load wiki" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
    return NextResponse.json(await synthesizeWikiPage(body.slug, "manual"));
  } catch (error: any) {
    console.error("Wiki rebuild error:", error);
    return NextResponse.json({ error: error?.message ?? "Rebuild failed" }, { status: 500 });
  }
}
