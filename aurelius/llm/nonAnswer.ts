// aurelius/llm/nonAnswer.ts
//
// THE SINGLE SOURCE OF TRUTH for "is this text an engine's I-can't-run string,
// not a real answer?" (hard rule 3: never file error text as content). This was
// copy-pasted as an identical regex across 6+ modules (wealth, planning, wiki,
// rituals, missions, semanticReuse) — the moment any one diverged from the
// adapters' actual strings, that call site would serve/file a config error as a
// real market analysis / wiki edit / briefing / cached answer. One regex, here,
// imported everywhere. A dependency-free leaf so any module can import it with
// zero cycle risk.
//
// Must match EVERY adapter's keyless message, not just Anthropic's:
//   • anthropicEngine → "Anthropic engine is not configured. Missing ANTHROPIC_API_KEY."
//   • the other five   → "<PROVIDER>_API_KEY is not configured."  (e.g. GROQ_API_KEY)
//   • the router's own all-providers-down line ("All configured LLM providers failed").

export function engineUnavailableText(text: string): boolean {
  return /_API_KEY is not configured|engine is not configured|Missing .*_API_KEY|All configured LLM providers failed/i.test(
    text ?? ""
  );
}
