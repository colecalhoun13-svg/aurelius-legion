// aurelius/operators/coreUpdater.ts
// Stub for future self-upgrading intelligence

import fs from "fs";
import path from "path";
import type { OperatorType } from "../types.ts";
import type { OperatorCore } from "./coreTypes.ts";

const CORES_DIR = path.resolve(process.cwd(), "data", "cores");

export function saveCore(operator: OperatorType, core: OperatorCore) {
  const filePath = path.join(CORES_DIR, `${operator}.core.json`);
  fs.writeFileSync(filePath, JSON.stringify(core, null, 2), "utf-8");
}

export function versionedCorePath(operator: OperatorType, version: string) {
  return path.join(CORES_DIR, `${operator}.core.v${version}.json`);
}
