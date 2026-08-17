"use client";

// PERSONAL FINANCE — Cole's own money, private. Net worth (+ trend), this
// month's cashflow, spending by category, runway. Separate world from the
// business page. Empty-honest: nothing entered → it says how to start, never a
// faked number. Same fetch → kit render pattern as the rest of the app.

import { useCallback, useEffect, useState } from "react";
import { Btn, Divider, Panel, SectionLabel, Stat } from "../../../components/kit";

type Acct = { id: string; name: string; kind: string; balance: string; balanceCents: number };
type Dash = {
  headline: string; empty: boolean;
  netWorth: { net: string; assets: string; liabilities: string; netCents: number; trend: { at: string; net: string; netCents: number }[]; accounts: Acct[] };
  cashflow: { month: string; in: string; out: string; net: string; netCents: number; byCategory: { category: string; label: string }[] };
  runway: { months: number | null; note: string };
  error?: string;
};

const KINDS = ["checking", "savings", "investment", "cash", "debt"];

export default function FinancePage() {
  const [d, setD] = useState<Dash | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  // add-account form
  const [name, setName] = useState("");
  const [kind, setKind] = useState("checking");
  const [balance, setBalance] = useState("");
  // add-txn form
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");
  // CSV import
  const [csv, setCsv] = useState("");
  const [importMsg, setImportMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/finance");
      if (!res.ok) return setFailed(true);
      setD(await res.json());
      setFailed(false);
    } catch { setFailed(true); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function post(body: any) {
    setBusy(true);
    try {
      await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      await load();
    } finally { setBusy(false); }
  }

  // Parse pasted CSV → {date, amount, description, category} rows. Skips a header
  // line, tolerates quoted fields, ignores blanks. importCsv is idempotent
  // (importHash), so re-pasting the same export never double-counts.
  async function importCsv() {
    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const cells = (l: string) => l.match(/(".*?"|[^,]+)(?=,|$)/g)?.map((c) => c.replace(/^"|"$/g, "").trim()) ?? [];
    const start = /date|amount|description/i.test(lines[0]) ? 1 : 0;
    const rows = lines.slice(start).map((l) => {
      const c = cells(l);
      return { date: c[0] ?? "", amount: c[1] ?? "", description: c[2] ?? undefined, category: c[3] ?? undefined };
    }).filter((r) => r.date && r.amount);
    if (rows.length === 0) { setImportMsg("Couldn't read any rows — expected: date, amount, description, category"); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/finance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "import_csv", rows }) });
      const out = await res.json().catch(() => ({}));
      setImportMsg(res.ok ? `Imported ${out.imported ?? 0}, skipped ${out.skipped ?? 0} (already there).` : (out.error ?? "Import failed."));
      setCsv("");
      await load();
    } finally { setBusy(false); }
  }

  if (failed) return <div className="au-card" style={{ margin: "2rem auto", maxWidth: 560, textAlign: "center", color: "var(--ink2)" }}>Couldn&apos;t load your finances right now.</div>;
  if (!d) return <div style={{ padding: "2rem", color: "var(--ink3)" }}>Loading…</div>;

  const nw = d.netWorth;
  const cf = d.cashflow;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem 1rem 4rem" }}>
      <h1 className="au-title" style={{ fontSize: 30, marginBottom: ".3rem" }}>Finance</h1>
      <p style={{ color: "var(--ink3)", marginBottom: "1.6rem" }}>Your money — private. {d.empty ? "" : d.headline}</p>

      {/* HERO — net worth, this month, runway */}
      <section className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-8">
        <Stat label="Net worth" value={nw.net} tone={nw.netCents >= 0 ? "money" : "alert"} />
        <Stat label={`This month (${cf.month})`} value={cf.net} tone={cf.netCents >= 0 ? "money" : "alert"} hint={`${cf.in} in · ${cf.out} out`} />
        <Stat label="Runway" value={d.runway.months != null ? `${d.runway.months}` : "—"} unit={d.runway.months != null ? "mo" : undefined} hint={d.runway.months != null ? d.runway.note : "needs a few months of spend"} />
      </section>

      <Divider />

      {/* ACCOUNTS */}
      <SectionLabel>Accounts</SectionLabel>
      <div style={{ height: ".7rem" }} />
      {nw.accounts.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: ".4rem", marginBottom: "1rem" }}>
          {nw.accounts.map((a) => (
            <div key={a.id} className="au-lrow" style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <span style={{ color: "var(--ink)" }}>{a.name} <span style={{ color: "var(--ink3)", fontSize: 12, textTransform: "uppercase", letterSpacing: ".06em" }}>{a.kind}</span></span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: a.kind === "debt" ? "var(--danger)" : "var(--ink)" }}>{a.kind === "debt" ? `(${a.balance})` : a.balance}</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--ink2)", marginBottom: "1rem" }}>No accounts yet — add one to start your net worth.</p>
      )}

      {/* add account */}
      <Panel tier="glass">
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center" }}>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" className="au-input" style={inputStyle} />
          <select value={kind} onChange={(e) => setKind(e.target.value)} style={inputStyle}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <input value={balance} onChange={(e) => setBalance(e.target.value)} placeholder={kind === "debt" ? "amount owed" : "balance"} inputMode="decimal" style={{ ...inputStyle, width: 120 }} />
          <Btn disabled={busy || !name.trim()} onClick={async () => { await post({ op: "account", name: name.trim(), kind, balance: balance || 0 }); setName(""); setBalance(""); }}>Add</Btn>
        </div>
      </Panel>

      <Divider />

      {/* SPENDING */}
      <SectionLabel>Where it went this month</SectionLabel>
      <div style={{ height: ".7rem" }} />
      {cf.byCategory.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: ".4rem", marginBottom: "1rem" }}>
          {cf.byCategory.map((c) => (
            <div key={c.category} className="au-lrow" style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
              <span style={{ color: "var(--ink)", textTransform: "capitalize" }}>{c.category}</span>
              <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink2)" }}>{c.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ color: "var(--ink2)", marginBottom: "1rem" }}>No transactions this month yet.</p>
      )}

      {/* add txn */}
      <Panel tier="glass">
        <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", alignItems: "center" }}>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="+ in / - out" inputMode="decimal" style={{ ...inputStyle, width: 120 }} />
          <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="description (auto-categorized)" style={{ ...inputStyle, flex: 1, minWidth: 160 }} />
          <Btn disabled={busy || !amount} onClick={async () => { await post({ op: "txn", amount, description: desc }); setAmount(""); setDesc(""); }}>Record</Btn>
        </div>
        <p className="au-kicker" style={{ display: "block", marginTop: ".6rem", fontSize: 12, color: "var(--ink3)" }}>
          Signed: a positive number is money in, negative is money out. Private — never business, never shared.
        </p>
      </Panel>

      <Divider />

      {/* IMPORT A CSV — bulk transactions from a bank export, idempotent */}
      <SectionLabel>Import a CSV</SectionLabel>
      <div style={{ height: ".7rem" }} />
      <Panel tier="glass">
        <textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          placeholder={"Paste rows: date, amount, description, category\n2026-08-01, -42.10, Groceries, food\n2026-08-02, 3200, Client payment, income"}
          rows={5}
          style={{ ...inputStyle, width: "100%", fontFamily: "var(--mono, monospace)", resize: "vertical" }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: ".7rem", marginTop: ".6rem", flexWrap: "wrap" }}>
          <Btn disabled={busy || !csv.trim()} onClick={importCsv}>Import</Btn>
          {importMsg && <span style={{ color: "var(--ink2)", fontSize: 13 }}>{importMsg}</span>}
        </div>
        <p className="au-kicker" style={{ display: "block", marginTop: ".6rem", fontSize: 12, color: "var(--ink3)" }}>
          A positive amount is money in, negative is money out. Re-importing the same export won&apos;t double-count.
        </p>
      </Panel>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--bg1)", border: "1px solid var(--line1)", borderRadius: 6,
  padding: ".45rem .6rem", color: "var(--ink)", fontSize: 14,
};
