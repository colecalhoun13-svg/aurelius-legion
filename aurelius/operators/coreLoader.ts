// aurelius/operators/coreLoader.ts
// Loads operator cores from /data/cores

import fs from "fs";
import path from "path";
import type { OperatorType } from "../types.ts";
import type { OperatorCore } from "./coreTypes.ts";

const CORES_DIR = path.resolve(process.cwd(), "data", "cores");

export function loadCore(operator: OperatorType): OperatorCore | null {
  try {
    const filePath = path.join(CORES_DIR, `${operator}.core.json`);
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as OperatorCore;
    return parsed;
  } catch (err) {
    console.error(`Error loading core for operator ${operator}:`, err);
    return null;
  }
}
