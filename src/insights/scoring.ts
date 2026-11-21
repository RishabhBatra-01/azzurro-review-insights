/**
 * Positive / negative classification.
 *
 * We do not infer sentiment from text. booking.com gives a numeric score per
 * review, so the bands below are the definition — documented here and in the
 * README so the dashboard's numbers can be reproduced by hand.
 *
 * Bands follow booking.com's own presentation, where 8+ reads as "Very good".
 */
export const POSITIVE_MIN = 8.0;
export const NEGATIVE_BELOW = 6.0;

/** Below this many reviews, a weekly average is not worth showing. */
export const LOW_DATA_THRESHOLD = 3;

export type Band = 'positive' | 'neutral' | 'negative';

/** Returns null for score-less reviews, which are real and must not count as 0. */
export function band(score: number | null | undefined): Band | null {
  if (score === null || score === undefined) return null;
  if (score >= POSITIVE_MIN) return 'positive';
  if (score < NEGATIVE_BELOW) return 'negative';
  return 'neutral';
}

export type BandCounts = { positive: number; neutral: number; negative: number; unscored: number };

export function countBands(scores: ReadonlyArray<number | null>): BandCounts {
  const counts: BandCounts = { positive: 0, neutral: 0, negative: 0, unscored: 0 };
  for (const score of scores) {
    const b = band(score);
    if (b === null) counts.unscored += 1;
    else counts[b] += 1;
  }
  return counts;
}

/** Mean of scored reviews only. Null when nothing is scored — never 0. */
export function averageScore(scores: ReadonlyArray<number | null>): number | null {
  const scored = scores.filter((s): s is number => s !== null && s !== undefined);
  if (scored.length === 0) return null;
  const total = scored.reduce((sum, s) => sum + s, 0);
  return Math.round((total / scored.length) * 100) / 100;
}
