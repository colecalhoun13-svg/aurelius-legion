// aurelius/tools/registerTools.ts
//
// Bootstrap for tool adapter registration. Mirrors registerEngines.ts.
// Call registerAllTools() once at startup to populate the tool registry.

import { registerTool } from "./toolRegistry.ts";
import { planningAdapter } from "./adapters/planning.ts";
import { googleSheetsAdapter } from "./adapters/googleSheets.ts";
import { googleCalendarAdapter } from "./adapters/googleCalendar.ts";
import { gmailAdapter } from "./adapters/gmail.ts";
import { fredAdapter } from "./adapters/fred.ts";
import { webAdapter } from "./adapters/web.ts";
import { productivityAdapter } from "./adapters/productivity.ts";
import { autonomyAdapter } from "./adapters/autonomy.ts";

export function registerAllTools(): void {
  registerTool(googleSheetsAdapter);
  registerTool(planningAdapter);
  registerTool(googleCalendarAdapter);
  registerTool(gmailAdapter);
  registerTool(fredAdapter);
  registerTool(webAdapter);
  registerTool(productivityAdapter); // Cole's tasks/goals/today from chat
  registerTool(autonomyAdapter);     // grant (gated) / revoke / list keyholes from chat

  // Future tools register here:
  //   registerTool(instagramAdapter);        // Phase 6
}