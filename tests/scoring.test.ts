import { describe, expect, it } from 'vitest';
import { averageScore, band, countBands, LOW_DATA_THRESHOLD } from '../src/insights/scoring';

describe('band', () => {
  it('classifies at the documented thresholds', () => {
    expect(band(10)).toBe('positive');
    expect(band(8)).toBe('positive');      // boundary: 8 is positive
    expect(band(7.9)).toBe('neutral');
    expect(band(6)).toBe('neutral');       // boundary: 6 is neutral
    expect(band(5.9)).toBe('negative');
    expect(band(1)).toBe('negative');
  });

  it('returns null for a missing score rather than treating it as zero', () => {
    expect(band(null)).toBeNull();
    expect(band(undefined)).toBeNull();
  });
});

describe('countBands', () => {
  it('counts unscored reviews separately', () => {
    expect(countBands([10, 8, 7, 5, null, null])).toEqual({
      positive: 2, neutral: 1, negative: 1, unscored: 2,
    });
  });
});

describe('averageScore', () => {
  it('ignores unscored reviews instead of counting them as zero', () => {
    // Would be 4 if nulls counted as 0. Must be 8.
    expect(averageScore([8, 8, null, null])).toBe(8);
  });

  it('returns null when nothing is scored', () => {
    expect(averageScore([null, null])).toBeNull();
    expect(averageScore([])).toBeNull();
  });

  it('rounds to two decimals', () => {
    expect(averageScore([8, 7, 9, 6])).toBe(7.5);
    expect(averageScore([1, 2, 2])).toBe(1.67);
  });
});

describe('low-data threshold', () => {
  it('is documented and small', () => {
    expect(LOW_DATA_THRESHOLD).toBe(3);
  });
});
