import { describe, expect, it } from 'vitest';
import {
  compare, compareByProperty, summarize, topicBreakdown, topicMovement, topicSentiment,
  topTopic, trend, type ReviewRow, type TopicBreakdown,
} from '../src/insights/metrics';
import type { Topic } from '../src/insights/topics';
import { recentWeeks } from '../src/insights/weeks';

const WEEK = { start: '2026-11-16', end: '2026-11-22' };
const PREV = { start: '2026-11-09', end: '2026-11-15' };

const review = (over: Partial<ReviewRow> = {}): ReviewRow => ({
  property_id: 1,
  review_score: 8,
  reviewed_on_sydney: '2026-11-18',
  lang: 'en',
  positive_text: null,
  negative_text: null,
  ...over,
});

describe('summarize', () => {
  it('only counts reviews inside the range', () => {
    const rows = [
      review({ reviewed_on_sydney: '2026-11-18' }),
      review({ reviewed_on_sydney: '2026-11-15' }), // previous week
      review({ reviewed_on_sydney: '2026-11-23' }), // next week
    ];
    expect(summarize(rows, WEEK).reviewCount).toBe(1);
  });

  it('excludes unscored reviews from the average but still counts them', () => {
    const rows = [review({ review_score: 8 }), review({ review_score: null })];
    const s = summarize(rows, WEEK);
    expect(s.reviewCount).toBe(2);
    expect(s.scoredCount).toBe(1);
    expect(s.average).toBe(8);
    expect(s.bands.unscored).toBe(1);
  });

  it('flags low data rather than showing a confident average', () => {
    expect(summarize([review()], WEEK).lowData).toBe(true);
    const three = [review(), review(), review()];
    expect(summarize(three, WEEK).lowData).toBe(false);
  });

  it('returns a null average for an empty week, not zero', () => {
    const s = summarize([], WEEK);
    expect(s.average).toBeNull();
    expect(s.reviewCount).toBe(0);
  });
});

describe('compare', () => {
  const many = (score: number, date: string) =>
    [1, 2, 3, 4].map(() => review({ review_score: score, reviewed_on_sydney: date }));

  it('reports direction and delta when both weeks have enough data', () => {
    const rows = [...many(9, '2026-11-18'), ...many(7, '2026-11-11')];
    const c = compare(summarize(rows, WEEK), summarize(rows, PREV));
    expect(c.delta).toBe(2);
    expect(c.direction).toBe('up');
  });

  it('refuses to compare when a week is too thin', () => {
    const rows = [...many(9, '2026-11-18'), review({ review_score: 7, reviewed_on_sydney: '2026-11-11' })];
    const c = compare(summarize(rows, WEEK), summarize(rows, PREV));
    expect(c.delta).toBeNull();
    expect(c.direction).toBe('unknown');
  });

  it('refuses to compare against an empty previous week', () => {
    const c = compare(summarize(many(9, '2026-11-18'), WEEK), summarize([], PREV));
    expect(c.direction).toBe('unknown');
  });
});

describe('compareByProperty', () => {
  it('keeps properties independent', () => {
    const rows = [
      ...[1, 2, 3].map(() => review({ property_id: 1, review_score: 10 })),
      ...[1, 2, 3].map(() => review({ property_id: 2, review_score: 2 })),
    ];
    const [a, b] = compareByProperty(rows, [1, 2], WEEK, PREV);
    expect(a!.current.average).toBe(10);
    expect(b!.current.average).toBe(2);
  });
});

describe('trend', () => {
  it('returns one point per week, including empty ones', () => {
    const weeks = recentWeeks(4, new Date('2026-11-21T03:00:00Z'));
    const points = trend([review()], weeks);
    expect(points).toHaveLength(4);
    expect(points.at(-1)!.reviewCount).toBe(1);
    expect(points[0]!.reviewCount).toBe(0);
    expect(points[0]!.average).toBeNull();
  });
});

