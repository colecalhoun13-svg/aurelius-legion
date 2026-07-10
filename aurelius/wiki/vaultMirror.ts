// aurelius/wiki/vaultMirror.ts
//
// THE VAULT — the Obsidian-compatible face of the second brain.
// Postgres stays the source of truth (recall, revisions, awareness);
// the vault is a live markdown mirror on disk: one file per wiki page
// under vault/wiki/, one per corpus document under vault/corpus/<domain>/,
// plus a generated index with wikilinks. Point Obsidian (or anything)
// at VAULT_DIR and the brain is browsable, greppable, portable.
//
// Fire-and-forget everywhere — a mirror failure never breaks a write.

import { promises as fs } from "fs";
import path from "path";
import { prisma } from "../core/db/prisma.ts";

const VAULT_DIR = process.env.VAULT_DIR?.trim() || path.resolve(process.cwd(), "vault");

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 80) || "untitled";
}

async function write(rel: string, content: string) {
  const full = path.join(VAULT_DIR, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, "utf8");
}

export async function mirrorWikiPage(page: {
  domain: string;
  title: string;
  content: string;
  revision: number;
  updatedAt?: Date;
}) {
  const frontmatter = [
    "---",
    `title: ${page.title}`,
    `domain: ${page.domain}`,
    `revision: ${page.revision}`,
    `maintained_by: aurelius`,
    `updated: ${(page.updatedAt ?? new Date()).toISOString()}`,
    "---",
    "",
  ].join("\n");
  await write(`wiki/${safeName(page.domain)}.md`, frontmatter + page.content + "\n");
}

export async function mirrorCorpusDoc(doc: {
  domain: string;
  title: string;
  contentText: string;
  sourceType: string;
  sourceUrl?: string | null;
  createdAt?: Date;
}) {
  const frontmatter = [
    "---",
    `title: ${doc.title}`,
    `domain: ${doc.domain}`,
    `source_type: ${doc.sourceType}`,
    doc.sourceUrl ? `source_url: ${doc.sourceUrl}` : null,
    `ingested: ${(doc.createdAt ?? new Date()).toISOString()}`,
    "---",
    "",
  ]
    .filter(Boolean)
    .join("\n");
  await write(
    `corpus/${safeName(doc.domain)}/${safeName(doc.title)}.md`,
    frontmatter + doc.contentText + "\n"
  );
}

/** Regenerate the vault index with wikilinks — the brain's front door. */
export async function mirrorIndex() {
  const [pages, docs] = await Promise.all([
    prisma.wikiPage.findMany({ select: { domain: true, revision: true }, orderBy: { domain: "asc" } }),
    prisma.corpusDocument.findMany({
      select: { domain: true, title: true },
      orderBy: [{ domain: "asc" }, { createdAt: "desc" }],
    }),
  ]);
  const byDomain = new Map<string, string[]>();
  for (const d of docs) {
    byDomain.set(d.domain, [...(byDomain.get(d.domain) ?? []), d.title]);
  }
  const lines = [
    "# Aurelius — Second Brain",
    "",
    "_Generated mirror. Source of truth is the OS; edit there, not here._",
    "",
    "## Syntheses",
    ...pages.map((p) => `- [[wiki/${safeName(p.domain)}|${p.domain}]] (rev ${p.revision})`),
    "",
    "## Corpus",
  ];
  for (const [domain, titles] of byDomain) {
    lines.push(`### ${domain}`);
    for (const t of titles) lines.push(`- [[corpus/${safeName(domain)}/${safeName(t)}|${t}]]`);
  }
  await write("INDEX.md", lines.join("\n") + "\n");
}

/** Full rebuild — every page, every document, the index. */
export async function mirrorAll() {
  const [pages, docs] = await Promise.all([
    prisma.wikiPage.findMany(),
    prisma.corpusDocument.findMany(),
  ]);
  for (const p of pages) await mirrorWikiPage(p);
  for (const d of docs) await mirrorCorpusDoc(d);
  await mirrorIndex();
  console.log(`[vault] mirrored ${pages.length} pages, ${docs.length} documents → ${VAULT_DIR}`);
  return { pages: pages.length, docs: docs.length, vaultDir: VAULT_DIR };
}
