"use client";

// SPARK PRIMITIVES — the app's entire charting language: inline SVG, gold
// on black, no libraries. Small on purpose; a dashboard here is a glance,
// not a BI tool. Nulls are skipped honestly (a week without data draws no
// point rather than a fake zero).

const GOLD = "#d4af37";

export function SparkLine({
  values,
  width = 240,
  height = 48,
  min,
  max,
  suffix = "",
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  const pts = values
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => p.v !== null && p.v !== undefined);
  if (pts.length === 0) {
    return <span className="text-xs text-neutral-600 italic">no data yet — fills in as weeks accrue</span>;
  }
  const lo = min ?? Math.min(...pts.map((p) => p.v));
  const hi = max ?? Math.max(...pts.map((p) => p.v));
  const span = hi - lo || 1;
  const pad = 6;
  const x = (i: number) => (values.length < 2 ? width / 2 : pad + (i / (values.length - 1)) * (width - pad * 2));
  const y = (v: number) => height - pad - ((v - lo) / span) * (height - pad * 2);
  const d = pts.map((p, idx) => `${idx === 0 ? "M" : "L"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1]!;
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="overflow-visible w-full max-w-full h-auto" style={{ maxWidth: width }}>
        <path d={d} fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinejoin="round" opacity="0.9" />
        {pts.length === 1 && <circle cx={x(last.i)} cy={y(last.v)} r="2.5" fill={GOLD} />}
        <circle cx={x(last.i)} cy={y(last.v)} r="2.5" fill={GOLD} />
      </svg>
      <span className="text-sm text-aurelius-gold font-semibold">
        {last.v}
        {suffix}
      </span>
    </span>
  );
}

export function SparkBars({
  values,
  labels,
  width = 240,
  height = 56,
}: {
  values: number[];
  labels?: string[];
  width?: number;
  height?: number;
}) {
  if (values.length === 0) return null;
  const hi = Math.max(...values, 1);
  const gap = 3;
  const bw = Math.max(4, (width - gap * (values.length - 1)) / values.length);
  const chartH = labels ? height - 14 : height;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-full h-auto" style={{ maxWidth: width }}>
      {values.map((v, i) => {
        const h = Math.max(v > 0 ? 3 : 1, (v / hi) * (chartH - 4));
        return (
          <g key={i}>
            <rect
              x={i * (bw + gap)}
              y={chartH - h}
              width={bw}
              height={h}
              rx="1.5"
              fill={v > 0 ? GOLD : "#3a3a3a"}
              opacity={v > 0 ? 0.85 : 0.5}
            />
            {labels?.[i] && (
              <text x={i * (bw + gap) + bw / 2} y={height - 2} textAnchor="middle" fontSize="8" fill="#737373">
                {labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** A row of day-dots — the habit consistency grid (done = gold, missed = dim). */
export function DotRow({ days }: { days: boolean[] }) {
  return (
    <span className="inline-flex items-center gap-[3px]">
      {days.map((on, i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-[3px] ${on ? "bg-aurelius-gold/90" : "bg-neutral-800 border border-neutral-700"}`}
        />
      ))}
    </span>
  );
}
