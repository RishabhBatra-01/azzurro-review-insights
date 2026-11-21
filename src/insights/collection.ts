/**
 * Freshness of the dataset, from the collector's own run log. Shown on the
 * dashboard so nobody mistakes a stale snapshot for this morning's reviews.
 */
export type RunRow = {
  property_id: number | null;
  started_at: string;
  finished_at: string | null;
  status: 'ok' | 'partial' | 'failed';
};

export type CollectionStatus = {
  /** When the most recent run for any property finished. */
  lastFinishedAt: string | null;
  ok: number;
  partial: number;
  failed: number;
  /** Properties with at least one recorded run. */
  total: number;
};

/** Takes runs newest-first and keeps only the latest run per property. */
export function summarizeRuns(runs: readonly RunRow[]): CollectionStatus | null {
  const latest = new Map<number, RunRow>();
  for (const run of runs) {
    if (run.property_id === null || latest.has(run.property_id)) continue;
    latest.set(run.property_id, run);
  }
  if (latest.size === 0) return null;

  const status = { ok: 0, partial: 0, failed: 0 };
  let lastFinishedAt: string | null = null;
  for (const run of latest.values()) {
    status[run.status] += 1;
    const when = run.finished_at ?? run.started_at;
    if (lastFinishedAt === null || when > lastFinishedAt) lastFinishedAt = when;
  }
  return { lastFinishedAt, ...status, total: latest.size };
}
