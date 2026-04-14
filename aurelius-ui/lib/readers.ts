import fs from "fs";
import path from "path";

export function readDailyLogs() {
  const dir = path.resolve(process.cwd(), "../aurelius/data/daily_logs");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map(file => ({
    file,
    content: fs.readFileSync(path.join(dir, file), "utf-8")
  }));
}

export function readWeeklyLogs() {
  const dir = path.resolve(process.cwd(), "../aurelius/data/weekly_logs");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map(file => ({
    file,
    content: fs.readFileSync(path.join(dir, file), "utf-8")
  }));
}

export function readSystemState() {
  const file = path.resolve(process.cwd(), "../aurelius/data/system/system.json");
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export function readMemory() {
  const file = path.resolve(process.cwd(), "../aurelius/data/memory/memory.json");
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}
