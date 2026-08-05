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
