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

// One auth, both scopes: spreadsheets (read/write cells) + drive.readonly (LIST
// what's been shared with the service account — this powers sync_roster, so Cole
// shares one folder once instead of registering every sheet by hand).
async function initAuth(): Promise<any | null> {
  const keyPath = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH;
  if (!keyPath) {
    console.warn(
      "[googleAuth] GOOGLE_SHEETS_SERVICE_ACCOUNT_PATH not set — Sheets adapter will return errors on every call."
    );
    return null;
  }

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
  if (attemptedInit) return null; // already tried and failed; don't retry every call

  attemptedInit = true;

  try {
    const authClient = await initAuth();
    if (!authClient) return null;
    cachedClient = google.sheets({ version: "v4", auth: authClient as any });
    cachedDrive = google.drive({ version: "v3", auth: authClient as any });

    console.log("[googleAuth] Sheets client initialized successfully");
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