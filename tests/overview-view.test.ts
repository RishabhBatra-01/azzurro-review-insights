import { describe, expect, it } from 'vitest';
import { resolveView, selectableWeeks, SELECTABLE_WEEKS } from '../src/app/overview-view';

// Saturday 21 Nov 2026, midday in Sydney.
const NOW = new Date('2026-11-21T01:00:00Z');
const IDS = [1, 2, 3, 4];

describe('resolveView', () => {
  it('defaults to all properties and the current week', () => {
    expect(resolveView({}, IDS, NOW)).toEqual({
      propertyId: null,
      week: { start: '2026-11-16', end: '2026-11-22' },
      isCurrentWeek: true,
    });
  });

  it('accepts a known property', () => {
    expect(resolveView({ property: '2' }, IDS, NOW).propertyId).toBe(2);
  });

  it('ignores an unknown, non-numeric or fractional property', () => {
    for (const property of ['9', 'abc', '1.5', '', '-1']) {
      expect(resolveView({ property }, IDS, NOW).propertyId).toBeNull();
    }
  });

  it('turns any day into its Monday-to-Sunday week', () => {
    const view = resolveView({ week: '2026-10-15' }, IDS, NOW); // a Thursday
    expect(view.week).toEqual({ start: '2026-10-12', end: '2026-10-18' });
    expect(view.isCurrentWeek).toBe(false);
  });

  it('falls back to the current week for bad, future or too-old dates', () => {
    for (const week of ['abc', '2026-13-45', '2026-12-01', '2020-01-06']) {
      expect(resolveView({ week }, IDS, NOW).isCurrentWeek).toBe(true);
    }
  });

  it('accepts the oldest week the picker offers', () => {
    const oldest = selectableWeeks(NOW).at(-1)!;
    expect(resolveView({ week: oldest.start }, IDS, NOW).week).toEqual(oldest);
  });
});

describe('selectableWeeks', () => {
  it('lists weeks newest first, starting with the current week', () => {
    const weeks = selectableWeeks(NOW);
    expect(weeks).toHaveLength(SELECTABLE_WEEKS);
    expect(weeks[0]).toEqual({ start: '2026-11-16', end: '2026-11-22' });
    expect(weeks[1]).toEqual({ start: '2026-11-09', end: '2026-11-15' });
  });
});
