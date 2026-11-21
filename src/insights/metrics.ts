/**
 * Dashboard metrics. Pure functions over review rows — no database, no React,
 * so every number here is unit-testable.
 *
 * Aggregating in memory rather than in SQL is a deliberate choice at this size
 * (a few thousand rows per query). It keeps the tested scoring and topic logic
 * as the single source of truth instead of duplicating thresholds in SQL.
 * shortcut: fine to ~50k reviews, move to SQL aggregates beyond that.
 */
import { averageScore, countBands, LOW_DATA_THRESHOLD, type BandCounts } from './scoring';
import { classifyReview, isClassifiable, TOPICS, type Polarity, type Topic } from './topics';
import { isWithin, type DateRange } from './weeks';

export type ReviewRow = {
  property_id: number;
  review_score: number | null;
  reviewed_on_sydney: string;
  lang: string | null;
  positive_text: string | null;
  negative_text: string | null;
};

export type WeekSummary = {
  range: DateRange;
  reviewCount: number;
  scoredCount: number;
  average: number | null;
  bands: BandCounts;
  /** True when there are too few reviews for the average to mean anything. */
  lowData: boolean;
};

export function summarize(rows: readonly ReviewRow[], range: DateRange): WeekSummary {
  const inRange = rows.filter((r) => isWithin(r.reviewed_on_sydney, range));
  const scores = inRange.map((r) => r.review_score);
  const scored = scores.filter((s): s is number => s !== null);

  return {
    range,
    reviewCount: inRange.length,
    scoredCount: scored.length,
    average: averageScore(scores),
    bands: countBands(scores),
    lowData: scored.length < LOW_DATA_THRESHOLD,
  };
}

export type Comparison = {
  current: WeekSummary;
  previous: WeekSummary;
  /** Null when either side lacks enough data to compare honestly. */
  delta: number | null;
  direction: 'up' | 'down' | 'flat' | 'unknown';
};

export function compare(current: WeekSummary, previous: WeekSummary): Comparison {
  const comparable =
    current.average !== null && previous.average !== null && !current.lowData && !previous.lowData;

  if (!comparable) {
    return { current, previous, delta: null, direction: 'unknown' };
  }

  const delta = Math.round((current.average! - previous.average!) * 100) / 100;
  return {
    current,
    previous,
    delta,
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
  };
}

export type PropertyComparison = Comparison & { propertyId: number };

export function compareByProperty(
  rows: readonly ReviewRow[],
  propertyIds: readonly number[],
  current: DateRange,
  previous: DateRange,
): PropertyComparison[] {
  return propertyIds.map((propertyId) => {
    const own = rows.filter((r) => r.property_id === propertyId);
    return { propertyId, ...compare(summarize(own, current), summarize(own, previous)) };
  });
}

export type TrendPoint = WeekSummary;

export function trend(rows: readonly ReviewRow[], weeks: readonly DateRange[]): TrendPoint[] {
  return weeks.map((week) => summarize(rows, week));
}

export type TopicStat = {
  topic: Topic;
  count: number;
  /** Reviews that could be classified at all — the percentage's denominator. */
  denominator: number;
  percentage: number;
};

export type TopicBreakdown = {
  polarity: Polarity;
  stats: TopicStat[];
  denominator: number;
  /** Reviews excluded because they had no text or were not in English. */
  excluded: number;
};

/**
 * Topic breakdown for one polarity within a range.
 *
 * The denominator is reviews in range that carry text on the relevant side and
 * are in English — NOT all reviews. A review with no written complaint cannot
 * mention cleanliness, so counting it would understate every topic. The
 * excluded count is returned so the UI can state it plainly.
 */
export function topicBreakdown(
  rows: readonly ReviewRow[],
  range: DateRange,
  polarity: Polarity,
): TopicBreakdown {
  const inRange = rows.filter((r) => isWithin(r.reviewed_on_sydney, range));

  const eligible = inRange.filter((r) => {
    if (!isClassifiable(r)) return false;
    return polarity === 'negative' ? Boolean(r.negative_text) : Boolean(r.positive_text);
  });

  const counts = new Map<Topic, number>();
  for (const review of eligible) {
    for (const tag of classifyReview(review)) {
      if (tag.polarity !== polarity) continue;
      counts.set(tag.topic, (counts.get(tag.topic) ?? 0) + 1);
    }
  }

  const denominator = eligible.length;
  const stats: TopicStat[] = TOPICS.map((topic) => {
    const count = counts.get(topic) ?? 0;
    return {
      topic,
      count,
      denominator,
      percentage: denominator === 0 ? 0 : Math.round((count / denominator) * 1000) / 10,
    };
  })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count);

  return { polarity, stats, denominator, excluded: inRange.length - denominator };
}

