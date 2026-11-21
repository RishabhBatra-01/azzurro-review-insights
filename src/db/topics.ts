/**
 * Derived topic classifications.
 *
 * These rows are rebuildable from review text at any time, which is why they
 * live in their own table: the classifier can be re-tuned and re-run without
 * touching collected facts.
 */
import { db } from './client';
import { classifyReview, type Topic } from '../insights/topics';

const BATCH = 500;

export type ClassifiableReview = {
  id: number;
  positive_text: string | null;
  negative_text: string | null;
  lang: string | null;
};

/** Reviews to classify. Pass `onlyUnclassified` to skip ones already done. */
export async function reviewsForClassification(
  onlyUnclassified: boolean,
): Promise<ClassifiableReview[]> {
  const rows: ClassifiableReview[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await db()
      .from('review')
      .select('id, positive_text, negative_text, lang')
      .order('id')
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`reviewsForClassification failed: ${error.message}`);
    const page = (data ?? []) as ClassifiableReview[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  if (!onlyUnclassified) return rows;

  const { data, error } = await db().from('review_topic').select('review_id');
  if (error) throw new Error(`reading existing topics failed: ${error.message}`);
  const done = new Set((data ?? []).map((r) => (r as { review_id: number }).review_id));
  return rows.filter((r) => !done.has(r.id));
}

export type ClassifyOutcome = { reviewsSeen: number; tagsWritten: number };

/**
 * Classify and store. Topic rows for a review are replaced wholesale so a
 * re-run after a lexicon change cannot leave stale tags behind.
 */
export async function classifyAndStore(reviews: ClassifiableReview[]): Promise<ClassifyOutcome> {
  const rows = reviews.flatMap((review) =>
    classifyReview(review).map((t) => ({
      review_id: review.id,
      topic: t.topic as Topic,
      polarity: t.polarity,
      matched_term: t.matchedTerm,
    })),
  );

  const ids = reviews.map((r) => r.id);
  for (let i = 0; i < ids.length; i += BATCH) {
    const { error } = await db().from('review_topic').delete().in('review_id', ids.slice(i, i + BATCH));
    if (error) throw new Error(`clearing old topics failed: ${error.message}`);
  }

  for (let i = 0; i < rows.length; i += BATCH) {
    const { error } = await db().from('review_topic').insert(rows.slice(i, i + BATCH));
    if (error) throw new Error(`writing topics failed: ${error.message}`);
  }

  return { reviewsSeen: reviews.length, tagsWritten: rows.length };
}
