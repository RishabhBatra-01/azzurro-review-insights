import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { acquireLock, readLock, releaseLock, transferLock } from '../src/collector/lock';

const tempLock = () => join(mkdtempSync(join(tmpdir(), 'lock-test-')), 'collect.lock');
// A pid that cannot be running: far above any real pid range.
const DEAD_PID = 2_147_483_000;

describe('collection lock', () => {
  it('lets exactly one run hold it', () => {
    const path = tempLock();
    expect(acquireLock(path)).not.toBeNull();
    expect(acquireLock(path)).toBeNull();
    expect(readLock(path)?.pid).toBe(process.pid);
  });

  it('reclaims a lock left behind by a crashed run', () => {
    const path = tempLock();
    writeFileSync(path, JSON.stringify({ pid: DEAD_PID, startedAt: '2026-11-21T00:00:00Z' }));
    expect(readLock(path)).toBeNull();
    expect(acquireLock(path)?.pid).toBe(process.pid);
  });

  it('reclaims a corrupt lock file rather than blocking forever', () => {
    const path = tempLock();
    writeFileSync(path, 'not json');
    expect(acquireLock(path)).not.toBeNull();
  });

  it('only lets the owner release it', () => {
    const path = tempLock();
    acquireLock(path);
    releaseLock(path, DEAD_PID); // not the owner
    expect(readLock(path)).not.toBeNull();
    releaseLock(path, process.pid);
    expect(readLock(path)).toBeNull();
  });

  it('can be handed to the process that does the work', () => {
    const path = tempLock();
    const held = acquireLock(path)!;
    transferLock(process.ppid, held.startedAt, path);
    expect(readLock(path)).toEqual({ pid: process.ppid, startedAt: held.startedAt });
  });
});
