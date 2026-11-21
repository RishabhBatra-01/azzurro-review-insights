import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifyReview, classifyText, isClassifiable, isEnglish } from '../src/insights/topics';
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

  it('reads the English review Booking.com labelled "xu"', () => {
    // A real review: "great location | had a little problem with the robo
    // check in". Before the language fix it was skipped as foreign.
    const xu = valid.find((r) => r.lang === 'xu');
    expect(xu).toBeDefined();
    const pairs = classifyReview(xu!).map((t) => `${t.topic}:${t.polarity}`);
    expect(pairs).toContain('location:positive');
    expect(pairs).toContain('check_in:negative');
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

describe('reviews Booking.com labels "xu" (language not identified)', () => {
  it('reads them when the text is English', () => {
    const review = { positive_text: 'great location', negative_text: 'the room was dirty', lang: 'xu' };
    expect(isEnglish(review)).toBe(true);
    expect(isClassifiable(review)).toBe(true);
    expect(classifyReview(review).map((t) => `${t.topic}:${t.polarity}`)).toContain('cleanliness:negative');
  });

  it('still excludes them when the text is another language or script', () => {
    expect(isEnglish({ positive_text: '早餐', lang: 'xu' })).toBe(false);
    expect(isEnglish({ negative_text: 'la habitación estaba muy sucia y no es limpia', lang: 'xu' })).toBe(false);
    expect(isEnglish({ negative_text: '-', lang: 'xu' })).toBe(false);
  });

  it('trusts "en" and keeps every other language code out', () => {
    expect(isEnglish({ negative_text: 'dirty', lang: 'en' })).toBe(true);
    expect(isEnglish({ negative_text: 'the room was dirty', lang: 'xt' })).toBe(false);
    expect(isEnglish({ negative_text: 'the room was dirty', lang: 'fr' })).toBe(false);
  });
});

describe('hair dryer', () => {
  it('is a facility, not a cleanliness complaint', () => {
    for (const text of ['No hair dryer was provided', 'no hairdryer', 'the hair-dryers were broken']) {
      expect(topicsOf(text)).not.toContain('cleanliness');
      expect(topicsOf(text)).toContain('facilities');
    }
  });

  it('leaves real hair complaints as cleanliness', () => {
    expect(topicsOf('There was hair in the shower')).toContain('cleanliness');
  });
});
