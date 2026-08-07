# AURELIUS 3.4 — the target, in Cole's words

**Source:** Cole, 2026-08-07. Reproduced verbatim.

This is the definition of "Jarvis-level" that Aurelius is being built toward, written by
the person it is being built for. It is the standard the councils audit against, alongside
`NORTH_STAR.md` (which remains the architecture of record and wins conflicts about *how*).

Where this document and the code disagree, that is a finding — not a licence to edit this
document. It changes only when Cole changes it.

---

## 1. What Aurelius 3.4 is (in plain terms)

Aurelius 3.4 is:

- A personal operating system, not just a chatbot or note app.
- A second operator that thinks with you across training, business, content, wealth, and personal life.
- A second brain that:
  - Learns your patterns
  - Compiles your reasoning
  - Reduces dependence on raw LLM calls
  - Acts on your behalf via integrations and automations
- A system explicitly designed to increase your revenue, reduce wasted time, and improve decision quality.

It runs on:

- Mac mini → always-on compute node.
- Ugreen NASync → storage, sync, ingestion (videos, docs, notes, logs).
- Local + cloud connectors → calendar, email, CRM, Sheets, content platforms, research tools.

---

## 2. The four-layer intelligence stack

Aurelius's "brain" is built from four layers:

1. Operator cores — identity and philosophy per domain.
2. Living Knowledge — structured, evolving domain knowledge.
3. Compiled Understanding — learned patterns that reduce LLM calls.
4. Research Memory — external knowledge ingestion.

### 2.1 Operator cores

Each operator (training, business, content, wealth, personal OS) has a core file that defines:

- Philosophy: how it thinks (e.g., "high-trust sales," "athlete longevity first").
- Constraints: what it never does (e.g., "no spammy outreach," "no reckless financial moves").
- Priorities: what it optimizes for (e.g., "long-term client value," "consistent content output").
- Voice and tone: how it speaks (your style, not generic AI).
- Domain rules: how it reasons in that domain.

These cores:

- Keep Aurelius consistent.
- Prevent it from drifting into random behavior.
- Anchor all decisions in your values and strategy.

They never auto-mutate—only you change them.

### 2.2 Living Knowledge

Living Knowledge is Aurelius's structured, evolving knowledge base.

It's not just notes—it's schema-level intelligence.

Examples:

- **Training:**
  - Rep bands (e.g., strength, strength_endurance, hypertrophy).
  - Intensity zones.
  - Movement tags (squat_pattern, hinge_pattern, etc.).
  - Athlete profiles (sport, phase, constraints, history).
- **Business:**
  - Lead stages (cold, warm, hot, client).
  - Offer types (1:1 coaching, group, programs, consults).
  - Funnel structures (IG DM → call → close, email → landing page → checkout).
  - Pricing tiers and rules.
- **Content:**
  - Content types (reels, carousels, long-form, email).
  - Hooks and angles (pain, aspiration, education, proof).
  - Platform tags (IG, TikTok, YouTube, email).
  - Performance tags (high-save, high-share, high-lead).
- **Wealth:**
  - Accounts (business checking, savings, investments).
  - Categories (software, rent, marketing, personal).
  - Recurring patterns (subscriptions, fixed costs, variable costs).

Living Knowledge:

- Lives in a database (e.g., Postgres).
- Is updated via natural language → proposal → confirmation.
- Is queried by operators during reasoning.
- Is the "facts and taxonomies" Aurelius uses to think.

### 2.3 Compiled Understanding

Compiled Understanding is the learning engine—this is where Aurelius becomes more like you over time.

It has two main structures:

- **ReasoningCacheEntry**
  - A snapshot of a specific reasoning event.
  - Example: "How we programmed Mike's Week 4," "How we handled a warm IG lead from a coach," "How we responded to a content inquiry."
- **CompiledPattern**
  - A pattern detected across many similar ReasoningCacheEntries.
  - Example: "Cole usually deloads pre-camp athletes at Week 4," "Cole usually offers X to Y-type leads," "Cole usually scripts reels with A/B/C structure."

