// aurelius/business/flightSim.ts
//
// BUSINESS FLIGHT-SIMULATOR (NORTH_STAR #35) — model a move BEFORE Cole
// commits to it. "Raise the block to $350 and add three clients" / "drop the
// gym to part-time and go all-in remote" — instead of finding out live, he
// flies it first: projected revenue, the capacity/hours it demands, what would
// have to be TRUE for it to work, and the biggest way it breaks.
//
// Grounded in his ACTUAL numbers (the ledger, capacity, offers), not a generic
// spreadsheet — and honest that it's a MODEL, not a promise: it names its
// assumptions rather than hiding them, and where his real numbers are unknown
// (no price set, capacity not answered) it says the projection is a shape, not
// a forecast. Keyless → refuses rather than inventing (hard rule 3).

import { runLLM } from "../llm/runLLM.ts";
import { engineUnavailableText } from "../llm/nonAnswer.ts";

export async function flightSimulate(scenario: string): Promise<{
  ok: boolean;
  projection?: string;
  grounding: string;
  error?: string;
}> {
  const plan = (scenario ?? "").trim();
  if (!plan) return { ok: false, grounding: "none", error: "Model WHAT? Describe the move — e.g. 'raise the block to $350 and add 3 clients'." };

  const [ledger, capacity, offerBlock, bizBlock] = await Promise.all([
    import("../crm/ledger.ts").then((m) => m.moneyLedger()).catch(() => null),
    import("./capacity.ts").then((m) => m.capacityHealth()).catch(() => null),
    import("./offers.ts").then((m) => m.offerContextBlock()).catch(() => ""),
    import("./positioning.ts").then((m) => m.businessContextBlock()).catch(() => ""),
  ]);

  const numbers = [
    ledger ? `Earned to date: ${ledger.earned} (${ledger.paymentCount} payment(s)).` : null,
    capacity ? `Capacity: ${capacity.headline}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const grounding = ledger || capacity ? "modeled against Cole's real ledger + capacity" : "no real numbers yet — a structural model only";

  const res = await runLLM({
    taskType: "chat",
    operators: { primary: "business", secondaries: ["wealth"] },
    noReuse: true,
    omitToolCatalog: true,
    input:
      `${bizBlock}\n\n${offerBlock}\n\n${numbers}\n\n` +
      `Cole is weighing this move:\n"${plan}"\n\n` +
      `Fly it before he commits. Give him:\n` +
      `1. PROJECTION — the likely outcome on revenue, capacity/hours, and timeline, using his real numbers where they exist.\n` +
      `2. WHAT HAS TO BE TRUE — the assumptions the projection rests on, named plainly.\n` +
      `3. BIGGEST RISK — the most likely way it breaks, and the cheapest way to test it first.\n` +
      `RULES: it's a MODEL, not a promise — say what you're assuming. Where a real number is missing (no price set, capacity not answered), say the projection is a shape, not a forecast, and name the number you'd need. No false precision, no hype. Be concrete and short.`,
  });
  const projection = (res.text ?? "").trim();
  if (!projection || projection.length < 60 || engineUnavailableText(projection)) {
    return { ok: false, grounding: "none", error: "No engine available — refusing to model on a guess. Nothing filed." };
  }
  return { ok: true, projection, grounding };
}
