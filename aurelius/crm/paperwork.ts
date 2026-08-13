// aurelius/crm/paperwork.ts
//
// PAPERWORK AUTOPILOT (NORTH_STAR #6) — the onboarding runway lays the TASKS
// ("draft the welcome", "send the intake questions") but never produced the
// documents themselves. This does: it generates the actual onboarding paperwork
// for a new client — the intake questionnaire, a welcome message, and a plain
// coaching-agreement outline — so "send the intake questions" is one review-and-
// send, not a blank page.
//
// INWARD: it drafts; Cole reviews and sends. The intake questionnaire is
// DETERMINISTIC (a fixed, sensible set), so it works even with no LLM — the tool
// is useful keyless. The welcome + agreement are grounded in Cole's real
// business facts and refuse to fabricate (a keyless draft comes back null with
// an honest note, never an error masquerading as a contract). Gym boundary:
// paperwork is client machinery — training-only athletes are refused.

import { prisma } from "../core/db/prisma.ts";

const INTAKE_QUESTIONS = [
  "Training history — how long, what style, what results so far?",
  "The goal, in your own words — what does success look like in 12 weeks?",
  "Weekly schedule — which days/times can you reliably train?",
  "Equipment access — full gym, home setup, or somewhere in between?",
  "Injury history and anything currently bothering you (be specific).",
  "Sport & position (and season timing, if you compete).",
  "Current bests on your main lifts / tests, if you know them.",
  "How you want to communicate — and how often you want to hear from me.",
];

export async function generateOnboardingDocs(clientId: string): Promise<{
  ok: boolean;
  intake?: string[];
  welcome?: string | null;
  agreement?: string | null;
  note: string;
  error?: string;
}> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true, sport: true, isMinor: true, parentName: true, kind: true },
  });
  if (!client) return { ok: false, note: "", error: "No such client." };
  if (client.kind !== "client") {
    return { ok: false, note: "", error: `${client.name} is training-only — onboarding paperwork is client machinery. Promote them first if they've signed.` };
  }

  const audience = client.isMinor && client.parentName ? `${client.parentName} (parent of ${client.name})` : client.name;

  // Welcome + agreement are grounded and refuse to fabricate; the intake set is
  // deterministic and always ships.
  let welcome: string | null = null;
  let agreement: string | null = null;
  try {
    const { runLLM } = await import("../llm/runLLM.ts");
    const { engineUnavailableText } = await import("../llm/nonAnswer.ts");
    const { businessContextBlock } = await import("../business/positioning.ts");
    const { offerContextBlock } = await import("../business/offers.ts");
    const { brandVoiceBlock } = await import("../business/brand.ts");
    const ctx = `${await businessContextBlock()}\n\n${await offerContextBlock()}\n\n${brandVoiceBlock()}`;

    const [w, a] = await Promise.all([
      runLLM({
        taskType: "chat",
        operators: { primary: "business", secondaries: ["content"] },
        noReuse: true,
        omitToolCatalog: true,
        input: `${ctx}\n\nWrite the Day-0 welcome message to ${audience}${client.sport ? ` (${client.sport})` : ""} — what to expect, when the program lands, how check-ins work, one line of belief in them. Cole's voice, warm and clear, standard-setter not hype. Under 140 words. Return only the message.`,
      }),
      runLLM({
        taskType: "chat",
        operators: { primary: "business", secondaries: ["content"] },
        noReuse: true,
        omitToolCatalog: true,
        input: `${ctx}\n\nDraft a PLAIN-LANGUAGE coaching agreement OUTLINE for ${client.name} — scope (what's included/not), the cadence, communication, payment terms if an offer/price is set (else leave a clear blank to fill), and expectations both ways. NOT legal advice and say so in one line. Bullet outline, honest, no invented prices or guarantees. Return only the outline.`,
      }),
    ]);
    const wt = (w.text ?? "").trim();
    const at = (a.text ?? "").trim();
    welcome = wt && wt.length > 30 && !engineUnavailableText(wt) ? wt : null;
    agreement = at && at.length > 30 && !engineUnavailableText(at) ? at : null;
  } catch {
    /* welcome/agreement stay null — the intake set still ships */
  }

  const drafted = [welcome ? "welcome" : null, agreement ? "agreement outline" : null].filter(Boolean);
  const note =
    drafted.length === 2
      ? "Intake questions, welcome, and agreement outline ready to review and send."
      : drafted.length === 1
        ? `Intake questions and the ${drafted[0]} ready; the other needs an LLM key (nothing fabricated).`
        : "Intake questions ready. The welcome + agreement need an LLM key — not drafted rather than faked.";

  return { ok: true, intake: INTAKE_QUESTIONS, welcome, agreement, note };
}
