// aurelius/llm/promptMarkers.ts
//
// The cache boundary (final council, efficiency seat). Everything ABOVE this
// marker in the assembled system prompt is static per operator combination —
// persona, identity, operator cores, the tool catalog — and is sent by the
// Anthropic adapter as a cache_control block (90% discount on cache reads).
// Everything below is live context that changes per call. A tiny shared
// module so the router and the engine adapters can agree on the split
// without importing each other.

export const CACHE_BREAK = "═══ LIVE CONTEXT ═══";
