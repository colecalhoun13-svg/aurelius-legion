// aurelius/wiki/livingDocs.ts
//
// THE FIVE LIVING DOCUMENTS (OG doc Parts VI + XIV + XVI).
// Philosophy · Training Science · Business OS · Wealth Principles ·
// Identity Principles — each a standing wiki page that Aurelius rewrites
// as material accumulates (weekly at minimum, on ingestion when their
// domains grow). Seeded here with the OG doc's knowledge-module reading
// maps so each document starts with a charter and a direction instead of
// a blank page. Self-updating rides the existing wiki engine: revisions
// kept, pages embed into recall, vault-mirrored for Obsidian.

import { prisma } from "../core/db/prisma.ts";

export const LIVING_DOCS: Record<string, { title: string; charter: string; readingMap: string[] }> = {
  philosophy: {
    title: "Philosophy — living document",
    charter:
      "Cole's operating philosophy, distilled and evolving. Stoic core: what is in our control, discipline as freedom, character as destiny. This page compounds as philosophical material is absorbed and as patterns in Cole's own decisions emerge.",
    readingMap: ["Marcus Aurelius — Meditations", "Seneca — Letters", "Epictetus — Discourses", "Sun Tzu — Art of War", "Naval — Almanack", "Robert Greene — 33 Strategies"],
  },
  training_science: {
    title: "Training Science — living document",
    charter:
      "The training brain's substrate: progressive overload models, speed-strength methods, readiness and fatigue signals. Feeds the training operator's lens. Never prescribes — Cole builds the programs; this document sharpens the builder.",
    readingMap: ["Verkhoshansky — Supertraining", "Bondarchuk — Transfer of Training", "Zatsiorsky — Science and Practice", "Triphasic method", "Westside conjugate", "Sprint mechanics & plyometric progressions"],
  },
  business: {
    title: "Business OS — living document",
    charter:
      "How the coaching business runs and grows: offers and value stacks, athlete pathways, outreach and follow-up systems, content strategy, client lifecycle, pricing logic. Compounds from business research sweeps and Cole's own client data as it lands.",
    readingMap: ["Offer creation & positioning", "Content frameworks", "Systems thinking / SOPs", "Persuasion & marketing psychology", "Client retention models"],
  },
  wealth: {
    title: "Wealth Principles — living document",
    charter:
      "Capital strategy, evolving: cashflow discipline, risk tiers, opportunity criteria, market regime awareness. Fed daily by the market pulse (crypto · equities · macro) and weekly by strategy synthesis. Signals and analysis only — Cole makes every allocation call.",
    readingMap: ["Cashflow modeling", "Risk management & position sizing", "Macro cycles & liquidity", "Crypto market structure", "Opportunity analysis frameworks"],
  },
  identity: {
    title: "Identity Principles — living document",
    charter:
      "Who Cole is building himself into: discipline, consistency, focus, leadership, the operator mindset. Tracks the traits as patterns in real behavior (score history, follow-through, decisions), not as affirmations.",
    readingMap: ["Discipline & consistency patterns", "Focus protocols", "Leadership principles", "Operator mindset"],
  },
};

function starterContent(slug: string): string {
  const d = LIVING_DOCS[slug]!;
  return [
    `# ${d.title}`,
    "",
    "_Founding edition — this page is rewritten by Aurelius as material accumulates. Every revision is kept._",
    "",
    "## Charter",
    d.charter,
    "",
    "## Reading map (from the v3.4 knowledge modules — feed these into the second brain to grow this document)",
    ...d.readingMap.map((r) => `- ${r}`),
    "",
    "## State of play",
    "Nothing absorbed yet in this domain. The document begins when the first material lands.",
  ].join("\n");
}

/** Seed any missing living documents. Idempotent; safe on every boot. */
export async function ensureLivingDocuments() {
  let created = 0;
  for (const slug of Object.keys(LIVING_DOCS)) {
    const existing = await prisma.wikiPage.findUnique({ where: { slug } });
    if (existing) continue;
    const content = starterContent(slug);
    const page = await prisma.wikiPage.create({
      data: { slug, title: LIVING_DOCS[slug]!.title, domain: slug, content, sourceRefs: { seeded: true } },
    });
    await prisma.wikiRevision.create({
      data: { pageId: page.id, revision: 1, content, reason: "founding edition" },
    });
    created++;
  }
  if (created > 0) {
    console.log(`[livingDocs] seeded ${created} founding documents`);
    // Mirror the founding editions into the vault
    import("./vaultMirror.ts")
      .then((m) => m.mirrorAll())
      .catch((err) => console.warn("[livingDocs] vault mirror failed (non-fatal):", err));
  }
  return { created };
}

export function isLivingDoc(slug: string): boolean {
  return slug in LIVING_DOCS;
}
