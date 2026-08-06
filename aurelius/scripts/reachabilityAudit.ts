// aurelius/scripts/reachabilityAudit.ts
//
// THE SKELETON DETECTOR.
//
// This exists because the same defect kept shipping: code that was written,
// typechecked, smoke-tested and committed — and that nothing could actually
// reach in production. Instagram publishing had no media host. Inbox triage
// had no schedule entry. Curriculum gap-discovery had a condition that
// couldn't fire for three years. Token counts had no reader. The Client
// Engine's money endpoint had no button.
//
// Every one passed `tsc`. Every one passed the smoke suite. None of them
// worked, because "done" was being decided by whether the code existed rather
// than by whether anything invoked it.
//
// So this asks the only question that matters, per capability:
//   WHAT WOULD INVOKE THIS IN PRODUCTION, AND DOES THAT INVOKER EXIST?
//
// Deliberately NOT included: dead-export analysis ("exported but never
// imported"). It was tried and it was 58/59 false positives — internal helpers,
// registry dispatch, dynamic imports and same-file callers all trip it. A check
// that noisy trains you to ignore the output, which is worse than no check.
// Everything below is high-signal: a finding here is a real dead path.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const BACKEND = join(HERE, "..");
const ROOT = join(BACKEND, "..");
const FRONTEND = join(ROOT, "frontend");

const SKIP_DIRS = new Set(["node_modules", ".next", "vault", "dist", ".git", "migrations"]);

function walk(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

const read = (p: string) => {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
};

export type Finding = {
  severity: "high" | "medium";
  area: string;
  message: string;
};

export function auditReachability(): Finding[] {
  const findings: Finding[] = [];
  const add = (severity: Finding["severity"], area: string, message: string) =>
    findings.push({ severity, area, message });

  const beFiles = walk(BACKEND, [".ts"]);
  const feFiles = walk(FRONTEND, [".ts", ".tsx"]);
  const beSrc = new Map(beFiles.map((p) => [p, read(p)]));
  const feSrc = new Map(feFiles.map((p) => [p, read(p)]));
  const indexTs = read(join(BACKEND, "index.ts"));

  // ── 1. Express routers exported but never mounted ──────────────────
  // Every route inside an unmounted router is unreachable, silently.
  for (const [path, src] of beSrc) {
    for (const m of src.matchAll(/export const (\w*[Rr]outer)\s*[:=]/g)) {
      const name = m[1]!;
      if (indexTs.includes(name)) continue;
      const mountedElsewhere = [...beSrc].some(([p2, s2]) => p2 !== path && s2.includes(name));
      if (!mountedElsewhere) {
        add("high", "router", `${name} (${relative(ROOT, path)}) is never mounted — every route in it is dead`);
      }
    }
  }

  // ── 2. Tool adapters written but never registered ──────────────────
  // An unregistered adapter is invisible to the tool catalog, so the model
  // can never call it however well it's written.
  const registerTools = read(join(BACKEND, "tools", "registerTools.ts"));
  for (const path of walk(join(BACKEND, "tools", "adapters"), [".ts"])) {
    for (const m of read(path).matchAll(/export const (\w+Adapter)\s*:/g)) {
      if (!registerTools.includes(`registerTool(${m[1]})`)) {
        add("high", "tool", `${m[1]} (${basename(path)}) is never registered — unreachable from chat`);
      }
    }
  }

  // ── 3. Engine adapters written but never registered ────────────────
  const registerEngines = read(join(BACKEND, "core", "registerEngines.ts"));
  for (const path of walk(join(BACKEND, "engines"), [".ts"])) {
    for (const m of read(path).matchAll(/export const (\w+Adapter)\s*:/g)) {
      if (!registerEngines.includes(m[1]!)) {
        add("high", "engine", `${m[1]} (${basename(path)}) is never registered — the router can never route to it`);
      }
    }
  }

  // ── 4. Scheduled jobs without a once-per-day claim ─────────────────
  // A daily/weekly job outside ONCE_PER_DAY can double-fire when a redeploy
  // straddles its cron minute. Interval pollers are correctly absent.
  const scheduleTs = read(join(BACKEND, "core", "schedule.ts"));
  const onceBlock = scheduleTs.match(/ONCE_PER_DAY = new Set\(\[([\s\S]*?)\]\)/);
  const onceNames = new Set([...(onceBlock?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]!));
  for (const m of indexTs.matchAll(/scheduleNamed\(\s*"([^"]+)"/g)) {
    const job = m[1]!;
    if (!onceNames.has(job)) {
      add("high", "schedule", `job "${job}" is scheduled but not in ONCE_PER_DAY — a redeploy across its minute can double-fire it`);
    }
  }

  // ── 5. Frontend API routes with no caller ──────────────────────────
  // This is the one that caught the Client Engine's money endpoint: a real,
  // working, tested endpoint with no button anywhere that presses it.
  for (const path of walk(join(FRONTEND, "app", "api"), ["route.ts"])) {
    const rel = relative(join(FRONTEND, "app"), path).replace(/[\\/]route\.ts$/, "");
    const route = "/" + rel.split(/[\\/]/).join("/");
    // A dynamic segment ([id]) is called via a template literal, so match on
    // the static prefix rather than the literal path.
    const dynamicAt = route.indexOf("/[");
    const needle = dynamicAt >= 0 ? route.slice(0, dynamicAt + 1) : route;
    const called = [...feSrc].some(([p2, s2]) => p2 !== path && s2.includes(needle));
    if (!called) {
      add("medium", "frontend-api", `${route} exists but nothing in the app calls it — built, unreachable`);
    }
  }

  // ── 6. Pages nobody can navigate to ────────────────────────────────
  const nav =
    read(join(FRONTEND, "lib", "operators", "operatorRegistry.ts")) +
    read(join(FRONTEND, "app", "components", "MobileTabBar.tsx"));
  const EXEMPT = new Set(["/", "/unlock", "/share"]);
  for (const path of walk(join(FRONTEND, "app"), ["page.tsx"])) {
    const rel = relative(join(FRONTEND, "app"), path).replace(/[\\/]page\.tsx$/, "");
    const route = ("/" + rel.split(/[\\/]/).filter((s) => !s.startsWith("(")).join("/")).replace(/\/+$/, "") || "/";
    if (EXEMPT.has(route)) continue;
    if (nav.includes(`"${route}"`)) continue;
    const linked = [...feSrc].some(([, s2]) => s2.includes(`href="${route}"`) || s2.includes(`href={\`${route}`));
    if (!linked) {
      add("medium", "frontend-page", `page ${route} is in neither the nav registry nor any link — unreachable by clicking`);
    }
  }

  return findings;
}

// CLI: `npx tsx scripts/reachabilityAudit.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  const findings = auditReachability();
  if (findings.length === 0) {
    console.log("Reachability audit: clean — every capability has a live invoker.");
    process.exit(0);
  }
  for (const f of findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1))) {
    console.log(`[${f.severity.toUpperCase()}] ${f.area}: ${f.message}`);
  }
  const high = findings.filter((f) => f.severity === "high").length;
  console.log(`\n${findings.length} finding(s), ${high} high`);
  process.exit(high > 0 ? 1 : 0);
}
