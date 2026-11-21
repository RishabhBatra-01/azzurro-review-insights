/**
 * Collection CLI.
 *
 *   npm run collect                      most recent 300 per property
 *   npm run collect -- --property <slug> one property only
 *   npm run collect -- --full            backfill up to 5000 per property
 *
 * Rules that matter more than speed:
 *   - One property failing never aborts the others.
 *   - A failed run never deletes existing data.
 *   - Every attempt is recorded in collection_run, success or failure.
 */
import { acquireLock, readLock, releaseLock } from "./lock";
import { PROPERTIES } from "./properties";
import { BookingGraphQLSource } from "./sources/booking-graphql";
import { SearchApiSource } from "./sources/searchapi";
import { normalizeBatch } from "./normalize";
import {
  ensureProperties,
  knownExternalIds,
  recordRun,
  upsertReviews,
} from "../db/reviews";

const DEFAULT_MAX = 300;
const FULL_MAX = 5000;
const STOP_AFTER_KNOWN = 20; // consecutive, not total — sort order isn't guaranteed strict
const MAX_REJECT_RATIO = 0.2;
// SearchApi returns 10 per request and each request costs a credit: one page
// usually suffices (stop after a full page of known reviews), three at most.
const FALLBACK_MAX = 30;
const FALLBACK_STOP_AFTER_KNOWN = 10;

const arg = (name: string): string | undefined => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
};

async function main() {
  const onlySlug = arg("property");
  // --full means "backfill history", so it must also ignore the early-stop rule,
  // otherwise a property whose newest reviews we already hold never goes deeper.
  const full = process.argv.includes("--full");
  const maxReviews = full ? FULL_MAX : Number(arg("max") ?? DEFAULT_MAX);

  const targets = onlySlug
    ? PROPERTIES.filter((p) => p.slug === onlySlug)
    : PROPERTIES;
  if (targets.length === 0) {
    console.error(
      `No property matching "${onlySlug}". Known: ${PROPERTIES.map((p) => p.slug).join(", ")}`,
    );
    process.exit(1);
  }

  // One collection at a time, however it was started. A run launched from the
  // dashboard inherits the lock its launcher (the parent shell) took for it.
  const holder = readLock();
  const inherited =
    holder !== null &&
    (holder.pid === process.pid || holder.pid === process.ppid);
  if (!inherited && !acquireLock()) {
    console.error(
      `Another collection is already running (pid ${holder?.pid}, since ${holder?.startedAt}).`,
    );
    process.exit(1);
  }

  try {
    await collect(targets, maxReviews, full);
  } finally {
    releaseLock(); // no-op unless this process owns it
  }
}

async function collect(
  targets: typeof PROPERTIES,
  maxReviews: number,
  full: boolean,
) {
  const properties = await ensureProperties();
  const idBySlug = new Map(properties.map((p) => [p.slug, p.id]));

  const source = new BookingGraphQLSource();
  await source.open();
  // Optional paid fallback, used per property only when the browser fails.
  const fallback = SearchApiSource.fromEnv();

  let failures = 0;

  try {
    for (const property of targets) {
      const propertyId = idBySlug.get(property.slug);
      const startedAt = new Date().toISOString();
      if (propertyId === undefined) {
        console.error(`! ${property.slug}: not found in database, skipping`);
        failures += 1;
        continue;
      }

      console.log(`\n=== ${property.assessmentLabel} (${property.slug}) ===`);

      try {
        const known = await knownExternalIds(propertyId);
        console.log(`    already stored: ${known.size}`);

        let result;
        try {
          result = await source.fetchReviews(property, {
            maxReviews,
            stopAfterKnown: full ? undefined : STOP_AFTER_KNOWN,
            isKnown: (id) => known.has(id),
          });
        } catch (error) {
          if (!fallback) throw error;
          // Newest reviews only, whatever the run asked for: credits are
          // limited, and a fallback is for staying current, not backfilling.
          console.warn(
            `    browser collector failed (${error instanceof Error ? error.message : error})`,
          );
          console.warn(
            `    -> falling back to SearchApi for the newest ${FALLBACK_MAX}`,
          );
          result = await fallback.fetchReviews(property, {
            maxReviews: FALLBACK_MAX,
            stopAfterKnown: FALLBACK_STOP_AFTER_KNOWN,
            isKnown: (id) => known.has(id),
          });
          console.log("    via SearchApi");
        }
        const { raw, reportedTotal, stoppedEarly, seen } = result;

        const { valid, rejected } = normalizeBatch(raw);

        // Health check: the source tells us how many reviews it has. Collecting
        // nothing from a property that advertises thousands means the parser
        // broke, not that there is no data.
        // "Nothing new" is fine; "nothing at all" from a source that says it has
        // reviews means the parser or the page broke.
        if (seen === 0 && (reportedTotal ?? 0) > 0) {
          throw new Error(
            `source returned 0 reviews but reports ${reportedTotal} — parser likely broken`,
          );
        }

        // Health check: a few rejects is normal, a flood means the shape changed.
        const rejectRatio = raw.length > 0 ? rejected.length / raw.length : 0;
        if (rejectRatio > MAX_REJECT_RATIO) {
          throw new Error(
            `${rejected.length}/${raw.length} reviews failed validation — refusing to store a partial, unreliable batch`,
          );
        }

        const { inserted, updated } = await upsertReviews(
          propertyId,
          valid,
          known,
        );

        for (const r of rejected.slice(0, 5)) {
          console.warn(
            `    rejected ${r.externalId ?? "(no id)"}: ${r.reason}`,
          );
        }

        const status = rejected.length > 0 ? "partial" : "ok";
        console.log(
          `    fetched ${raw.length}, valid ${valid.length}, rejected ${rejected.length}` +
            ` -> inserted ${inserted}, updated ${updated}` +
            `${stoppedEarly ? " (stopped early at known reviews)" : ""}`,
        );
        if (reportedTotal !== null)
          console.log(`    source reports ${reportedTotal} total`);

        await recordRun({
          propertyId,
          startedAt,
          status,
          seen: raw.length,
          inserted,
          updated,
          sourceTotal: reportedTotal,
          error:
            rejected.length > 0 ? `${rejected.length} rejected` : undefined,
        });
      } catch (error) {
        // Record and continue: one bad property must not cost us the others,
        // and nothing already stored is removed.
        failures += 1;
        const message = error instanceof Error ? error.message : String(error);
        console.error(`    FAILED: ${message}`);
        await recordRun({
          propertyId,
          startedAt,
          status: "failed",
          seen: 0,
          inserted: 0,
          updated: 0,
          error: message,
        }).catch(() => {});
      }
    }
  } finally {
    await source.close();
  }

  console.log(
    `\nDone. ${targets.length - failures}/${targets.length} properties collected.`,
  );
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(
    "Collection aborted:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