Compiled Understanding:

- Logs every significant decision Aurelius makes with you.
- Detects patterns after N similar cases.
- Compiles those patterns into reusable logic.
- Over time, reduces LLM calls by:
  - Recognizing situations
  - Applying learned patterns
  - Only using LLMs when something is truly novel.

This is how Aurelius:

- Learns your coaching style.
- Learns your sales instincts.
- Learns your content style.
- Learns your financial habits.
- Learns your decision patterns.

### 2.4 Research Memory

Research Memory is Aurelius's external knowledge layer.

It ingests:

- Training science (papers, articles, books).
- Business and marketing research.
- Content and platform behavior insights.
- Wealth and finance knowledge.

It uses tools like:

- Zotero (papers).
- Paperless-ngx (docs, PDFs).
- Perplexity / NotebookLM (web + source-grounded research).

Research Memory:

- Feeds into Living Knowledge (updates taxonomies, heuristics).
- Grounds reasoning in reality (not just your past patterns).
- Helps Aurelius make better decisions that improve performance and revenue.

---

## 3. Operators (the "departments" of your OS)

Aurelius is split into operators—each one is like a specialized department.

### 3.1 Training operator

Responsibilities:

- Build and refine training blocks and sessions.
- Manage athlete fatigue and recovery.
- Track performance trends.
- Suggest adjustments based on patterns and research.

Money impact:

- Better results → better testimonials → more referrals.
- Better retention → more recurring revenue.
- More scalable programming → more clients without burning out.

### 3.2 Business operator (CRM + sales + offers)

Responsibilities:

- Track leads across platforms (IG, email, referrals, website).
- Classify leads by stage, source, likelihood.
- Recommend next actions (DM, email, call, offer).
- Learn which actions convert best over time.
- Help design and refine offers.
- Automate follow-ups and reminders.

Money impact:

- Higher lead conversion.
- Fewer dropped opportunities.
- Better offer positioning.
- More consistent follow-up.
- More revenue per lead.

### 3.3 Content operator

Responsibilities:

- Track content performance (views, saves, shares, leads generated).
- Learn what topics, hooks, formats perform best.
- Suggest content ideas tied to business goals.
- Help script posts, reels, emails.
- Optimize posting schedule and platform mix.

Money impact:

- More content that actually drives leads.
- Less wasted content that doesn't move the needle.
- Better alignment between content and offers.
- More inbound interest.

### 3.4 Wealth operator

Responsibilities:

- Track income streams and expenses.
- Detect patterns (e.g., months with higher revenue, categories that bleed cash).
- Suggest optimizations (cut, consolidate, invest).
- Help you make smarter financial decisions over time.

Money impact:

- Less waste.
- Better allocation.
- More clarity on what drives profit.
- Better long-term positioning.

### 3.5 Personal OS operator

Responsibilities:

- Manage calendar (events, focus blocks, recovery time).
- Manage tasks (commitments, priorities, routines).
- Help triage email (important vs noise).
- Learn your work patterns and help you stay consistent.

Money impact:

- More focused work time.
- Less chaos.
- Better execution on the things that actually drive revenue.
- Less cognitive load.

---

## 4. Reasoning pipeline (Pass 2) — how Aurelius thinks

Every operator uses the same Pass 2 reasoning pipeline:

1. **Build situation signature**
   - Tag the situation using Living Knowledge.
   - Example (business): lead source = IG, stage = warm, offer = 1:1 coaching, past interaction = saved reel.
   - Example (training): athlete = Mike, phase = pre-camp, week = 4, goal = power, fatigue markers = medium.
2. **Cache lookup**
   - Find similar ReasoningCacheEntry rows.
   - Example: "Warm IG lead from coach, similar context," "Week 4 pre-camp athlete with similar profile."
3. **Pattern lookup**
   - Find relevant CompiledPattern entries.
   - Example: "Cole usually offers X to this lead type," "Cole usually deloads here."
4. **Inject context**
   - Combine: Operator core (philosophy, constraints) · Living Knowledge (taxonomies, rules) · Compiled Understanding (patterns) · Research Memory (external knowledge) · Recent memory (last few interactions).
