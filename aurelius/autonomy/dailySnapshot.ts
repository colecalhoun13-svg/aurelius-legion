// aurelius/autonomy/dailySnapshot.ts
/**
 * Daily Snapshot — Aurelius OS v3.4
 * Saves cockpit-ready daily logs.
 */

import fs from "fs";
import path from "path";

export function saveDailySnapshot(content: string) {
  const logsDir = path.resolve(process.cwd(), "data", "daily_logs");

  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().split("T")[0];
  const filePath = path.join(logsDir, `${timestamp}.log`);

  fs.writeFileSync(filePath, content, "utf-8");
}