describe('topicBreakdown — denominators are the point', () => {
  it('counts only reviews that could mention the topic', () => {
    const rows = [
      review({ negative_text: 'the room was dirty' }),
      review({ negative_text: 'very noisy' }),
      review({ negative_text: null, positive_text: null }), // no text: cannot mention anything
    ];
    const b = topicBreakdown(rows, WEEK, 'negative');
    expect(b.denominator).toBe(2); // not 3
    expect(b.excluded).toBe(1);
    expect(b.stats.find((s) => s.topic === 'cleanliness')?.percentage).toBe(50);
  });

  it('excludes non-English reviews from the denominator', () => {
    const rows = [
      review({ negative_text: 'dirty room', lang: 'en' }),
      review({ negative_text: 'chambre sale', lang: 'fr' }),
    ];
    const b = topicBreakdown(rows, WEEK, 'negative');
    expect(b.denominator).toBe(1);
    expect(b.excluded).toBe(1);
    // Must be 100% of the one classifiable review, not 50% of both.
    expect(b.stats.find((s) => s.topic === 'cleanliness')?.percentage).toBe(100);
  });

  it('keeps positive and negative mentions apart', () => {
    const rows = [review({ positive_text: 'great location', negative_text: 'very noisy' })];
    expect(topicBreakdown(rows, WEEK, 'positive').stats.map((s) => s.topic)).toContain('location');
    expect(topicBreakdown(rows, WEEK, 'negative').stats.map((s) => s.topic)).toContain('noise');
    expect(topicBreakdown(rows, WEEK, 'negative').stats.map((s) => s.topic)).not.toContain('location');
  });

  it('does not divide by zero on an empty week', () => {
    const b = topicBreakdown([], WEEK, 'negative');
    expect(b.denominator).toBe(0);
    expect(b.stats).toEqual([]);
  });
});

describe('topicSentiment', () => {
  it('splits a topic into praise and complaint and reports the share', () => {
    const rows = [
      review({ positive_text: 'spotlessly clean room' }),
      review({ positive_text: 'very clean' }),
      review({ negative_text: 'the bathroom was dirty' }),
    ];
    const cleanliness = topicSentiment(rows, WEEK).stats.find((s) => s.topic === 'cleanliness');
    expect(cleanliness).toMatchObject({ positive: 2, negative: 1, mentions: 3 });
    expect(cleanliness?.positiveShare).toBeCloseTo(66.7, 1);
  });

  it('counts the denominator as classifiable reviews, not all reviews', () => {
    const rows = [
      review({ positive_text: 'very clean' }),
      review({ positive_text: 'très propre', lang: 'fr' }), // not English
      review({ positive_text: null, negative_text: null }), // rating only
    ];
    const result = topicSentiment(rows, WEEK);
    expect(result.denominator).toBe(1);
    expect(result.excluded).toBe(2);
  });

  it('flags a topic with too few mentions rather than implying confidence', () => {
    const rows = [review({ negative_text: 'noisy street' })];
    expect(topicSentiment(rows, WEEK).stats[0]?.lowData).toBe(true);
  });
});

describe('topicMovement', () => {
  const thisWeek = (text: string) => review({ negative_text: text, reviewed_on_sydney: '2026-11-18' });
  const lastWeek = (text: string) => review({ negative_text: text, reviewed_on_sydney: '2026-11-11' });

  it('refuses to compare when either week is too thin', () => {
    // Two complaints this week, one last week: below the low-data threshold.
    const rows = [thisWeek('dirty'), thisWeek('noisy'), lastWeek('dirty')];
    const { movers } = topicMovement(rows, WEEK, PREV, 'negative');
    expect(movers.length).toBeGreaterThan(0);
    expect(movers.every((m) => m.deltaPoints === null)).toBe(true);
  });

  it('reports the change in percentage points once both weeks have enough', () => {
    const rows = [
      thisWeek('dirty'), thisWeek('dirty room'), thisWeek('noisy'),
      lastWeek('noisy'), lastWeek('noisy street'), lastWeek('dirty'),
    ];
    const { movers, denominator, previousDenominator } = topicMovement(rows, WEEK, PREV, 'negative');
    expect(denominator).toBe(3);
    expect(previousDenominator).toBe(3);
    const cleanliness = movers.find((m) => m.topic === 'cleanliness');
    // 2 of 3 now (66.7%) against 1 of 3 before (33.3%).
    expect(cleanliness?.deltaPoints).toBeCloseTo(33.4, 0);
  });
});

