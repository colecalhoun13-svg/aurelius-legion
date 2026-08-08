# ELEVATED IMPERIAL — the frontend redesign spec (Cole-approved 2026-08-08)

The approved rendering lives at the "Elevated Imperial II" artifact (v6, ten tabs).
This doc is the durable spec so the build survives context loss. The prime rule:
**re-dress, never delete** — every page/panel/control in the live app survives;
the parity checklist below is a build gate alongside tsc + `next build`.

## Cole's locked decisions
- Ten tabs: Morning · Chat · Decisions · Business · Athletes · Goals · Brain ·
  Calendar · Machine · Tuning. Chat is its OWN page (quick bar stays on Morning,
  ⌘K everywhere). /More becomes unnecessary on desktop; mobile keeps 5 + More.
- The daily stoic quote STAYS on Home load, near the top (Cormorant italic).
- The library stays whole: Brain = Shelves + Wiki + Ask + study-now.
- Program delivery = Google Sheets (Aurelius organizes/deadlines; never writes programs).
- Persona ledger card in Brain: "How he speaks to you — learned calibrations,
  each yours to revoke" (read-only; persona never auto-applies).
- Roman columns welcome — colonnade funnel + a tasteful capital ornament.

## Type — three voices (self-hosted via next/font/local, files in frontend/app/fonts/)
- CEREMONY: Cinzel 700 — page titles, big numerals (inscription feel), never a sentence.
- HUMAN: Cormorant Garamond 500/600 + 500-italic — labels (13px caps .32em), kickers
  (italic 15px), oracle/risk prose (italic ~1.5rem), buttons (600 caps .18em), body accents.
- DATA: Barlow Condensed 600 — dense numeric annotation ONLY (ages, click counts,
  tabular figures). System UI stack for plain body text.

## Tokens (tailwind extend + globals :root)
bg0 #0a0a0a · bg1 #14120c · bg2 #1b1811 (warm umber blacks)
gold-bright #f2d377 · gold #d4af37 · gold-dim #8a6f22
gold-line rgba(212,175,55,.30) · eng1 .14 / eng2 .30 / eng3 .55 (engraving tiers)
ink #f2f2ef · ink2 #b3ada0 · ink3 #7a7466 · line1 rgba(255,255,255,.07) · line2 .13
money #a8c39a (laurel patina) · attn #d9a441 · danger #c96b5a (terracotta)
ease cubic-bezier(.22,1,.36,1) — stately, NO bounce. Marble whisper: 3 fixed radials
on body::before. Gold horizon: page-top radial glow (.au-horizon).

## Surfaces — three tiers, glass scarce
- Tier 0 OPEN AIR: label + hairline, content on the field (most sections).
- Tier 1 .card stone slab: bg1, line1 border, radius 2px, gold hairline "crown"
  top-center that widens on hover. NO clip-path notches.
- Tier 2 .glass inscription tablet (MAX ~2/page): gold-line border, inner frame
  (inset 7px, gold .16), gold corner marks, blur. For "Needs you" + ceremony only.
- Ornament: double-hairline .rule; laurel .divider between movements; laurel .tick
  glyph (SVG mask) = "an act" in ledgers; centered .label with flanking hairlines.

## Motion (CSS + 2 hooks, NO framer-motion)
- Tokens: --au-fast 180ms, --au-base 380-600ms, rise .55s stagger (.reveal),
  resolve-from-blur 1s for the risk line, crest shimmer 2.4s (only if worked overnight).
- useFlip.ts: FLIP for pipeline cards (data-flip-id, batch reads then writes,
  double-rAF, willChange hygiene, reduced-motion bail, >viewport falls to fade).
- useCountUp.ts: rAF easeOutCubic, tabular-nums required, zeroes never animate.
- Keep boot crest sequence untouched. Retire animate-fadeIn/wreathFlash. Consolidate
  aurelius-stagger (blur-based) into aurelius-reveal (transform/opacity).
- Land glow via pseudo-element opacity anim; count-tick = keyed span remount.

## Instruments (inline SVG, engraving grammar: strokes .5-1.25px, 4 gold opacity tiers)
1. DAY DIAL (Morning hero): noon-top fixed 24h dial; Roman numerals Ⅵ/Ⅻ/ⅩⅧ;
   event band r138 arcs (training block = gold rails cartouche); elapsed shadow wedge;
   gnomon sweeps midnight→now on load; inner spine band = ONCE_PER_DAY jobs as ticks
   (solid=ran, hollow=due, red=failed); center = free hours + next event.
   Data: CalendarEvent mirror, /api/upnext freeHours, JobRun today. Honest-empty:
   dial renders, bare band, "awaiting the calendar".
