// aurelius/tools/registerTools.ts
//
// Bootstrap for tool adapter registration. Mirrors registerEngines.ts.
// Call registerAllTools() once at startup to populate the tool registry.

import { registerTool } from "./toolRegistry.ts";
import { googleSheetsAdapter } from "./adapters/googleSheets.ts";

export function registerAllTools(): void {
  registerTool(googleSheetsAdapter);

  // Future tools register here:
  //   registerTool(googleCalendarAdapter);   // Phase 5
  //   registerTool(instagramAdapter);        // Phase 6
}