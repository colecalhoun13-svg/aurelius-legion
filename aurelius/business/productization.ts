// aurelius/business/productization.ts
//
// PRODUCTIZATION = RECOMMENDATIONS (Cole's triage: "recommendations, not
// building it for me"). Reads how Cole actually sells and delivers, then
// suggests where a repeatable PRODUCT could sit — a fixed-scope block turned
// into a named program, a recurring deliverable turned self-serve — so his time
// isn't the only thing for sale. It never CREATES a product or sets a price;
// that's Cole's call. It hands him options, grounded in his own facts.
//
// Honest pre-data: with no engagements/sessions yet, it says so and reasons from
// the offer SHAPES he sells (monthly · block · program) rather than pretending
// to see delivery patterns that don't exist. Keyless → dormant-honest (refuses
// to invent recommendations rather than filing an engine error, hard rule 3).

import { prisma } from "../core/db/prisma.ts";
import { runLLM } from "../llm/runLLM.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";

export async function productizationRecommendations(): Promise<{
  ok: boolean;
  recommendations?: string;
  grounding: string;
  error?: string;
}> {
  const [engagements, sessions, offerBlock, bizBlock] = await Promise.all([
    prisma.engagement.count().catch(() => 0),
    prisma.session.count().catch(() => 0),
    import("./offers.ts").then((m) => m.offerContextBlock()).catch(() => ""),
    import("./positioning.ts").then((m) => m.businessContextBlock()).catch(() => ""),
  ]);

  const hasDelivery = engagements > 0 || sessions > 0;
  const grounding = hasDelivery
    ? `from ${engagements} engagement(s) and ${sessions} logged session(s)`
    : "pre-data — reasoned from the offer shapes Cole sells, not from delivery history he doesn't have yet";

  const res = await runLLM({
    taskType: "chat",
    operators: { primary: "business", secondaries: ["content"] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `${bizBlock}\n\n${offerBlock}\n\n` +
      `Recommend 2-4 ways Cole could PRODUCTIZE what he does — turn time-for-money coaching into something more repeatable and scalable (a named fixed-scope program, a self-serve template/course, a group cohort, a done-with-you block). ` +
      `${hasDelivery ? `He has ${engagements} engagement(s) and ${sessions} session(s) of delivery to learn from.` : `He has NO delivery history yet, so reason from the offer shapes he sells and say plainly these are structural suggestions, not data-driven ones.`}\n\n` +
      `RULES: recommendations ONLY — do NOT build the product or invent a price (his call). Each: what it is, who it's for, why it fits HIS standard, and the smallest way to test it. Honest about what you can't know yet. No hype. Return a short numbered list.`,
  });
  const recommendations = (res.text ?? "").trim();
  if (!recommendations || recommendations.length < 40 || engineUnavailableText(recommendations)) {
    return { ok: false, grounding: "none", error: "No engine available — refusing to invent productization advice. Nothing filed." };
  }
  return { ok: true, recommendations, grounding };
}
