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
import { weekBefore, weeksEndingWith } from '../insights/weeks';
import { resolveView } from './overview-view';

export const TREND_WEEKS = 12;
const RECENT_REVIEWS = 5;

/**
 * Everything the Overview shows, for one property or all of them, for the
 * chosen week (the current week by default).
 *
 * Every headline figure, trend and topic is worked out from `scoped`, the one
 * filtered set of rows, so no panel can quietly show all properties while the
 * page says one. The property cards, the rating-by-property chart and the map
 * always cover all four, because comparing them is their job.
 */
export async function loadOverview(params: { property?: string; week?: string } = {}) {
  const properties = await allProperties();
  const view = resolveView(params, properties.map((p) => p.id));
  const current = view.week;
  const previous = weekBefore(current);
  const weeks = weeksEndingWith(TREND_WEEKS, current);
  const earliest = weeks[0]!.start;

  const [rows, latest, collection] = await Promise.all([
    reviewsSince(earliest, current.end),
    // The current week shows the latest reviews, as before; a past week shows
    // the latest reviews from that week.
    searchReviews({
      propertyId: view.propertyId ?? undefined,
      from: view.isCurrentWeek ? undefined : current.start,
      to: view.isCurrentWeek ? undefined : current.end,
      limit: RECENT_REVIEWS,
      offset: 0,
    }),
    // Freshness is supporting context, not the dashboard's job: if the run log
    // cannot be read, the page still renders and the freshness chip is hidden.
    latestCollection().catch((error: unknown) => {
      console.error('Could not read collection status:', error);
      return null;
    }),
  ]);

  const scoped =
    view.propertyId === null ? rows : rows.filter((r) => r.property_id === view.propertyId);

  const overallTrend = trend(scoped, weeks);

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
    view,
    properties,
    current,
    previous,
    weeks,
    overall: compare(summarize(scoped, current), summarize(scoped, previous)),
    byProperty: compareByProperty(rows, properties.map((p) => p.id), current, previous),
    trend: overallTrend,
    overallAverages: overallTrend.map((w) => w.average),
    propertyTrends,
    complaints: topicBreakdown(scoped, current, 'negative'),
    praise: topicBreakdown(scoped, current, 'positive'),
    topics: topicSentiment(scoped, current),
    complaintMovement: topicMovement(scoped, current, previous, 'negative'),
    praiseMovement: topicMovement(scoped, current, previous, 'positive'),
    recent: latest.reviews,
    collection,

    /* How much of this week's intake the topic analysis can actually see.
       Shown on the dashboard because it is the denominator behind every topic
       percentage, and it is nowhere near 100%. */
    coverage: (() => {
      const week = scoped.filter(
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
