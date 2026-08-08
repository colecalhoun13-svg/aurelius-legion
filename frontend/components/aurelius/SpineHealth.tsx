"use client";

// SPINE HEALTH — the "is it alive" instrument (final council). Seven days ×
// every scheduled job as a dot grid: gold fired clean, red failed, hollow
// expected-but-missing, blank not scheduled that day. The JobRun claim table
// was built to prevent double-fires; this is its second job — making "did my
// exocortex run last night?" a glance instead of a trace-scroll.

import { useEffect, useState } from "react";

type SpineJob = { name: string; weekly: boolean };
type SpineRun = { jobName: string; day: string; status: string };
type SpineFeed = { days: string[]; jobs: SpineJob[]; runs: SpineRun[] };

const DOT = {
  done: "bg-aurelius-gold/90",
  failed: "bg-[#c96b5a]", // terracotta — the imperial danger ink
  running: "bg-aurelius-gold/40 animate-pulse",
  missed: "border border-neutral-600 bg-transparent",
  blank: "bg-transparent",
} as const;

function label(name: string): string {
  return name.replace(/_/g, " ");
}

export default function SpineHealth({ onPick }: { onPick?: (job: string) => void }) {
  const [feed, setFeed] = useState<SpineFeed | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/spine")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setFeed)
      .catch(() => setFailed(true));
  }, []);

  if (failed || (feed && feed.jobs.length === 0)) return null; // the thread list stands alone
  if (!feed) return null;

  const ran = new Map(feed.runs.map((r) => [`${r.jobName}#${r.day}`, r.status]));
  const today = feed.days[feed.days.length - 1]!;
  const isSunday = (day: string) => new Date(`${day}T12:00:00`).getDay() === 0;

  // Daily jobs first (they're the pulse), the Sunday cycle beneath.
  const jobs = [...feed.jobs].sort((a, b) => Number(a.weekly) - Number(b.weekly));

  const dotFor = (job: SpineJob, day: string): keyof typeof DOT => {
    const status = ran.get(`${job.name}#${day}`);
    if (status === "done") return "done";
    if (status === "failed") return "failed";
    if (status === "running") return "running";
    if (job.weekly && !isSunday(day)) return "blank"; // not scheduled — honest empty
    if (day === today) return "blank"; // not yet due today ≠ missed
    return "missed";
  };

  return (
    <section className="au-card p-4">
      <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
        <span className="au-label-row">The spine, this week</span>
        <span className="text-[10px]" style={{ color: "var(--ink3)" }}>
          <span style={{ color: "var(--gold)" }}>●</span> fired · <span style={{ color: "var(--danger)" }}>●</span> failed ·{" "}
          <span>○</span> missed
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="border-separate" style={{ borderSpacing: "0 3px" }}>
          <thead>
            <tr>
              <th />
              {feed.days.map((d) => (
                <th key={d} className="text-[9px] font-normal text-neutral-600 px-[5px] pb-1">
                  {"SMTWTFS"[new Date(`${d}T12:00:00`).getDay()]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {jobs.map((j) => (
              <tr key={j.name}>
                <td className="text-[10px] text-neutral-500 pr-3 whitespace-nowrap leading-none">{label(j.name)}</td>
                {feed.days.map((d) => {
                  const kind = dotFor(j, d);
                  // A dot is a DOOR, not a dot (alignment council): tap a
                  // fired/failed cell and land on that job's trace threads.
                  return (
                    <td key={d} className="px-[5px]">
                      <button
                        onClick={() => onPick?.(j.name)}
                        disabled={!onPick || kind === "blank"}
                        className={`block w-2 h-2 rounded-[3px] ${DOT[kind]} ${onPick && kind !== "blank" ? "cursor-pointer hover:scale-150 transition-transform" : "cursor-default"}`}
                        title={`${label(j.name)} · ${d} · ${kind === "blank" ? "not scheduled" : kind}${onPick && kind !== "blank" ? " — tap for its traces" : ""}`}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
