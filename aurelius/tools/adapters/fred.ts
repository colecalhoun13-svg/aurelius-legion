// aurelius/tools/adapters/fred.ts
//
// FRED as a registered tool — the wealth operator pulls current macro
// readings on demand. Keyless-honest: no FRED_API_KEY → one clear line.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import { fredConfigured, fredSnapshot } from "../../wealth/fred.ts";

export const fredAdapter: ToolAdapter = {
  name: "fred",
  description: "Macro economic data (FRED): fed funds, Treasuries, yield curve, CPI, unemployment, mortgage rates.",
  actions: [
    {
      name: "macro_snapshot",
      description: "Current reading of the load-bearing macro series.",
      dataSchema: "{} (no fields)",
    },
  ],
  async run(action): Promise<ToolAdapterResult> {
    if (action !== "macro_snapshot") return { ok: false, output: null, error: `unknown fred action: ${action}` };
    if (!fredConfigured()) {
      return { ok: false, output: null, error: "FRED not configured — add a free FRED_API_KEY (fred.stlouisfed.org)." };
    }
    const snap = await fredSnapshot();
    if (!snap) return { ok: false, output: null, error: "FRED returned no data (all series failed — transient)." };
    return {
      ok: true,
      output: { summary: `${snap.indicators.length} macro indicators`, indicators: snap.indicators },
    };
  },
};
