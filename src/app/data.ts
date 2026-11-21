import 'server-only';

/**
 * Dashboard data loading. Server-only: the browser never talks to Supabase, so
 * no key is ever shipped to the client.
 */
import {
  allProperties, latestCollection, reviewsSince, searchReviews, type PropertyRow,
} from '../db/queries';
import {
  compare, compareByProperty, summarize, topicBreakdown, topicMovement, topicSentiment, trend,
} from '../insights/metrics';
import { isClassifiable } from '../insights/topics';
import { currentWeek, previousWeek, recentWeeks } from '../insights/weeks';

export const TREND_WEEKS = 12;
const RECENT_REVIEWS = 5;

export async function loadOverview() {
  const weeks = recentWeeks(TREND_WEEKS);
  const earliest = weeks[0]!.start;

  const [properties, rows, latest, collection] = await Promise.all([
    allProperties(),
    reviewsSince(earliest),
    // The feed query already sorts newest-first, so the overview's "recent
    // reviews" panel reuses it rather than adding a near-duplicate query.
    searchReviews({ limit: RECENT_REVIEWS, offset: 0 }),
    // Freshness is supporting context, not the dashboard's job: if the run log
    // cannot be read, the page still renders and the freshness chip is hidden.
    latestCollection().catch((error: unknown) => {
      console.error('Could not read collection status:', error);
      return null;
    }),
  ]);

  const current = currentWeek();
  const previous = previousWeek();

  const overallTrend = trend(rows, weeks);

  // Per-property weekly averages, for the sparkline on each property card.
  // Reuses the same `trend` function rather than a parallel implementation, so
  // the week bucketing can never drift between the chart and the cards.
  const propertyTrends = new Map<number, (number | null)[]>(
    properties.map((p) => [
      p.id,
      trend(rows.filter((r) => r.property_id === p.id), weeks).map((w) => w.average),
    ]),
  );

  return {
    properties,
    current,
    previous,
    weeks,
    overall: compare(summarize(rows, current), summarize(rows, previous)),
    byProperty: compareByProperty(rows, properties.map((p) => p.id), current, previous),
    trend: overallTrend,
    overallAverages: overallTrend.map((w) => w.average),
    propertyTrends,
    complaints: topicBreakdown(rows, current, 'negative'),
    praise: topicBreakdown(rows, current, 'positive'),
    topics: topicSentiment(rows, current),
    complaintMovement: topicMovement(rows, current, previous, 'negative'),
    praiseMovement: topicMovement(rows, current, previous, 'positive'),
    recent: latest.reviews,
    collection,

    /* How much of this week's intake the topic analysis can actually see.
       Shown on the dashboard because it is the denominator behind every topic
       percentage, and it is nowhere near 100%. */
    coverage: (() => {
      const week = rows.filter(
        (r) => r.reviewed_on_sydney >= current.start && r.reviewed_on_sydney <= current.end,
      );
      const classifiable = week.filter((r) => isClassifiable(r)).length;
      return {
        total: week.length,
        classifiable,
        percentage: week.length === 0 ? 0 : Math.round((classifiable / week.length) * 100),
      };
    })(),
  };
}

export type Overview = Awaited<ReturnType<typeof loadOverview>>;
export type { PropertyRow };