5. **Reason (LLM or compiled)**
   - If a strong pattern exists → use it (minimal LLM).
   - If novel → full LLM reasoning (Claude or other).
6. **Write cache entry**
   - Log what was decided and why.
7. **Pattern detection**
   - If enough similar entries → create/update CompiledPattern.

This pipeline is how Aurelius:

- Gets smarter over time.
- Becomes more "you" in its decisions.
- Uses LLMs less and compiled logic more.
- Makes decisions that are both consistent and adaptive.

---

## 5. Multi-LLM routing

Aurelius doesn't rely on one AI—it routes tasks:

- Claude → deep reasoning, long context, second-brain style tasks.
- Other models (optional) → fast, cheap, or specialized tasks.

Routing logic:

- Use compiled patterns first.
- If no pattern, choose model based on: task complexity · context length · cost/performance tradeoff.

Over time:

- More tasks are handled by compiled understanding.
- Fewer tasks require full LLM reasoning.
- You get faster, cheaper, more consistent behavior.

---

## 6. Connectors and integrations

Aurelius wires into:

- Google Sheets → training logs, business dashboards, content tracking.
- Calendar (Google/Apple) → events, scheduling, focus blocks.
- Email (Gmail/IMAP) → triage, drafting, follow-ups.
- CRM (e.g., HubSpot or Streak) → leads, deals, pipelines.
- Content platforms → IG/FB (Meta), YouTube (via analytics tools).
- NAS tools → Immich (videos), Paperless-ngx (docs), Obsidian/Logseq (notes).

These integrations let Aurelius:

- See your real data.
- Act on your real systems.
- Automate real workflows.
- Tie reasoning directly to execution.

---

## 7. How Aurelius actually puts more money in your pocket

Let's make this concrete.

### 7.1 Better lead handling (Business operator)

- Aurelius tracks every lead, where they came from, what they engaged with.
- It learns which leads convert and which don't.
- It suggests: who to follow up with today · what to say based on past successful messages · which offer to present based on patterns.
- It reduces "forgotten leads" and "I should have followed up" moments.

Result: higher conversion rate, more clients, more revenue.

### 7.2 Better offer strategy (Business + Content operators)

- Aurelius sees which offers perform best with which audience segments.
- It sees which content leads to which type of inquiry.
- It suggests: which offer to push this week · which content to post to support that offer · how to position the offer based on past wins.

Result: better alignment between content and offers → more sales.

### 7.3 Better content that drives business (Content operator)

- Aurelius tracks content performance and lead generation.
- It learns: which topics generate leads · which hooks get saves and shares · which formats work best on each platform.
- It suggests: what to post next · how to script it · when to post it.

Result: more inbound leads, more attention, more opportunities.

### 7.4 Better training results (Training operator)

- Aurelius helps you program more intelligently.
- It learns what works for different athlete types.
- It reduces burnout and injury.
- It improves outcomes.

Result: better testimonials, better word-of-mouth, better retention → more revenue.

### 7.5 Better financial clarity (Wealth operator)

- Aurelius tracks income and expenses.
- It detects: where money is leaking · which months are strong or weak · which categories are bloated.
- It suggests: what to cut · what to double down on · how to stabilize cash flow.

Result: more profit from the same revenue, less waste.

### 7.6 Better use of your time (Personal OS operator)

- Aurelius manages your calendar and tasks.
- It protects focus blocks.
- It avoids overbooking.
- It helps you prioritize high-leverage work.

Result: more time spent on things that actually make money, less time lost to noise.

---

## 8. How it becomes truly Jarvis-level

Aurelius becomes Jarvis-level because:

- It's multi-domain (training, business, content, wealth, personal OS).
- It's pattern-learning (compiled understanding).
- It's knowledge-evolving (Living Knowledge).
- It's research-grounded (Research Memory).
- It's identity-stable (operator cores).
- It's LLM-minimizing over time.
- It's action-capable via integrations and automations.
- It's explicitly money-focused in how it reasons and acts.
