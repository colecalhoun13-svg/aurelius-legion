// aurelius/tools/adapters/autonomy.ts
//
// The autonomy grant surface as a REGISTERED TOOL — so Cole can manage keyholes
// from the WEB CHAT, not only via Telegram slash commands. Pure delegation to
// autonomy/grants.ts, with one deliberate asymmetry that hard rule 1 forces:
//
//   • list_grants / revoke → run directly. Listing is read-only; revoking only
//     REDUCES autonomy, so it's always safe for Aurelius to do on Cole's word.
//   • grant → does NOT flip the switch. It files a GATED proposal on the Bridge
//     that Cole taps to confirm. "The grant switch is only ever Cole's hand"
//     (NORTH_STAR §2.5 / CLAUDE.md rule 1) — a slash command is Cole's literal
//     keystrokes, but a tool directive is the model's hand, so granting must
//     land on Cole's explicit tap. One tap, and it's his.

import type { ToolAdapter, ToolAdapterResult } from "../types.ts";
import { revokeAutonomy, listActiveGrants } from "../../autonomy/grants.ts";
import { checkGrantable, listGrantableClasses, getActionClass } from "../../autonomy/actionClasses.ts";
import { executeAction } from "../../autonomy/executor.ts";

export const autonomyAdapter: ToolAdapter = {
  name: "autonomy",
  description:
    "Manage Aurelius's autonomy grants (the scoped, reversible keyholes that let it finalize an inward action on its own). List active grants, grant a keyhole (files a Bridge confirmation — Cole taps to apply), or revoke one. Outward actions (send/publish/spend) can never be granted.",
  actions: [
    {
      name: "list_grants",
      description:
        "Show which keyholes are ON (active grants) and the full grantable menu. Use for 'what can you do on your own' / 'what have I granted'.",
      dataSchema: "{} (no fields)",
    },
    {
      name: "grant",
      description:
        "Request a keyhole be granted. Files a confirmation on the Bridge for Cole to tap — it does NOT grant on its own (the grant switch is Cole's hand). Use for 'grant schedule protection' / 'let you protect my focus time'.",
      dataSchema: '{ actionClass: string (e.g. "calendar.schedule_protection", "inbox.triage_draft") }',
      example: '[TOOL: autonomy.grant {"actionClass": "calendar.schedule_protection"}]',
    },
    {
      name: "revoke",
      description:
        "Turn a granted keyhole back off (Aurelius returns to proposing, not acting). Runs immediately. Use for 'stop protecting my calendar' / 'revoke inbox triage'.",
      dataSchema: '{ actionClass: string }',
      example: '[TOOL: autonomy.revoke {"actionClass": "calendar.schedule_protection"}]',
    },
  ],

  async run(action, data): Promise<ToolAdapterResult> {
    switch (action) {
      case "list_grants": {
        const [active, grantable] = [await listActiveGrants(), listGrantableClasses()];
        const activeKeys = new Set(active.map((g) => g.actionClass));
        return {
          ok: true,
          output: {
            summary: active.length
              ? `on: ${active.map((g) => g.actionClass).join(", ")}`
              : "no keyholes granted — Aurelius proposes everything, acts on nothing",
            active: active.map((g) => ({ actionClass: g.actionClass, grantedAt: g.grantedAt })),
            grantable: grantable.map((c: any) => ({ key: c.key, description: c.description, on: activeKeys.has(c.key) })),
          },
        };
      }

      case "grant": {
        const actionClass = data?.actionClass ? String(data.actionClass) : "";
        if (!actionClass) return { ok: false, output: null, error: 'actionClass required, e.g. {"actionClass":"calendar.schedule_protection"}' };
        // Validate BEFORE asking Cole to confirm — don't stage an ungrantable one.
        const check = checkGrantable(actionClass);
        if (!check.grantable) {
          return { ok: false, output: null, error: `can't grant "${actionClass}": ${check.reason}` };
        }
        const cls = getActionClass(actionClass);
        const key = cls?.key ?? actionClass;
        // Gate to Cole: file a pending Bridge confirmation. The apply_grant
        // finalizer (registerActions.ts) runs grantAutonomy only on his tap.
        const exec = await executeAction({
          actionClass: "autonomy.apply_grant",
          sourceType: "autonomy_grant_request",
          sourceId: `grant:${key}`,
          prepare: async () => ({
            title: `Grant the "${key}" keyhole?`,
            body: `This lets Aurelius finalize **${key}** on its own — reversibly, always landing on the Bridge. ${check.actionClass.description ?? ""}\n\nConfirm to turn it on; revoke anytime.`,
            domain: "personal",
            payload: { actionClass: key },
          }),
        });
        return {
          ok: true,
          output: {
            summary: `Filed a confirmation on the Bridge — tap Confirm to grant "${key}". (I don't flip that switch myself.)`,
            bridgeSignalId: exec.bridgeSignalId,
            actionClass: key,
          },
        };
      }

      case "revoke": {
        const actionClass = data?.actionClass ? String(data.actionClass) : "";
        if (!actionClass) return { ok: false, output: null, error: "actionClass required" };
        const r = await revokeAutonomy(actionClass);
        return {
          ok: true,
          output: {
            summary: r ? `Revoked "${r.actionClass}" — back to proposing, not acting.` : `No active grant for "${actionClass}".`,
            revoked: !!r,
          },
        };
      }

      default:
        return { ok: false, output: null, error: `unknown autonomy action: ${action}` };
    }
  },
};
