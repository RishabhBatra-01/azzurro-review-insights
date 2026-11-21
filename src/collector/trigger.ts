/**
 * Starting a collection from the dashboard's "Collect now" button.
 *
 * Off unless explicitly enabled, and never on a hosted deployment: the
 * collector drives a visible Chrome window (Booking.com refuses headless), so
 * it can only work on the operator's own machine. Enabling it on a public
 * server would also let any visitor make that server hit Booking.com.
 *
 * The run itself is the ordinary CLI — collect, then classify the new reviews —
 * started as a detached process, so it survives the request that launched it
 * and the dashboard never imports the scraper.
 */
import { spawn } from "node:child_process";
import { openSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { acquireLock, releaseLock, transferLock, type LockInfo } from "./lock";

export const COOLDOWN_MINUTES = 5;

export function uiCollectionEnabled(): boolean {
  return process.env.ENABLE_UI_COLLECTION === "1" && !process.env.VERCEL;
}

/** Launches collect + classify. Returns null if a run is already in progress. */
export async function startCollection(): Promise<LockInfo | null> {
  const lock = acquireLock();
  if (!lock) return null;

  try {
    const logDir = join(process.cwd(), "data", "raw"); // gitignored
    await mkdir(/*turbopackIgnore: true*/ logDir, { recursive: true });
    const log = openSync(/*turbopackIgnore: true*/ join(logDir, "ui-collect.log"), "w");

    // `;` not `&&`: reviews that did arrive still get classified even if one
    // property failed. The shell is the lock holder; the collector inherits it.
    const child = spawn(
      "sh",
      [
        "-c",
        "node --import tsx src/collector/run.ts; node --import tsx src/insights/classify.ts",
      ],
      { cwd: process.cwd(), detached: true, stdio: ["ignore", log, log] },
    );
    if (child.pid === undefined)
      throw new Error("collector process did not start");

    transferLock(child.pid, lock.startedAt);
    child.unref();
    return lock;
  } catch (error) {
    releaseLock();
    throw error;
  }
}
