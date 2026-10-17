# PLANS INDEX

The canonical planning docs for Aurelius, in authority order. When they disagree,
resolve by the rules below. `NORTH_STAR.md` remains the overall map
(`CLAUDE.md` §1); this index governs the **plan/architecture/spec** docs beneath it.

## The docs (highest authority first)

1. **`BUILD_PLAN.md`** — release order and architecture. The operative build
   sequence (Release 0 → 9), the target architecture, the 90-day plan, and the
   implementation-handoff anchors. *Status: present.* (The 2026-08-12 wave map is
   archived at `BUILD_PLAN_WAVES_2026-08.md`.)
2. **`OPERATOR_CHARTER.md`** — boundaries, offer ladder, production lines. The
   standing rules of engagement (what Aurelius may/may not do, the gym/minor
   boundaries, the offer ladder and pricing, the production lines).
   **⚠ Status: NOT YET PRESENT in the repo.** Until it exists, its subject matter
   lives in `CLAUDE.md` ("Whose business this is"), `NORTH_STAR.md`, and the
   Business-engine / Scope-control sections of `BUILD_PLAN.md`; those hold its
   authority in the meantime.
3. **`SUPER_JARVIS_PLAN.md`** — detailed specs and prompts (e.g. P-SEC, P1, P3).
   **⚠ Status: NOT YET PRESENT in the repo.** The existing `SUPER_JARVIS_ROADMAP.md`
   is the long-term vision (below), and uses `#1–67` IDs, not `P-SEC/P1/P3`. Where
   a spec is referenced but absent, it must be authored from audit evidence and
   flagged (as Release 0 was in `BUILD_PLAN.md`).
4. **`SUPER_JARVIS_ROADMAP.md`** — long-term vision; **ideas only, not build
   instructions.** Cole's triage of the function catalog (`#1–67`, with
   ✅/🔵/🟢/🕒/❓/❌ verdicts). Use it to understand intent and map ideas to builds;
   never treat a line here as authorization to build. *Status: present.*

### Companion (not in the authority chain)
- **`STATE_OF_AURELIUS.md`** — the evidence-based audit (where it actually is).
- **`JARVIS_ROADMAP.md`** — the near-term, evidence-ordered step list.
- **`NORTH_STAR.md`** — the overall map; wins all conflicts per `CLAUDE.md` §1.

## Conflict rules
1. **Boundaries and security rules from ANY doc always apply, and the most
   restrictive one wins.** A later/higher doc never loosens a boundary or a
   security rule set by a lower one; it can only tighten it.
2. **On order or scope conflicts, the higher doc in this list wins** (BUILD_PLAN >
   OPERATOR_CHARTER > SUPER_JARVIS_PLAN > SUPER_JARVIS_ROADMAP) — subject always to
   `NORTH_STAR.md` as the overall map above them all.
3. **If a conflict isn't covered by these rules, ask Cole.** Do not guess.

> Note on current gaps: two referenced docs (`OPERATOR_CHARTER.md`,
> `SUPER_JARVIS_PLAN.md`) do not yet exist. This index lists them as the intended
> canonical set; until they are written, rule 1 (most-restrictive boundary wins)
> still binds using whatever doc currently carries that boundary.
