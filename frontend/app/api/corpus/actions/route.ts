import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, id, payload } = body;

    const corpusDir = path.join(process.cwd(), "corpus");
    const indexPath = path.join(corpusDir, "corpusIndex.json");

    // Load index
    const indexRaw = fs.readFileSync(indexPath, "utf-8");
    const index = JSON.parse(indexRaw);

    const entry = index.entries.find((e: any) => e.id === id);
    if (!entry) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const entryPath = path.join(corpusDir, entry.file);

    // Load entry file
    const entryRaw = fs.readFileSync(entryPath, "utf-8");
    let entryData = JSON.parse(entryRaw);

    // Handle actions
    switch (action) {
      case "update":
        entryData = { ...entryData, ...payload };
        break;

      case "retag":
        entryData.tags = payload.tags;
        break;

      case "delete":
        index.entries = index.entries.filter((e: any) => e.id !== id);
        fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));
        fs.unlinkSync(entryPath);
        return NextResponse.json({ success: true });

      default:
        return NextResponse.json(
          { error: "Unknown action" },
          { status: 400 }
        );
    }

    // Save updated entry
    fs.writeFileSync(entryPath, JSON.stringify(entryData, null, 2));

    // Save updated index if needed
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

    return NextResponse.json({ success: true, entry: entryData });
  } catch (error) {
    console.error("Corpus action error:", error);
    return NextResponse.json(
      { error: "Failed to process corpus action" },
      { status: 500 }
    );
  }
}