export type TopicSentiment = {
  topic: Topic;
  positive: number;
  negative: number;
  mentions: number;
  /** Share of this topic's mentions that were praise rather than complaint. */
  positiveShare: number;
  lowData: boolean;
};

/**
 * Praise-versus-complaint split per topic, over every classifiable review in
 * range (not split by which field the text sat in, as `topicBreakdown` is).
 *
 * `denominator` is the number of reviews that could be classified at all. It
 * is returned rather than inferred because it is nothing like the total review
 * count: roughly half of all reviews carry no text, and half are not in
 * English. The UI prints it.
 */
export function topicSentiment(
  rows: readonly ReviewRow[],
  range: DateRange,
): { stats: TopicSentiment[]; denominator: number; excluded: number } {
  const inRange = rows.filter((r) => isWithin(r.reviewed_on_sydney, range));
  const eligible = inRange.filter((r) => isClassifiable(r));

  const positive = new Map<Topic, number>();
  const negative = new Map<Topic, number>();

  for (const review of eligible) {
    for (const tag of classifyReview(review)) {
      const bucket = tag.polarity === 'positive' ? positive : negative;
      bucket.set(tag.topic, (bucket.get(tag.topic) ?? 0) + 1);
    }
  }

  const stats = TOPICS.map((topic) => {
    const pos = positive.get(topic) ?? 0;
    const neg = negative.get(topic) ?? 0;
    const mentions = pos + neg;
    return {
      topic,
      positive: pos,
      negative: neg,
      mentions,
      positiveShare: mentions === 0 ? 0 : Math.round((pos / mentions) * 1000) / 10,
      lowData: mentions < LOW_DATA_THRESHOLD,
    };
  })
    .filter((s) => s.mentions > 0)
    .sort((a, b) => b.mentions - a.mentions);

  return { stats, denominator: eligible.length, excluded: inRange.length - eligible.length };
}

export type TopicMovement = {
  topic: Topic;
  current: number;
  previous: number;
  currentShare: number;
  /**
   * Change in share, in percentage points. Null when either week has too few
   * classifiable reviews for the comparison to mean anything — with weekly
   * denominators in single figures, one review can swing a share by 15 points.
   */
  deltaPoints: number | null;
};

export function topicMovement(
  rows: readonly ReviewRow[],
  current: DateRange,
  previous: DateRange,
  polarity: Polarity,
): { movers: TopicMovement[]; denominator: number; previousDenominator: number } {
  const now = topicBreakdown(rows, current, polarity);
  const then = topicBreakdown(rows, previous, polarity);

  const thenByTopic = new Map(then.stats.map((s) => [s.topic, s]));
  const comparable =
    now.denominator >= LOW_DATA_THRESHOLD && then.denominator >= LOW_DATA_THRESHOLD;

  const movers = now.stats.map((stat) => {
    const before = thenByTopic.get(stat.topic);
    const previousShare = before?.percentage ?? 0;
    return {
      topic: stat.topic,
      current: stat.count,
      previous: before?.count ?? 0,
      currentShare: stat.percentage,
      deltaPoints: comparable ? Math.round((stat.percentage - previousShare) * 10) / 10 : null,
    };
  });

  return { movers, denominator: now.denominator, previousDenominator: then.denominator };
}

export type TopTopic = {
  /** More than one when topics tie for the most mentions. */
  topics: Topic[];
  count: number;
  denominator: number;
  percentage: number;
};

/**
 * The topic mentioned most, for a headline like "38% of this week's written
 * complaints mentioned cleanliness". Null when nothing was mentioned or the
 * denominator is under the low-data threshold: with two complaints, "50%"
 * would be one review dressed up as a trend.
 */
export function topTopic(breakdown: TopicBreakdown): TopTopic | null {
  const [first] = breakdown.stats;
  if (!first || breakdown.denominator < LOW_DATA_THRESHOLD) return null;
  return {
    topics: breakdown.stats.filter((s) => s.count === first.count).map((s) => s.topic),
    count: first.count,
    denominator: breakdown.denominator,
    percentage: first.percentage,
  };
}
