// aurelius/core/events.ts
//
// THE EVENT BUS — Aurelius's reactive substrate (NORTH_STAR keystone #63).
//
// The scheduled spine answers "what time is it?". The bus answers "what just
// HAPPENED?". Something occurs once — a lead arrived, a payment cleared, a PR
// landed — and zero-or-more reactors respond, each decoupled from the emitter
// and from each other. This is what "routed the right way, not willy-nilly"
// means in code: the emitter announces a fact ONCE and never learns who reacts;
// new reactions attach here, not by threading another call into the emitter.
//
// DESIGN — deliberately small, and honest about it:
//   • In-process only. No Kafka, no Redis. Aurelius is a single process on the
//     Mini / one Railway dyno; an external broker would be infrastructure with
//     no second consumer. Events are EPHEMERAL signals, not durable state — the
//     durable record is whatever a handler writes (a Lead, a BridgeSignal). A
//     restart drops in-flight events, which is correct: the fact that mattered
//     already left its mark in the database before emit was called.
//   • Every handler runs in its OWN trace thread and its OWN try/catch. One
//     reactor throwing never rejects emit and never starves its siblings — the
//     same honest-failure discipline the scheduled spine uses. A handler's
//     failure is a traced error row, not a cascade.
//   • Typed. AureliusEvent is a discriminated union; on()/emit() are checked
//     against it, so a typo'd event type or a handler reading the wrong field
//     fails at compile time, not in production. New event types are ADDED to
//     the union as real emitters appear — never speculatively (repo rule:
//     don't build reactions nothing fires).
//
// AUTONOMY. The bus moves NOTHING outward on its own. A reactor may finalize
// inward work inside a Cole-granted intent-class (draft, ingest, organize) or
// file a proposal — exactly what a scheduled job may do — because it runs the
// same executeAction path. "Event happened" is never a grant to send/publish/
// spend; those still stop at Cole's tap by construction.

import { runTraced } from "./trace.ts";

// ── The event vocabulary ─────────────────────────────────────────────
// One entry per fact something in the system actually emits TODAY. Add a
// member here the moment a new emitter is wired — and not before.
export type AureliusEvent =
  | {
      /** A lead arrived on its own (public intake / inbound capture) — the
       *  rarest, most time-critical business event. Carries only what a reactor
       *  needs to act without another DB read to decide whether to. */
      type: "lead.inbound";
      leadId: string;
      name: string;
      /** The channel it came through (website/instagram/referral/…). */
      source: string;
      /** Whether the lead left an email — a reactor that drafts an email reply
       *  must skip the ones it could never send. */
      hasEmail: boolean;
    };

export type EventType = AureliusEvent["type"];
type EventOf<T extends EventType> = Extract<AureliusEvent, { type: T }>;
type Handler<T extends EventType> = (event: EventOf<T>) => Promise<void> | void;

type Registration = { name: string; fn: Handler<any> };
const registry = new Map<EventType, Registration[]>();

/**
 * Subscribe a named handler to an event type. The name is not decoration: it
 * labels the handler's trace thread and appears in the wiring introspection, so
 * a reactor is never anonymous. Idempotent per (type, name) — registering the
 * same name twice REPLACES it, so a hot-reload or a double boot import can't
 * stack duplicate reactions (which would double-draft, double-charge, etc.).
 */
export function on<T extends EventType>(type: T, name: string, fn: Handler<T>): void {
  const list = registry.get(type) ?? [];
  const existing = list.findIndex((r) => r.name === name);
  const reg: Registration = { name, fn: fn as Handler<any> };
  if (existing >= 0) list[existing] = reg;
  else list.push(reg);
  registry.set(type, list);
}

/**
 * Unsubscribe a handler by (type, name). Symmetric with on() — completes the
 * lifecycle so a reactor can be retired cleanly (and tests leave the registry
 * as they found it). A no-op if that name was never registered.
 */
export function off(type: EventType, name: string): void {
  const list = registry.get(type);
  if (!list) return;
  const next = list.filter((r) => r.name !== name);
  if (next.length) registry.set(type, next);
  else registry.delete(type);
}

/**
 * Announce that something happened. Runs every subscribed handler CONCURRENTLY,
 * each wrapped in its own trace + catch, and resolves once all have settled.
 *
 * Callers choose the coupling: `await emit(...)` when the caller wants the
 * reactions done before it continues; `void emit(...)` (fire-and-forget) when
 * it must not block — e.g. an HTTP handler that shouldn't wait on a reactor's
 * LLM call. Fire-and-forget is safe because no handler can throw out of emit.
 */
export async function emit(event: AureliusEvent): Promise<void> {
  const list = registry.get(event.type);
  if (!list || list.length === 0) return;
  await Promise.allSettled(
    list.map((reg) =>
      // Each reactor is its own traced unit (kind "event" — visible in the
      // cockpit, and NOT in the paging set, so a reactor hiccup doesn't buzz
      // Cole's phone the way a dead scheduled ritual does). The catch keeps one
      // failure from rejecting the batch.
      runTraced("event", `${event.type}→${reg.name}`, async () => {
        await reg.fn(event);
      }).catch((err) => {
        console.warn(`[events] ${event.type}→${reg.name} failed:`, (err as any)?.message ?? err);
      })
    )
  );
}

/**
 * The bus's wiring, for the doctor / reachability / boot log. Rule 8: a
 * substrate nothing can inspect is a substrate you can't prove is wired. Lets a
 * reader see exactly which reactions are live without reading every module.
 */
export function listEventHandlers(): Array<{ type: EventType; handlers: string[] }> {
  return [...registry.entries()].map(([type, regs]) => ({ type, handlers: regs.map((r) => r.name) }));
}

/** Total live reactions — one number for the boot line and health checks. */
export function eventHandlerCount(): number {
  let n = 0;
  for (const regs of registry.values()) n += regs.length;
  return n;
}
