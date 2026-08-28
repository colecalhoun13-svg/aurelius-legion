# Personal Finance Dashboard — architecture for review (2026-08-13)

Cole: *"build the architecture at a high level then we can review that"* — so
this is a **proposal to react to, not built code.** Nothing here is implemented
yet. Read it, cut what's wrong, and I'll build exactly what survives.

This is Cole's **personal** money — separate from the business P&L (which already
ships: earned − spent = net, on the Business page). That separation is a hard
line below.

---

## 1. What it's for (the one job)
A private, honest picture of Cole's own money: **what's coming in, what's going
out, and which way net worth is trending** — so a big call (drop the gym to
part-time, raise remote pricing, a large purchase) is made against a real
number, not a vibe. It pairs with the business flight-simulator: the sim models
the *business* move; this shows what it does to *his* life.

## 2. Data source (his call, already made: manual / CSV)
- **CSV import** — Cole exports from his bank/brokerage and drops the file; a
  parser maps columns → transactions. No bank API, no Plaid, no credentials
  stored (see §6). Re-importing is idempotent (dedupe on date+amount+description
  hash) so monthly drops don't double-count.
- **Manual entry** — a quick "add transaction" / "set account balance" for
  what isn't in a CSV (cash, a Venmo, an estimate).
- **Explicitly NOT (v1):** live bank connections. They mean stored credentials
  and a much larger trust surface; parked until Cole asks.

## 3. The shape (proposed schema)
Three new models, all **personal-scoped** (never touched by business queries):

- **`FinanceAccount`** — `{ name, kind: "checking"|"savings"|"investment"|"debt"|"cash", balanceCents, currency, lastBalanceAt }`. The net-worth building blocks.
- **`FinanceTxn`** — `{ accountId?, date, amountCents (signed: +in/−out), category, description, source: "csv"|"manual", importHash }`. Cashflow + spending.
- **`NetWorthSnapshot`** — `{ at, assetsCents, liabilitiesCents, netCents }`. A monthly (or on-demand) stamp so the trend is real history, not recomputed guesses.

Money is integer cents everywhere (same invariant as the business ledger).
Categories reuse a small fixed set (housing, food, transport, giving, savings,
discretionary, income, …) so charts are stable.

## 4. What it shows (outputs)
- **Net worth** — total + the trend line from `NetWorthSnapshot` ("up $X this
  quarter" / honest "down $Y").
- **Cashflow** — this month in vs out, and the run-rate (are you net-positive?).
- **Spending by category** — where it actually goes, biggest first.
- **Runway** — months of expenses covered by liquid assets (the number that
  makes "go part-time" real).
- **Honest at zero / thin data:** with one CSV it says "one month in — trend
  needs a few more," never a confident line through two dots (same discipline as
  the dev curves).

## 5. Where it lives (surface — needs your pick)
Three options, pick one:
- **(A) A `/finance` tab** of its own (like /zero). Cleanest separation; one more
  nav item.
- **(B) A section inside `/zero`** (Athlete Zero → "you, whole": body + money in
  one personal place). Fewer tabs; keeps everything "about Cole" together.
- **(C) Chat-only** (a `self.finance` tool) to start, tab later.
*Recommendation: (A) — money deserves its own room, and it keeps the personal-
finance data visibly separate from everything else.*

## 6. Sensitivity — the hard rules this must obey
- **Never index financial data into the vector store** (hard rule 6, the same
  rule that keeps credentials out). Balances/transactions are written with raw
  prisma and are NOT embedded or recalled — they never leak into a prompt.
- **No credentials, ever.** CSV files are parsed and the file is discarded;
  nothing stores a bank login.
- **Personal boundary, enforced in the query** (the gym-boundary pattern): the
  business P&L, analyst, scoreboard, and ledger NEVER read these tables, and
  this dashboard never reads business `Payment`/`Expense`. Two separate money
  worlds; a review would verify the separation the way the Athlete Zero council
  just verified the self-record boundary.
- **His eyes only.** No outward surface, no sharing, no auto-anything. Pure
  inward reporting.

## 7. Build phases (once you approve the shape)
1. Schema + migration (excise the usual DROP INDEX blocks) + the cents invariant.
2. CSV import (parser + idempotent dedupe) and manual entry — `self.finance` tools.
3. The reads (net worth, cashflow, categories, runway), honest at thin data.
4. The surface you pick in §5.
5. Boundary council (personal↔business separation) + the full verify gate.

## 8. Open questions for you
1. **Surface:** A (`/finance` tab), B (inside `/zero`), or C (chat-first)?
2. **Accounts:** do you want real per-account balances (net worth), or just
   cashflow (in/out) to start?
3. **CSV shape:** whose export (which bank/brokerage columns) should the parser
   target first?
4. **Categories:** use the default set above, or your own list?
5. **Net worth cadence:** monthly auto-snapshot, or only when you update a
   balance?

Answer these (even roughly) and I build §7 to match — nothing random.
