// aurelius/autonomy/actionRegistry.ts
//
// Maps an action-class to the function that COMMITS it from a plain payload.
// This is what lets a gated proposal be executed LATER, when Cole confirms on
// the Bridge — the executor stores the payload, and confirmAction() looks up
// the finalizer here and runs it. Same finalizer for both paths (act-now and
// confirm-later), so an action's commit logic is defined exactly once.
//
// Finalizers take a JSON-serializable payload (whatever the workflow's prepare()
// put there) so nothing needs a live closure to be re-run after a restart.

export type ActionFinalizer = (payload: any) => Promise<any>;

const REGISTRY = new Map<string, ActionFinalizer>();

export function registerActionFinalizer(actionClass: string, fn: ActionFinalizer): void {
  REGISTRY.set(actionClass, fn);
}

export function getActionFinalizer(actionClass: string): ActionFinalizer | undefined {
  return REGISTRY.get(actionClass);
}

export function hasActionFinalizer(actionClass: string): boolean {
  return REGISTRY.has(actionClass);
}
