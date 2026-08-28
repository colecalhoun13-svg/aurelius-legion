// aurelius/tools/adapters/finance.ts
//
// Cole's PERSONAL finance, drivable from chat. Inward + private by
// construction: it records and reports his own money, never anything business,
// never anything outward. Separate world from the crm/business money tools.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";

export const financeAdapter: ToolAdapter = {
  name: "finance",
  description:
    "Cole's PERSONAL money (separate from the business): net worth, cashflow, spending by category, and runway. Manual + CSV. Private and inward — reports and records his own finances, never business, never outward.",
  actions: [
    {
      name: "dashboard",
      description:
        "Cole's personal money picture: net worth (+ trend), this month's cashflow, spending by category, and runway. Honest at zero. Use for 'how's my money', 'net worth', 'what am I spending', 'my finances'.",
      dataSchema: "{}",
      example: "[TOOL: finance.dashboard {}]",
    },
    {
      name: "add_account",
      description:
        "Add a personal account with its balance. kind: checking|savings|investment|cash|debt (a debt is the amount owed). Adding/updating a balance snapshots net worth. Use for 'add my checking with $4200', 'I have $12k in savings'.",
      dataSchema: '{ name: string, kind?: string, balance?: number|string, currency?: string }',
      example: '[TOOL: finance.add_account {"name":"Chase checking","kind":"checking","balance":4200}]',
    },
    {
      name: "update_balance",
      description: "Update an account's balance (and snapshot net worth). Use for 'my savings is now $15k'.",
      dataSchema: "{ accountId: string, balance: number|string }",
      example: '[TOOL: finance.update_balance {"accountId":"abc","balance":15000}]',
    },
    {
      name: "add_txn",
      description:
        "Record one personal transaction. amount is SIGNED: positive = money in, negative = money out. category optional (income/housing/food/transport/utilities/health/giving/savings/discretionary/other). Use for 'I spent $80 on groceries', 'got paid $2000'.",
      dataSchema: '{ amount: number|string, category?: string, description?: string, date?: string, accountId?: string }',
      example: '[TOOL: finance.add_txn {"amount":-80,"category":"food","description":"groceries"}]',
    },
    {
      name: "import_csv",
      description:
        "Import a batch of transactions (from a bank/brokerage CSV Cole pasted/parsed into rows). Idempotent — re-importing the same rows is a no-op, not a double-count. Each row: { date, amount (signed), description?, category? }. Use for 'import my bank export'.",
      dataSchema: "{ rows: Array<{ date: string, amount: number|string, description?: string, category?: string }> }",
      example: '[TOOL: finance.import_csv {"rows":[{"date":"2026-08-01","amount":-42.5,"description":"gas"}]}]',
    },
    {
      name: "accounts",
      description: "List Cole's personal accounts and balances. Use for 'what accounts do I have'.",
      dataSchema: "{}",
      example: "[TOOL: finance.accounts {}]",
    },
  ],

  async run(action, data): Promise<ToolAdapterResult> {
    try {
      const F = await import("../../finance/service.ts");
      switch (action) {
        case "dashboard":
          return { ok: true, output: await F.financeDashboard() };
        case "accounts":
          return { ok: true, output: { accounts: await F.listAccounts() } };
        case "add_account": {
          if (!data?.name) return { ok: false, output: null, error: "An account needs a name." };
          const acct = await F.addAccount({ name: String(data.name), kind: data?.kind, balance: data?.balance, currency: data?.currency });
          return { ok: true, output: { id: acct.id, name: acct.name, kind: acct.kind, message: "Added — net worth snapshotted." } };
        }
        case "update_balance": {
          if (!data?.accountId || data?.balance == null) return { ok: false, output: null, error: "Need accountId and the new balance." };
          const res = await F.updateBalance(String(data.accountId), data.balance);
          if (!res.ok) return { ok: false, output: null, error: res.error };
          return { ok: true, output: { message: "Balance updated — net worth snapshotted." } };
        }
        case "add_txn": {
          if (data?.amount == null) return { ok: false, output: null, error: "A transaction needs a signed amount (+ in, - out)." };
          const res = await F.addTxn({ amount: data.amount, category: data?.category, description: data?.description, date: data?.date, accountId: data?.accountId });
          if (!res.ok) return { ok: false, output: null, error: res.error };
          return { ok: true, output: { message: "Recorded." } };
        }
        case "import_csv": {
          const rows = Array.isArray(data?.rows) ? data.rows : null;
          if (!rows) return { ok: false, output: null, error: "import_csv needs a `rows` array." };
          const res = await F.importCsv(rows);
          return { ok: true, output: { ...res, message: `Imported ${res.imported}, skipped ${res.skipped} (already had them).` } };
        }
        default:
          return { ok: false, output: null, error: `Unknown finance action: ${action}` };
      }
    } catch (err: any) {
      return { ok: false, output: null, error: err?.message ?? String(err) };
    }
  },
};