2. ATHLETE RADAR (Athletes + public /standard): fixed axis order, band-normalized
   rings (below 42 / approaching 74 / THE STANDARD 106 @1px / above 138), stroke
   polygon fill capped .07, prior-assessment dashed ghost, PR vertex laurel.
   2 axes → TWIN MERIDIAN arc-gauges (never a fake polygon); 0-1 metrics → blank
   instrument "awaiting first assessment".
3. FUNNEL COLONNADE (Business): 5 arched niches, floor-glow by count, lead dots w/
   momentum heat (gold ≤2d → grey >14d, hollow = never contacted), dots FLIP between
   chambers on advance w/ comet fade; "2 of 5" honesty (no % under n=10).
4. TREASURY: committed hollow gold outline, received emerald fill, outstanding
   amber 45° stripes; expense chip (danger); count-up once. Section gated on earned>0.
5. NIGHT SHIFT timeline (Business header): engraved double-hairline, diamond marks,
   Roman graduations, sun at now, italic lowercase labels, ticker w/ Gmail link.
6. THE DROP: nested pair bars clicks/leads per channel; dashed outline = too-early.

## Per-tab requirements (parity = everything live today survives)
- MORNING: crest (+shimmer if overnight acts) · greeting · STOIC QUOTE · Day Dial +
  runway · risk line (resolve) · today's board (tasks + capture box + habit streaks) ·
  Night Ledger (verb rows + undo + clean-nights streak) · Needs-you tablet ·
  Ledger of Promises · chat quick bar · briefing/debrief (day-phase aware).
- CHAT: full-page AureliusChat — serif voice w/ gold initial for Aurelius, "why?"
  rule-audit affordance, voice notes, attachments; brain-dump splitter demo'd.
- DECISIONS: bench hero (Roman numeral count) · one queue (proposals + signals +
  triage) w/ filter chips · ruled cards slide off · receipts + undo below.
- BUSINESS: night-shift timeline · positioning question card · oracle (analyst) ·
  funnel colonnade · scoreboard stats · treasury (+expenses) · the drop · workbench
  kanban (FLIP) · needs-you tablet · ALL existing panels (offers+probe, marketing
  angles, content queue+publish+IG image, warm list, growth/partners/boost, roster
  + client money + retention drafts, add-lead, tracked links demoted to diagnostics).
- ATHLETES (new tab): roster incl. "You" (Cole's own training: PRs/volume from
  training/) · radar + prior ghost · ledger of bests · log-a-metric.
- GOALS: campaign stats (follow-through, streaks, posts, clients) · goals +1 bars ·
  habits · scoreboard details (llmDependence, patterns, corrections) · Sunday review note.
- BRAIN: Ask-as-the-door hero · corpus numerals · The Library (Shelves + Wiki +
  study-now) · "How I think" heuristics shelf (browse/confirm/retire) · persona card ·
  Wealth shelf.
- CALENDAR: week view, today wears glass + now-line, others flat · quick add ·
  free-hours stat.
- MACHINE: status wall (all integrations w/ honest config needs, incl. IG Messages
  planned) · spend/streak/acts stats · missions · traces · spine 7-day grid ·
  settings/preferences · quiet mode control.
- TUNING: keyholes (grantable switches + LOCKED outward row "no dial exists") ·
  rituals re-time/pause · engine routing + budget · the record (acts/undone/missions).
- CHROME: ⌘K dual-mode bar + bell (badge = decisions only) + working sweep; mobile
  tab bar 5 + More (Business promoted per council); active tab = engraved underline.

## Completeness additions (build after visual phases; backend waves, all inward/gated)
Promise ledger · post-session debrief loop · brain-dump splitter (capture.file) ·
client onboarding runway (fires on convertLead) · expense+tax capture · content
cadence slots · quiet mode verb · interactive Sunday review · IG DM inbound door
(Meta webhook, capture-only) · add_habit action · session-prep on dial · tappable
wealth pulse. Deferred to client #1: program template library, network warming.

## Build order (gate every phase: tsc + prod next build + parity check + 390px pass)
- P1: fonts/tokens/kit (components/kit/: Panel, SectionLabel, Stat, CountUp,
  useFlip, Btn, Raise, Tick, Divider, format) + Business page.
- P2: Morning (Day Dial) + Decisions + Chat tab + nav restructure (10 tabs).
- P3: Athletes, Goals, Brain, Calendar, Machine, Tuning + alias cleanup + kit-usage
  lint. Then the completeness backend waves.
Architect notes: Next is STOCK 14.2.3 App Router; all (chrome) pages are client
components; delete app/theme.aurelius-ui.css (orphan); never animate filter on
panel ancestors (backdrop-filter); FLIP containers never direct children of .reveal.
