/**
 * Review persistence. Dedup is enforced by the database via
 * UNIQUE (property_id, external_id), not by logic here.
 */
import { db } from './client';
import type { NormalizedReview } from '../collector/normalize';
import { PROPERTIES, type PropertyConfig } from '../collector/properties';

const UPSERT_BATCH = 500;

export type PropertyRow = { id: number; slug: string; display_name: string };

/** Insert the four properties if absent. Idempotent — safe to run every time. */
export async function ensureProperties(): Promise<PropertyRow[]> {
  const { error } = await db()
    .from('property')
    .upsert(
      PROPERTIES.map((p: PropertyConfig) => ({
        slug: p.slug,
        assessment_label: p.assessmentLabel,
        display_name: p.displayName,
        url: p.url,
      })),
      { onConflict: 'slug' },
    );
  if (error) throw new Error(`ensureProperties failed: ${error.message}`);

  const { data, error: readError } = await db().from('property').select('id, slug, display_name');
  if (readError) throw new Error(`reading properties failed: ${readError.message}`);
  return (data ?? []) as PropertyRow[];
}

/** External ids we already hold, used to stop collection early. */
export async function knownExternalIds(propertyId: number): Promise<Set<string>> {
  const ids = new Set<string>();
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db()
      .from('review')
      .select('external_id')
      .eq('property_id', propertyId)
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`knownExternalIds failed: ${error.message}`);
    const rows = data ?? [];
    for (const row of rows) ids.add((row as { external_id: string }).external_id);
    if (rows.length < pageSize) break;
  }
  return ids;
}

export type UpsertOutcome = { inserted: number; updated: number };

/**
 * Upsert reviews for one property.
 *
 * `first_seen_at` is deliberately left out of the payload so an update never
 * overwrites when we originally saw a review; the column default covers inserts.
 */
export async function upsertReviews(
  propertyId: number,
  reviews: NormalizedReview[],
  alreadyKnown: Set<string>,
): Promise<UpsertOutcome> {
  if (reviews.length === 0) return { inserted: 0, updated: 0 };

  const now = new Date().toISOString();
  const rows = reviews.map((r) => ({ ...r, property_id: propertyId, last_seen_at: now }));

  for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
    const batch = rows.slice(i, i + UPSERT_BATCH);
    const { error } = await db()
      .from('review')
      .upsert(batch, { onConflict: 'property_id,external_id' });
    if (error) throw new Error(`upsertReviews failed: ${error.message}`);
  }

  let updated = 0;
  for (const r of reviews) if (alreadyKnown.has(r.external_id)) updated += 1;
  return { inserted: reviews.length - updated, updated };
}

export type RunStatus = 'ok' | 'partial' | 'failed';

export async function recordRun(run: {
  propertyId: number | null;
  startedAt: string;
  status: RunStatus;
  seen: number;
  inserted: number;
  updated: number;
  /** Booking.com's own review count for the property, when the run reached it. */
  sourceTotal?: number | null;
  error?: string;
}): Promise<void> {
  const row = {
    property_id: run.propertyId,
    started_at: run.startedAt,
    finished_at: new Date().toISOString(),
    status: run.status,
    reviews_seen: run.seen,
    reviews_inserted: run.inserted,
    reviews_updated: run.updated,
    source_total: run.sourceTotal ?? null,
    error: run.error ?? null,
  };
  let { error } = await db().from('collection_run').insert(row);
  // shortcut: a database without migration 0003 has no source_total column;
  // record the run without it rather than lose the run log. Remove once every
  // environment has applied 0003.
  if (error?.code === 'PGRST204') {
    const { source_total: _unrecorded, ...withoutTotal } = row;
    ({ error } = await db().from('collection_run').insert(withoutTotal));
  }
  if (error) throw new Error(`recordRun failed: ${error.message}`);
}
