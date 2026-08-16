import { NextResponse } from "next/server";
import { financeDashboard, addAccount, updateBalance, addTxn, importCsv } from "../../../../aurelius/finance/service";

export const dynamic = "force-dynamic";

// Cole's PERSONAL finance — net worth, cashflow, runway. Private + inward.
export async function GET() {
  try {
    return NextResponse.json(await financeDashboard());
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Failed to load finance" }, { status: 500 });
  }
}

// Inward writes: add an account, update a balance, record a transaction.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    // `op` is the router discriminator so an account's own `kind` survives.
    switch (body?.op) {
      case "account":
        return NextResponse.json(await addAccount({ name: body.name, kind: body.kind, balance: body.balance, currency: body.currency }));
      case "balance": {
        const res = await updateBalance(String(body.accountId), body.balance);
        return res.ok ? NextResponse.json(res) : NextResponse.json({ error: res.error }, { status: 400 });
      }
      case "txn": {
        const res = await addTxn({ amount: body.amount, category: body.category, description: body.description, date: body.date, accountId: body.accountId });
        return res.ok ? NextResponse.json(res) : NextResponse.json({ error: res.error }, { status: 400 });
      }
      case "import_csv": {
        if (!Array.isArray(body.rows)) return NextResponse.json({ error: "import_csv needs a rows array" }, { status: 400 });
        return NextResponse.json(await importCsv(body.rows));
      }
      default:
        return NextResponse.json({ error: "unknown finance write" }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? "Finance write failed" }, { status: 500 });
  }
}