describe('formatRelativeDay', () => {
  it('reads the recent past in days and falls back to a date', async () => {
    const { formatRelativeDay } = await import('../src/lib/format');
    expect(formatRelativeDay('2026-11-21', '2026-11-21')).toBe('today');
    expect(formatRelativeDay('2026-11-20', '2026-11-21')).toBe('yesterday');
    expect(formatRelativeDay('2026-11-18', '2026-11-21')).toBe('3 days ago');
    expect(formatRelativeDay('2026-10-01', '2026-11-21')).toMatch(/Oct/);
  });
});

describe('formatRelativeTime', () => {
  it('reads instants in minutes, hours, then days', async () => {
    const { formatRelativeTime } = await import('../src/lib/format');
    const now = new Date('2026-11-21T12:00:00Z');
    expect(formatRelativeTime('2026-11-21T11:59:40Z', now)).toBe('just now');
    expect(formatRelativeTime('2026-11-21T11:48:00Z', now)).toBe('12 min ago');
    expect(formatRelativeTime('2026-11-21T09:00:00Z', now)).toBe('3 h ago');
    expect(formatRelativeTime('2026-11-20T11:00:00Z', now)).toBe('1 day ago');
    expect(formatRelativeTime('not a date', now)).toBe('unknown');
  });
});

describe('summarizeRuns', () => {
  it('keeps only the latest run per property', async () => {
    const { summarizeRuns } = await import('../src/insights/collection');
    // Newest first: property 1 failed most recently, despite an older success.
    const s = summarizeRuns([
      { property_id: 1, started_at: '2026-11-21T08:00:00Z', finished_at: '2026-11-21T08:01:00Z', status: 'failed' },
      { property_id: 2, started_at: '2026-11-21T07:00:00Z', finished_at: '2026-11-21T07:02:00Z', status: 'ok' },
      { property_id: 1, started_at: '2026-11-20T08:00:00Z', finished_at: '2026-11-20T08:01:00Z', status: 'ok' },
    ]);
    expect(s).toEqual({ lastFinishedAt: '2026-11-21T08:01:00Z', ok: 1, partial: 0, failed: 1, total: 2 });
  });

  it('returns null when nothing has ever run, rather than claiming freshness', async () => {
    const { summarizeRuns } = await import('../src/insights/collection');
    expect(summarizeRuns([])).toBeNull();
  });
});

describe('topTopic', () => {
  const breakdown = (denominator: number, counts: [Topic, number][]): TopicBreakdown => ({
    polarity: 'negative',
    denominator,
    excluded: 0,
    stats: counts.map(([topic, count]) => ({
      topic,
      count,
      denominator,
      percentage: Math.round((count / denominator) * 1000) / 10,
    })),
  });

  it('names the most-mentioned topic with its share and denominator', () => {
    expect(topTopic(breakdown(8, [['cleanliness', 3], ['noise', 1]]))).toEqual({
      topics: ['cleanliness'],
      count: 3,
      denominator: 8,
      percentage: 37.5,
    });
  });

  it('names every topic tied for first', () => {
    expect(topTopic(breakdown(10, [['noise', 4], ['staff', 4], ['value', 1]]))?.topics).toEqual([
      'noise',
      'staff',
    ]);
  });

  it('says nothing when there is too little to go on', () => {
    expect(topTopic(breakdown(2, [['cleanliness', 2]]))).toBeNull();
    expect(topTopic(breakdown(9, []))).toBeNull();
  });
});
