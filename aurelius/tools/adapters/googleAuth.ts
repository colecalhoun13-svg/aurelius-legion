// aurelius/tools/adapters/googleAuth.ts
//
// Google Sheets authentication.
//
// Phase 3 strategy: service account JSON key file referenced via env var
// GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH. The service account must have view +
// edit access to each athlete sheet (achieved by sharing the sheet with the
// service account's email).
//
// Block 3 status: scaffold. Returns null when creds are missing so adapters
// fail loud with a clear message rather than crashing.
// Block 4 wires actual googleapis client construction.

import { google } from "googleapis";
import type { sheets_v4, drive_v3 } from "googleapis";
import fs from "fs";
import path from "path";

// Cache the clients across calls — service account auth doesn't expire mid-process.
let cachedClient: sheets_v4.Sheets | null = null;
let cachedDrive: drive_v3.Drive | null = null;
let attemptedInit = false;

// Two ways to authenticate, preferred in order:
//   1. Cole's own Google login (OAuth) — reads/writes HIS sheets as HIM, so
//      nothing needs sharing. This is the "as easy as the calendar" path.
//   2. A service account JSON (GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH) — the older
//      shared-folder path, kept for multi-user / headless setups.
async function initAuth(): Promise<any | null> {
  // 1) Prefer Cole's OAuth login when it's connected + authorized for Sheets.
  try {
    const { getUserGoogleClient } = await import("../../calendar/googleAuth.ts");
    const userClient = await getUserGoogleClient();
    if (userClient) {
      console.log("[googleAuth] Sheets via Cole's Google login (no sharing needed)");
      return userClient;
    }
  } catch (err) {
    console.warn("[googleAuth] OAuth Sheets client unavailable, trying service account:", (err as any)?.message ?? err);
  }

  // 2) Fall back to the service account key file, if configured.
  const keyPath = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH;
  if (!keyPath) return null;
  const resolvedPath = path.isAbsolute(keyPath) ? keyPath : path.resolve(process.cwd(), keyPath);
  if (!fs.existsSync(resolvedPath)) {
    console.warn(`[googleAuth] service account key file not found at ${resolvedPath}`);
    return null;
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: resolvedPath,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.readonly",
    ],
  });
  return auth.getClient();
}

export async function getSheetsClient(): Promise<sheets_v4.Sheets | null> {
  if (cachedClient) return cachedClient;
  // No permanent attemptedInit latch: Cole may connect Google AFTER first boot,
  // so re-check each call until a client builds (cheap; result is cached on success).
  try {
    const authClient = await initAuth();
    if (!authClient) return null;
    cachedClient = google.sheets({ version: "v4", auth: authClient as any });
    cachedDrive = google.drive({ version: "v3", auth: authClient as any });
    return cachedClient;
  } catch (err: any) {
    console.error("[googleAuth] failed to initialize Sheets client:", err?.message ?? err);
    return null;
  }
}

/** Drive client (read-only) — lists spreadsheets shared with the service account. */
export async function getDriveClient(): Promise<drive_v3.Drive | null> {
  if (cachedDrive) return cachedDrive;
  await getSheetsClient(); // same init path builds both
  return cachedDrive;
}

// For testing — clear the cached clients so we can re-init after env changes.
export function resetSheetsClient(): void {
  cachedClient = null;
  cachedDrive = null;
  attemptedInit = false;
}