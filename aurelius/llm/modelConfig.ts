// aurelius/llm/modelConfig.ts
//
// The model IDs the router defaults to, in one leaf module so the doctor can
// probe THE SAME model the system actually uses. Hardcoding a guess in the
// health check is how you get a red X next to a working engine — or a green
// tick next to a broken one.
//
// Overridable per-deploy: model access varies by account, and an account that
// can't reach the default should be one env var away from working, not a
// redeploy of the code.

/** Anthropic's default chat/strategic model. Override: ANTHROPIC_CHAT_MODEL */
export const ANTHROPIC_DEFAULT_MODEL =
  process.env.ANTHROPIC_CHAT_MODEL?.trim().replace(/^["']|["']$/g, "") || "claude-sonnet-5";

/** The deeper-reasoning Anthropic tier. Override: ANTHROPIC_OPUS_MODEL */
export const ANTHROPIC_OPUS_MODEL =
  process.env.ANTHROPIC_OPUS_MODEL?.trim().replace(/^["']|["']$/g, "") || "claude-opus-4-8";

/**
 * THE DEFAULT TIER, in one place.
 *
 * `chooseModel` names a handful of task types explicitly and everything else
 * falls through to the strategic tier — so this provider serves roughly all
 * reasoning. Three separate files needed to know that, and each had its own
 * hardcoded copy: the router's TIERS, the doctor's probe, and preflight's
 * health line. Cole's outage was exactly a disagreement of that kind (the
 * doctor probed a model the router didn't use), and then I reintroduced it in
 * preflight while fixing it in the doctor. One export, no copies.
 */
export const DEFAULT_TIER = {
  provider: "anthropic",
  get model() {
    return ANTHROPIC_DEFAULT_MODEL;
  },
  keyName: "ANTHROPIC_API_KEY",
} as const;

/** The frontier tiers — the ones a mini-model substitute would silently downgrade. */
export const FRONTIER_MODELS = new Set([ANTHROPIC_DEFAULT_MODEL, ANTHROPIC_OPUS_MODEL]);
