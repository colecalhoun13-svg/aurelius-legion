// aurelius/autonomy/registerActions.ts
//
// One place that wires every action-class to its commit function. Called once
// at boot (and in the smoke suite) so both the act-now path and the
// confirm-later path can find a finalizer. Adding a new acting workflow = write
// its finalizer + register it here.

import { registerActionFinalizer } from "./actionRegistry.ts";
import { finalizeScheduleProtection } from "./workflows/scheduleProtection.ts";

let registered = false;

export function registerAllActions(): void {
  if (registered) return;
  registered = true;
  registerActionFinalizer("calendar.schedule_protection", finalizeScheduleProtection);
}
