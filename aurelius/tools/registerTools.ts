// aurelius/tools/registerTools.ts
//
// Bootstrap for tool adapter registration. Mirrors registerEngines.ts.
// Call registerAllTools() once at startup to populate the tool registry.

import { registerTool } from "./toolRegistry.ts";
import { planningAdapter } from "./adapters/planning.ts";
import { googleSheetsAdapter } from "./adapters/googleSheets.ts";
import { googleCalendarAdapter } from "./adapters/googleCalendar.ts";

export function registerAllTools(): void {
  registerTool(googleSheetsAdapter);
  registerTool(planningAdapter);
  registerTool(googleCalendarAdapter);

  // Future tools register here:
  //   registerTool(instagramAdapter);        // Phase 6
}