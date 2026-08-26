// aurelius/router/financeRouter.ts — Cole's PERSONAL finance. Private, inward.
// Net worth, cashflow, runway; account/balance/txn/CSV writes. Mounted at
// /api/finance. Moved here from the Next route so it runs in one process.

import { Router, type Request, type Response } from "express";

export const financeRouter = Router();

financeRouter.get("/", async (_req: Request, res: Response) => {
  try {
    const { financeDashboard } = await import("../finance/service.ts");
    res.json(await financeDashboard());
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to load finance" });
  }
});

// `op` is the discriminator so an account's own `kind` survives.
financeRouter.post("/", async (req: Request, res: Response) => {
  try {
    const b = req.body ?? {};
    const s = await import("../finance/service.ts");
    switch (b.op) {
      case "account":
        return res.json(await s.addAccount({ name: b.name, kind: b.kind, balance: b.balance, currency: b.currency }));
      case "balance": {
        const r = await s.updateBalance(String(b.accountId), b.balance);
        return r.ok ? res.json(r) : res.status(400).json({ error: r.error });
      }
      case "txn": {
        const r = await s.addTxn({ amount: b.amount, category: b.category, description: b.description, date: b.date, accountId: b.accountId });
        return r.ok ? res.json(r) : res.status(400).json({ error: r.error });
      }
      case "import_csv": {
        if (!Array.isArray(b.rows)) return res.status(400).json({ error: "import_csv needs a rows array" });
        return res.json(await s.importCsv(b.rows));
      }
      default:
        return res.status(400).json({ error: "unknown finance write" });
    }
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Finance write failed" });
  }
});
