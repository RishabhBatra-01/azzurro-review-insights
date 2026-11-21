import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeEntities, dedupeByExternalId, normalizeBatch, normalizeReview } from '../src/collector/normalize';

const fixture = JSON.parse(
  readFileSync(new URL('../data/fixtures/review-list-page1.json', import.meta.url), 'utf8'),
);
const cards: unknown[] = fixture.reviewCard;

describe('decodeEntities', () => {
  it('decodes the entities booking.com actually returns', () => {
    expect(decodeEntities('We&#39;re glad')).toBe("We're glad");
    expect(decodeEntities('Bed &amp; breakfast')).toBe('Bed & breakfast');
    expect(decodeEntities('&quot;great&quot;')).toBe('"great"');
  });

  it('does not double-decode an escaped ampersand', () => {
    // &amp;#39; must become &#39; — not an apostrophe.
    expect(decodeEntities('&amp;#39;')).toBe('&#39;');
  });
});

describe('normalizeReview — real captured data', () => {
  it('normalizes every review in the fixture', () => {
    const { valid, rejected } = normalizeBatch(cards);
    expect(rejected).toEqual([]);
    expect(valid).toHaveLength(10);
  });

  it('keeps external ids unique, so dedup has something to key on', () => {
    const { valid } = normalizeBatch(cards);
    expect(new Set(valid.map((r) => r.external_id)).size).toBe(valid.length);
  });

  it('converts the unix timestamp to an ISO instant', () => {
    const [first] = normalizeBatch(cards).valid;
    expect(first!.reviewed_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Number.isNaN(Date.parse(first!.reviewed_at))).toBe(false);
  });

  it('treats blank text as null rather than empty string', () => {
    const { valid } = normalizeBatch(cards);
    for (const r of valid) {
      expect(r.positive_text).not.toBe('');
      expect(r.negative_text).not.toBe('');
    }
    // The fixture genuinely contains reviews with only one side filled in.
    expect(valid.some((r) => r.positive_text === null)).toBe(true);
    expect(valid.some((r) => r.negative_text === null)).toBe(true);
  });
});

describe('normalizeReview — rejects bad input', () => {
  const good = cards[0] as Record<string, unknown>;

  it('rejects a review with no stable id', () => {
    expect(() => normalizeReview({ ...good, reviewUrl: '' })).toThrow();
  });

  it('rejects an out-of-range score instead of storing it', () => {
    // Guards against a silent scale change (e.g. /10 becoming /5 or /100).
    expect(() => normalizeReview({ ...good, reviewScore: 55 })).toThrow();
  });

  it('rejects a malformed stay date', () => {
    const bad = { ...good, bookingDetails: { ...(good.bookingDetails as object), checkinDate: '23/10/2026' } };
    expect(() => normalizeReview(bad)).toThrow();
  });

  it('allows a missing score, because score-less reviews are real', () => {
    expect(normalizeReview({ ...good, reviewScore: null }).review_score).toBeNull();
  });

  it('reports rejects without losing the valid rows alongside them', () => {
    const { valid, rejected } = normalizeBatch([good, { ...good, reviewUrl: '' }]);
    expect(valid).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]!.reason).toContain('reviewUrl');
  });
});

describe('dedupeByExternalId', () => {
  it('drops a review repeated within one batch, keeping the first copy', () => {
    const [a, b] = cards.slice(0, 2).map(normalizeReview);
    const repeat = { ...a!, positive_text: 'second copy' };
    const result = dedupeByExternalId([a!, b!, repeat]);
    expect(result.map((r) => r.external_id)).toEqual([a!.external_id, b!.external_id]);
    expect(result[0]!.positive_text).toBe(a!.positive_text);
  });

  it('leaves a batch with no repeats unchanged', () => {
    const batch = cards.slice(0, 5).map(normalizeReview);
    expect(dedupeByExternalId(batch)).toEqual(batch);
  });
});
