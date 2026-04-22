// aurelius/operators/coreLoader.ts

import fs from "fs";
import path from "path";

const CORES_DIR = path.resolve(
  __dirname,
  "../data/cores"
);

function ensureCoresDir() {
  if (!fs.existsSync(CORES_DIR)) {
    fs.mkdirSync(CORES_DIR, { recursive: true });
  }
}

export async function loadCore(
  coreName: string
): Promise<any> {
  ensureCoresDir();
  const filePath = path.join(CORES_DIR, `${coreName}.json`);
  if (!fs.existsSync(filePath)) {
    return {
      version: "0.1",
      principles: [],
      constraints: [],
      insights: [],
    };
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

export async function saveCore(
  coreName: string,
  data: any
): Promise<void> {
  ensureCoresDir();
  const filePath = path.join(CORES_DIR, `${coreName}.json`);
  fs.writeFileSync(
    filePath,
    JSON.stringify(data, null, 2),
    "utf-8"
  );
}
