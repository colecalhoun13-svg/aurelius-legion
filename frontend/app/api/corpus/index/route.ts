import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET(request: Request) {
  try {
    const corpusDir = path.join(process.cwd(), "corpus");
    const indexPath = path.join(corpusDir, "corpusIndex.json");

    // Read index file
    const indexRaw = fs.readFileSync(indexPath, "utf-8");
    const index = JSON.parse(indexRaw);

    // Optional domain filter
    const { searchParams } = new URL(request.url);
    const domainFilter = searchParams.get("domain");

    let entries = index.entries || [];

    if (domainFilter) {
      entries = entries.filter((e: any) => e.domain === domainFilter);
    }

    return NextResponse.json({ entries });
  } catch (error) {
    console.error("Corpus index error:", error);
    return NextResponse.json(
      { error: "Failed to load corpus index" },
      { status: 500 }
    );
  }
}
