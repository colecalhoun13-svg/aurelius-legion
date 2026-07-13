// aurelius/wealth/fred.ts
//
// FRED — the St. Louis Fed's economic data, the wealth operator's macro
// ground truth. Free API key (FRED_API_KEY). Dormant-honest: no key →
// the snapshot returns null and the market pulse simply omits the macro
// block, never fabricates it. A handful of load-bearing series; each
// fails independently so one bad fetch doesn't sink the rest.

const BASE = "https://api.stlouisfed.org/fred/series/observations";

// The series that actually move a personal wealth picture.
const SERIES: Array<{ id: string; label: string; unit: string }> = [
  { id: "DFF", label: "Fed funds rate", unit: "%" },
  { id: "DGS10", label: "10-yr Treasury", unit: "%" },
  { id: "T10Y2Y", label: "10y–2y spread", unit: "%" },
  { id: "CPIAUCSL", label: "CPI (index)", unit: "" },
  { id: "UNRATE", label: "Unemployment", unit: "%" },
  { id: "MORTGAGE30US", label: "30-yr mortgage", unit: "%" },
];

export function fredConfigured(): boolean {
  return !!process.env.FRED_API_KEY?.trim();
}

async function latestObservation(id: string, key: string): Promise<{ value: string; date: string } | null> {
  try {
    const url = `${BASE}?series_id=${id}&api_key=${key}&file_type=json&sort_order=desc&limit=1`;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 12_000);
    const res = await fetch(url, { signal: ctl.signal }).finally(() => clearTimeout(t));
    if (!res.ok) return null;
    const json: any = await res.json();
    const obs = json?.observations?.[0];
    if (!obs || obs.value === "." ) return null;
    return { value: obs.value, date: obs.date };
  } catch {
    return null;
  }
}

export type FredSnapshot = { indicators: Array<{ label: string; value: string; date: string }> };

/** Current reading of each macro series. null when unconfigured. */
export async function fredSnapshot(): Promise<FredSnapshot | null> {
  const key = process.env.FRED_API_KEY?.trim();
  if (!key) return null;
  const results = await Promise.all(
    SERIES.map(async (s) => {
      const obs = await latestObservation(s.id, key);
      return obs ? { label: s.label, value: `${obs.value}${s.unit}`, date: obs.date } : null;
    })
  );
  const indicators = results.filter(Boolean) as FredSnapshot["indicators"];
  return indicators.length > 0 ? { indicators } : null;
}

/** One-line-per-indicator block for the market pulse digest. */
export function formatFredForDigest(snap: FredSnapshot): string {
  return ["═══ MACRO (FRED) ═══", ...snap.indicators.map((i) => `${i.label}: ${i.value} (as of ${i.date})`)].join("\n");
}
