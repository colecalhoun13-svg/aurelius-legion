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
  // Intentionally sub-daily jobs live in FREQUENT_JOBS instead (they run many
  // times a day and are idempotent), so a job is fine if it's in EITHER set.
  const scheduleTs = read(join(BACKEND, "core", "schedule.ts"));
  const onceBlock = scheduleTs.match(/ONCE_PER_DAY = new Set\(\[([\s\S]*?)\]\)/);
  const onceNames = new Set([...(onceBlock?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]!));
  const frequentBlock = scheduleTs.match(/FREQUENT_JOBS = new Set\(\[([\s\S]*?)\]\)/);
  const frequentNames = new Set([...(frequentBlock?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((m) => m[1]!));
  for (const m of indexTs.matchAll(/scheduleNamed\(\s*"([^"]+)"/g)) {
    const job = m[1]!;
    if (!onceNames.has(job) && !frequentNames.has(job)) {
      add("high", "schedule", `job "${job}" is scheduled but not in ONCE_PER_DAY or FREQUENT_JOBS — a redeploy across its minute can double-fire it`);
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

  // ── 7. Action finalizers wired to an undeclared class ──────────────
  // The exact gap that shipped pattern.confirm/retire + autonomy.apply_grant:
  // a finalizer registered for a key ACTION_CLASSES never declares. The executor
  // can't resolve its tier or grant policy, so it would gate a Bridge confirm
  // nothing can finalize — a dead button. (executeAction now throws on this at
  // runtime; this catches it statically, before boot.)
  const actionClassesSrc = read(join(BACKEND, "autonomy", "actionClasses.ts"));
  const registerActionsSrc = read(join(BACKEND, "autonomy", "registerActions.ts"));
  const declaredKeys = new Set(
    [...actionClassesSrc.matchAll(/key:\s*"([a-z][a-z._]*)"/g)].map((m) => m[1]!)
  );
  const registeredKeys = new Set(
    [...registerActionsSrc.matchAll(/registerAction(?:Finalizer|Inverse)\(\s*"([a-z][a-z._]*)"/g)].map((m) => m[1]!)
  );
  for (const k of registeredKeys) {
    if (!declaredKeys.has(k)) {
      add("high", "action-class", `finalizer "${k}" is registered but not declared in ACTION_CLASSES — the executor can neither gate nor grant it`);
    }
  }

  // ── 8. A grantable keyhole with no finalizer (a grant that does nothing) ──
  // Grantable = inward, not neverGrant, not domain-locked. If Cole flips it on
  // and the executor finds no finalizer, the grant is decorative.
  const arrBody = actionClassesSrc.match(/ACTION_CLASSES[^[]*\[([\s\S]*?)\n\];/)?.[1] ?? "";
  const registeredFinalizers = new Set(
    [...registerActionsSrc.matchAll(/registerActionFinalizer\(\s*"([a-z][a-z._]*)"/g)].map((m) => m[1]!)
  );
  for (const chunk of arrBody.split(/(?=\bkey:\s*")/)) {
    const key = chunk.match(/key:\s*"([a-z][a-z._]*)"/)?.[1];
    if (!key) continue;
    const grantable =
      /tier:\s*"inward"/.test(chunk) && !/neverGrant:/.test(chunk) && !/domain:\s*"(?:training|health)"/.test(chunk);
    if (grantable && !registeredFinalizers.has(key)) {
      add("high", "action-class", `grantable class "${key}" has no registered finalizer — granting it would finalize nothing`);
    }
  }

  // ── 9. Grantable keyholes need a control, not just a policy ─────────
  // Grants are made from exactly one place: the autonomy dial. If it stops
  // deriving from listGrantableClasses (or is deleted), a grantable keyhole has
  // no switch — a capability Cole can never turn on. (grantable→site.)
  const dialRoute = join(FRONTEND, "app", "api", "autonomy", "dial", "route.ts");
  if (!existsSync(dialRoute) || !read(dialRoute).includes("listGrantableClasses")) {
    add("high", "autonomy-dial", `the autonomy dial (${relative(ROOT, dialRoute)}) is missing or no longer derives from listGrantableClasses — grantable keyholes would have no control`);
  }

  // ── 10. Research-source literals that don't exist in the vocab ─────
  // The "serp" bug: marketSourceCount compared .source to "serp", a value the
  // emitter never writes ("serpapi"), so it silently discarded every real
  // market source. The param is typed now (tsc guards new literals), and the
  // vocab is declared here so a stray comparison literal is caught even when it
  // sits behind an `any`. (vocab literals + the `any`-boundary they hide in.)
  const unionBody = read(join(BACKEND, "research", "researchTypes.ts")).match(/ResearchSource\s*=([\s\S]*?);/)?.[1] ?? "";
  const validSources = new Set([...unionBody.matchAll(/"([a-z]+)"/g)].map((m) => m[1]!));
  for (const path of walk(join(BACKEND, "business"), [".ts"])) {
    for (const m of read(path).matchAll(/\.source\s*[=!]==\s*"([a-zA-Z_]+)"/g)) {
      if (!validSources.has(m[1]!)) {
        add("medium", "vocab", `${basename(path)} compares .source to "${m[1]}", not a ResearchSource — the filter silently matches nothing`);
      }
    }
  }

  // ── 11. Outward finalizers with no stager (no executeAction call site) ──
  // An OUTWARD class is finalized only on Cole's confirm — but SOMETHING must
  // first stage it via executeAction to create that pending confirm. sms.send
  // and ads.spend shipped with finalizers and NO stager, so the confirm could
  // never be created and the finalizer was unreachable — passed tsc, passed
  // smoke, dead in prod. Every outward class WITH a finalizer needs ≥1
  // executeAction({actionClass:"X"}) call site in non-test code.
  //
  // CEILING (council R2): this proves a stager STRING exists, not that the stager
  // is itself reachable. That upper level is covered by composition — a stager
  // lives in a tool adapter (rule 2 checks it's registered) or an API route
  // (rule 5 checks it's called) — not by this rule alone. Comments are stripped
  // so a commented-out `actionClass:"x"` can't masquerade as a live stager.
  const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
  const outwardKeys = new Set<string>();
  for (const chunk of arrBody.split(/(?=\bkey:\s*")/)) {
    const key = chunk.match(/key:\s*"([a-z][a-z._]*)"/)?.[1];
    if (key && /tier:\s*"outward"/.test(chunk)) outwardKeys.add(key);
  }
  const stagedClasses = new Set<string>();
  for (const [path, src] of beSrc) {
    if (path.endsWith("smokeSuite.ts")) continue; // a test call site is not a prod invoker
    for (const m of stripComments(src).matchAll(/actionClass:\s*"([a-z][a-z._]*)"/g)) stagedClasses.add(m[1]!);
  }
  for (const key of outwardKeys) {
    if (registeredFinalizers.has(key) && !stagedClasses.has(key)) {
      add(
        "high",
        "action-class",
        `outward class "${key}" has a finalizer but no stager — nothing calls executeAction({actionClass:"${key}"}), so its Bridge confirm can never be created and the finalizer is unreachable`
      );
    }
  }

  // ── 12. Bridge-signal action buttons with no dispatcher ────────────
  // A LABELED action on a BridgeSignal renders as a tap on the Decisions/Home
  // deck — but the deck only ever dispatches confirm_action → confirm and
  // undo_action → undo (plus dismiss/acknowledge, and `executed`, a handled
  // receipt marker the UI reads to render the done state). The retention engine
  // shipped four buttons (draft_referral/proof/checkin/resign) nothing
  // dispatched: dead taps that looked like features. Any labeled action verb
  // outside the wired set is a dead button.
  //
  // WINDOW-BASED (council R2): the earlier version required label and action to
  // be comma-ADJACENT, so a reordered object `{ action:"x", payload:{…}, label:"Y" }`
  // slipped through. Now, for each `action:"verb"` we scan a small surrounding
  // window for a label — order- and intervening-field-independent, so a routine
  // field reorder can't smuggle a dead verb past the check.
  const DISPATCHED_ACTIONS = new Set(["confirm_action", "undo_action", "dismiss", "acknowledge", "executed"]);
  for (const [path, src] of beSrc) {
    if (path.endsWith("reachabilityAudit.ts")) continue; // this file names the verbs
    const verbs = new Set<string>();
    for (const m of src.matchAll(/\baction:\s*"([a-z_]+)"/g)) {
      const i = m.index ?? 0;
      const window = src.slice(Math.max(0, i - 200), i + 200);
      if (/\blabel:\s*"/.test(window)) verbs.add(m[1]!); // a label nearby = a rendered button
    }
    for (const verb of verbs) {
      if (!DISPATCHED_ACTIONS.has(verb)) {
        add(
          "high",
          "bridge-action",
          `a signal button in ${relative(ROOT, path)} uses action "${verb}", which no deck dispatches — a dead tap (only ${[...DISPATCHED_ACTIONS].join(", ")} are wired)`
        );
      }
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
