# Cole's checklist — turning the build on

Everything below is built and verified. None of it is on by default, because most
of it needs something only you can provide — a key, a number, a decision. This is
that list, in priority order, each with **what it unlocks**, **how to do it**, and
**where the value shows up**.

Nothing here sends, publishes, or spends on its own. Every outward action still
stops for your confirm. Turning a key on just lets the inward work happen and
lets the outward work *reach* you to approve.

---

## Part A — Do these first (no keys, high leverage)

### 1. Paste your warm list
- **Why:** With zero clients and zero inbound, the warm list is the only channel
  that works at zero audience. It's the shortest path to your first paying client.
- **How:** Business page → **Warm list** panel → paste names (one per line; add an
  email where you have it). Aurelius imports them, each with a follow-up date, and
  the 07:30 sweep drafts outreach (max 3/day — it's your review time that's scarce,
  not the writing). You send; nothing goes out on its own.
- **Shows up:** the pipeline fills, and the analyst starts having something to rank.

### 2. Define and price one offer
- **Why:** Until one offer is live, every post and DM points at nothing — content
  that starts conversations you can't close. The risk line will keep saying so.
- **How:** Business page → **What you sell** → **Draft one** (Aurelius drafts it,
  never with a price — a guessed price is one you'd quote a parent). Then, when
  you're ready, type the real price and **Make it live**. Not sure which promise
  lands? Hit **Probe A/B** — it floats 2–3 variants, each behind its own tracked
  link; put them in front of the same kind of audience and the one that pulls
  leads is the one to price.
- **Needs from you:** the promise in your words, and the prices for monthly /
  8–12wk block / one-off program.

### 3. Make the gym-arrangement call explicit
- **Why:** Aurelius already treats the gym's athletes as off-limits (they're your
  employer's). If anything about that boundary changes, say so — otherwise it
  holds the line hard, which is correct.
- **How:** Just tell Aurelius in chat if the arrangement ever changes. No setting.

### 4. Set your IG bio link
- **Why:** It's how a post turns into a lead. When you publish, Aurelius mints a
  tracked link and hands it to you — putting it in your bio (or a story link) is
  what makes the leads a post drives traceable back to that exact post.
- **How:** Publish a post from the content queue → the receipt on Decisions gives
  you the tracked link → paste it into your IG bio. (Full clickable links need
  Part B #2.)

---

## Part B — Keys that unlock engines (dormant until set)

Each of these is an environment variable. On the Mini, they go in the `.env` file
(never commit it — a leaked token is a burned token). On a hosted deploy, set them
in the host's environment settings. After changing `.env`, restart the process.
On Codespaces, a changed secret needs a full stop/restart of the codespace.

### 4b. `ANTHROPIC_API_KEY` — the brain (the one everything else needs)
- **Unlocks:** all of it — drafting, research synthesis, offer/angle/proof
  generation. Without a model key these fail *loudly and honestly* (they refuse to
  file error text as content) rather than silently, but they can't do the work.
- **How:** get a key from console.anthropic.com and set `ANTHROPIC_API_KEY=sk-ant-...`.
  (This is almost certainly already set on your real machine; it's just absent in
  the test sandbox, which is why a handful of keyless synthesis tests are expected
  to fail there.)

### 5. `APP_PUBLIC_URL` — your public origin
- **Unlocks:** clickable tracked links (`/l/<code>` → your `/start` form), and the
  Twilio SMS webhook URL. Without it, links are shown as paths, not full URLs.
- **How:** set it to the public URL your app is reachable at, e.g.
  `APP_PUBLIC_URL=https://calhoun.yourdomain.com` (no trailing slash).

### 6. `MEDIA_PUBLIC_BASE_URL` — public image host
- **Unlocks:** Instagram publishing (Meta fetches your image by URL — it can't take
  an upload), and doubles as a fallback public origin for links.
- **How:** point it at wherever your `/media` images are publicly served, e.g.
  `MEDIA_PUBLIC_BASE_URL=https://calhoun.yourdomain.com`. The doctor will flip
  Instagram from `config` to `live` once this and the IG token are both set.

### 7. A research key — external grounding
- **Unlocks:** market-grounded offers, angles, and partner research (so advice
  cites real sources instead of the model's priors, which it labels honestly as a
  guess without a key).
- **How:** get one key from **Tavily** (tavily.com — simplest), **SerpAPI**
  (serpapi.com), or use **Gemini** Google-Search grounding, and set the matching
  env var (`TAVILY_API_KEY` / `SERPAPI_KEY` / `GEMINI_API_KEY`). Any one is enough.

### 8. Instagram — publishing + insights
- **Unlocks:** publishing to IG (from the content queue, your confirm) and the
  72h content-outcome loop that reads each post's reach and credits the angle that
  earned it.
- **How:** connect via the app's Instagram auth (needs a Meta app: set
  `INSTAGRAM_APP_ID` + `INSTAGRAM_APP_SECRET`, then click Connect), OR set a manual
  `INSTAGRAM_ACCESS_TOKEN` + `INSTAGRAM_BUSINESS_ID`. Needs a Business/Creator IG
  account. Also needs #6 (media host) to actually publish.

### 9. Gmail — inbox triage, reply-matching, payment emails
- **Unlocks:** overnight drafted replies (your send), auto-detecting when a lead
  replies to your outreach (flips them to "conversing", credits the angle), and
  self-recording Venmo/Zelle/PayPal payments straight from their notification
  emails.
- **How:** connect via the app's Gmail auth. Drafts only — Aurelius has no send
  scope by construction, so it can never email anyone on its own.

### 10. Stripe — payments that record themselves
- **Unlocks:** a paid Stripe charge records itself as a Payment (marked
  `stripe_webhook`, never as your hand), matched to the client by email. A payment
  it can't match becomes a notice on Decisions, never a wrong-client record.
- **How:** in the Stripe Dashboard → Developers → Webhooks → add an endpoint at
  `https://<your APP_PUBLIC_URL>/webhooks/stripe`, subscribe to
  `checkout.session.completed`, `payment_intent.succeeded`, `charge.succeeded`.
  Copy the signing secret and set `STRIPE_WEBHOOK_SECRET=whsec_...`. (Venmo/Zelle
  need no key — they self-record from their emails once #9 is on.)

### 11. Twilio — SMS
- **Unlocks:** an inbound text self-records against the sender's number (a lead's
  reply flips them to "conversing"); outbound texts are drafted for your confirm.
- **How:** get a Twilio number, set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_FROM_NUMBER`. In the Twilio console, point the number's **A message comes
  in** webhook at `https://<APP_PUBLIC_URL>/webhooks/twilio`. **The 10DLC wrinkle:**
  a US number must be registered on a 10DLC campaign before carriers reliably
  deliver business texts — do that in the Twilio console (Messaging → Regulatory
  Compliance) before relying on outbound.

### 12. Meta ads — measured paid boost
- **Unlocks:** boosting a post that has *already* beaten its own organic reach,
  with a cost-per-lead kill line. Spend is always your confirm.
- **How:** set `META_ADS_TOKEN` (a Meta Marketing API token for your ad account).
  Until then, "Propose a boost" still tells you honestly when nothing's proven
  enough to amplify.

### 13. `LLM_MONTHLY_BUDGET_USD` — the spend guardrail
- **Unlocks:** a hard alarm before the model bill hurts.
- **How:** set it to your comfortable monthly ceiling, e.g.
  `LLM_MONTHLY_BUDGET_USD=50`.

### 14. `APP_UNLOCK_SECRET` — the app lock (before you expose it)
- **Unlocks:** protects every page and API behind a one-time unlock, so the app
  isn't open on a public domain. **Set this before deploying anywhere public.**
- **How:** pick a strong secret, set `APP_UNLOCK_SECRET=...`, then open `/unlock`
  once per device and enter it (the cookie lasts a year). Your `/start` and
  `/standard` funnel pages stay public by design.

---

## Part C — Inputs that sharpen (optional, improve quality)

### 15. Per-sport benchmark bands for "The Standard"
- **Why:** the public assessment (`/standard`) uses conservative *provisional*
  bands and says so. Your real per-sport numbers make the verdict land harder.
- **How:** tell Aurelius, per sport, the relative-squat and vertical thresholds you
  consider below / approaching / at / above the standard. It'll replace the
  defaults. (Until then the page works and is honestly labelled.)

### 16. Google Calendar
- **Unlocks:** schedule-protection (defends your deep-work/training blocks) and the
  calendar sync the freshness gate watches.
- **How:** connect via the app's Calendar auth.

---

## What "done" looks like

- **Right now (nothing configured):** the whole system runs, the funnel pages are
  live, the risk line and analyst tell you the truth about an empty pipeline, and
  every engine that needs a key says so plainly instead of pretending.
- **Part A done:** leads start flowing from your warm list, an offer is live, and
  content points at something real.
- **Part B done:** money and messages record themselves, content publishes and its
  results feed back into what you post next, and the loops compound.

Start at #1. Each step is worth something on its own.
