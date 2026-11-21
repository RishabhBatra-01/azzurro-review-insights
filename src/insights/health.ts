/**
 * Health check: compare our stored data against booking.com's own published
 * figures.
 *
 * This is the check that catches silent corruption — a parser that keeps
 * "working" but records the wrong thing. If booking.com says a property scores
 * 6.5 and our rows average 3.2, something changed even though every individual
 * parse succeeded. The published score is ground truth we did not generate.
 */
import { allProperties, allReviews } from '../db/queries';
import { averageScore } from './scoring';

/** Scores shown on the property pages, captured 2026-11-21. */
const PUBLISHED_SCORES: Record<string, number> = {
  'olympic-paddington': 6.5,
  'venus-potts-point-sydney': 6.3,
  'venus-surry-hills': 6.6,
  'chateau-de-venus': 6.6,
};

/** How far our average may drift from the published one before we complain. */
const TOLERANCE = 1.5;

async function main() {
  const [properties, reviews] = await Promise.all([allProperties(), allReviews()]);
  let problems = 0;

  console.log('property                      stored   ours   booking   diff');
  for (const property of properties) {
    const own = reviews.filter((r) => r.property_id === property.id);
    const ours = averageScore(own.map((r) => r.review_score));
    const published = PUBLISHED_SCORES[property.slug];

    if (ours === null || published === undefined) {
      console.log(`${property.slug.padEnd(28)} ${String(own.length).padStart(6)}      -      -      -`);
      continue;
    }

    const diff = Math.round(Math.abs(ours - published) * 100) / 100;
    const flag = diff > TOLERANCE ? '  <-- CHECK' : '';
    if (diff > TOLERANCE) problems += 1;
    console.log(
      `${property.slug.padEnd(28)} ${String(own.length).padStart(6)}` +
        ` ${ours.toFixed(2).padStart(6)} ${published.toFixed(1).padStart(8)}` +
        ` ${diff.toFixed(2).padStart(6)}${flag}`,
    );
  }

  console.log(`\nTotal stored: ${reviews.length}`);
  console.log(
    problems === 0
      ? 'OK — every property is within tolerance of its published score.'
      : `${problems} propert${problems === 1 ? 'y' : 'ies'} outside tolerance.`,
  );
  // Note: we store the most recent N per property, so a small gap from the
  // all-time published average is expected and not a failure.
  if (problems > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error('Health check failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
