/**
 * Single-flight lock for collection runs.
 *
 * Shared by every way a run can start — the CLI, the dashboard's "Collect now"
 * button, a scheduler — so two collections can never hit Booking.com at once.
 * This is the only collector module the web app imports; the scraper itself
 * stays out of the web bundle.
 *
 * The lock is a file created atomically ('wx' fails if it exists). It records
 * the owning process id, so a lock left behind by a crashed run is detected as
 * stale and reclaimed instead of blocking collection forever.
 *
 * The turbopackIgnore markers: these paths are in the OS temp folder, but the
 * bundler cannot tell, and would otherwise trace the whole project into the
 * server build.
 */
import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const LOCK_PATH = join(tmpdir(), 'azzurro-collect.lock');

export type LockInfo = { pid: number; startedAt: string };

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 checks existence without touching the process
    return true;
  } catch (error) {
    // EPERM: it exists but belongs to someone else — still alive.
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function readRaw(path: string): LockInfo | null {
  try {
    const info = JSON.parse(readFileSync(/*turbopackIgnore: true*/ path, 'utf8')) as Partial<LockInfo>;
    return typeof info.pid === 'number' && typeof info.startedAt === 'string'
      ? { pid: info.pid, startedAt: info.startedAt }
      : null;
  } catch {
    return null;
  }
}

/** The current lock, or null if there is none or its owner has died. */
export function readLock(path = LOCK_PATH): LockInfo | null {
  const info = readRaw(path);
  return info && isAlive(info.pid) ? info : null;
}

/** Takes the lock for `pid`. Returns null if a live run already holds it. */
export function acquireLock(path = LOCK_PATH, pid = process.pid): LockInfo | null {
  const info: LockInfo = { pid, startedAt: new Date().toISOString() };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const fd = openSync(/*turbopackIgnore: true*/ path, 'wx');
      writeSync(fd, JSON.stringify(info));
      closeSync(fd);
      return info;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (readLock(path)) return null; // genuinely held
      try {
        unlinkSync(/*turbopackIgnore: true*/ path); // stale or unreadable: reclaim and retry once
      } catch {
        /* another process reclaimed it first; the retry decides */
      }
    }
  }
  return null;
}

/** Hands a held lock to another process (the spawned collector). */
export function transferLock(to: number, startedAt: string, path = LOCK_PATH): void {
  writeFileSync(/*turbopackIgnore: true*/ path, JSON.stringify({ pid: to, startedAt } satisfies LockInfo));
}

/** Releases the lock, but only if `pid` still owns it. */
export function releaseLock(path = LOCK_PATH, pid = process.pid): void {
  if (readRaw(path)?.pid !== pid) return;
  try {
    unlinkSync(/*turbopackIgnore: true*/ path);
  } catch {
    /* already gone */
  }
}
