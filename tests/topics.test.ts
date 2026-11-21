import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyReview, classifyText, isClassifiable } from '../src/insights/topics';
import { normalizeBatch } from '../src/collector/normalize';

const fixture = JSON.parse(
  readFileSync(new URL('../data/fixtures/review-list-page1.json', import.meta.url), 'utf8'),
);

const topicsOf = (text: string) => classifyText(text).map((m) => m.topic).sort();

describe('classifyText', () => {
  it('finds the obvious topics', () => {
    expect(topicsOf('The room was very dirty')).toContain('cleanliness');
    expect(topicsOf('Reception staff were rude')).toContain('staff');
    expect(topicsOf('Very noisy at night')).toContain('noise');
    expect(topicsOf('Great location near the station')).toContain('location');
  });

  it('matches whole words only', () => {
    // "bar" must not fire on "barely".
    expect(topicsOf('I barely slept')).not.toContain('facilities');
    expect(topicsOf('There is a bar downstairs')).toContain('facilities');
  });

  it('does not treat the bare word "room" as a condition complaint', () => {
    // "room" appears in most reviews; including it would make the topic useless.
    expect(topicsOf('The room was fine')).not.toContain('room_condition');
    expect(topicsOf('The mattress was worn')).toContain('room_condition');
  });

  it('reports the longest matching phrase as the term', () => {
    const match = classifyText('Great value for money').find((m) => m.topic === 'value');
    expect(match?.term).toBe('value for money');
  });

  it('returns nothing for empty input', () => {
    expect(classifyText(null)).toEqual([]);
    expect(classifyText('')).toEqual([]);
  });
});

describe('classifyReview — mixed feedback', () => {
  it('splits praise and complaint onto the right polarity', () => {
    const result = classifyReview({
      positive_text: 'Great location, close to the station',
      negative_text: 'Very noisy and the bathroom was dirty',
      lang: 'en',
    });
    const pairs = result.map((r) => `${r.topic}:${r.polarity}`);
    expect(pairs).toContain('location:positive');
    expect(pairs).toContain('noise:negative');
    expect(pairs).toContain('cleanliness:negative');
    expect(pairs).not.toContain('noise:positive');
  });

  it('keeps the term that triggered each tag, for explainability', () => {
    const [match] = classifyReview({ negative_text: 'it was filthy', lang: 'en' });
    expect(match?.matchedTerm).toBe('filthy');
  });

  it('skips non-English reviews rather than scoring them as "no issues"', () => {
    expect(classifyReview({ negative_text: 'sehr schmutzig', lang: 'de' })).toEqual([]);
    expect(isClassifiable({ negative_text: 'sehr schmutzig', lang: 'de' })).toBe(false);
  });

  it('treats a review with no text as unclassifiable', () => {
    expect(isClassifiable({ positive_text: null, negative_text: null, lang: 'en' })).toBe(false);
  });
});

describe('against real collected reviews', () => {
  const { valid } = normalizeBatch(fixture.reviewCard);

  it('classifies a meaningful share of English reviews with text', () => {
    const classifiable = valid.filter(isClassifiable);
    const tagged = classifiable.filter((r) => classifyReview(r).length > 0);
    // Not asserting perfection — just that the lexicon is not inert on real data.
    expect(classifiable.length).toBeGreaterThan(0);
    expect(tagged.length / classifiable.length).toBeGreaterThan(0.5);
  });

  it('excludes the non-English reviews present in the sample', () => {
    const nonEnglish = valid.filter((r) => r.lang && r.lang !== 'en');
    expect(nonEnglish.length).toBeGreaterThan(0); // fixture genuinely contains some
    for (const r of nonEnglish) expect(classifyReview(r)).toEqual([]);
  });
});

describe('lexicon precision fixes found by evaluating real data', () => {
  it('does not read "dining area" or "communal area" as location', () => {
    // 25 of 189 location tags came from bare "area"; most were facilities.
    expect(topicsOf('Limited space in dining area during dinner time')).not.toContain('location');
    expect(topicsOf('Good sized communal area')).not.toContain('location');
    expect(topicsOf('Beds, bathrooms, showers, dining area')).not.toContain('location');
  });

  it('still recognises location when it is unambiguous', () => {
    expect(topicsOf('Great location near the station')).toContain('location');
    expect(topicsOf('The local area is lovely')).toContain('location');
    expect(topicsOf('Close to everything')).toContain('location');
  });
});
