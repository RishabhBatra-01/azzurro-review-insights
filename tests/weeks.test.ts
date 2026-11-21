import { describe, expect, it } from 'vitest';
import { addDays, currentWeek, previousWeek, recentWeeks, startOfWeek, todayInSydney, weekContaining, isWithin, isIsoDate } from '../src/insights/weeks';

describe('todayInSydney', () => {
  it('uses Sydney time, not UTC', () => {
    // 2026-11-20 14:00 UTC is already 2026-11-21 01:00 in Sydney (AEDT, UTC+11).
    expect(todayInSydney(new Date('2026-11-20T14:00:00Z'))).toBe('2026-11-21');
  });

  it('still reports the earlier day before the Sydney rollover', () => {
    expect(todayInSydney(new Date('2026-11-20T12:59:00Z'))).toBe('2026-11-20');
  });
});

describe('startOfWeek — weeks run Monday to Sunday', () => {
  it('returns the same day for a Monday', () => {
    expect(startOfWeek('2026-11-16')).toBe('2026-11-16'); // a Monday
  });

  it('returns the previous Monday for a Sunday', () => {
    expect(startOfWeek('2026-11-22')).toBe('2026-11-16'); // Sunday -> Monday before
  });

  it('handles mid-week', () => {
    expect(startOfWeek('2026-11-19')).toBe('2026-11-16');
  });

  it('crosses a month boundary', () => {
    expect(startOfWeek('2026-12-02')).toBe('2026-11-30');
  });

  it('crosses a year boundary', () => {
    expect(startOfWeek('2027-01-01')).toBe('2026-12-28');
  });
});

describe('DST — Sydney shifts clocks, weeks stay 7 days', () => {
  // DST ends 5 Apr 2026, starts 4 Oct 2026.
  it('week spanning the April change is 7 days', () => {
    const w = weekContaining('2026-04-05');
    expect(w.start).toBe('2026-03-30');
    expect(w.end).toBe('2026-04-05');
    expect(addDays(w.start, 6)).toBe(w.end);
  });

  it('week spanning the October change is 7 days', () => {
    const w = weekContaining('2026-10-04');
    expect(w.start).toBe('2026-09-28');
    expect(addDays(w.start, 6)).toBe(w.end);
  });
});

describe('current and previous week', () => {
  const now = new Date('2026-11-21T03:00:00Z'); // Sat 21 Nov in Sydney

  it('current week brackets today', () => {
    expect(currentWeek(now)).toEqual({ start: '2026-11-16', end: '2026-11-22' });
  });

  it('previous week sits immediately before, with no gap or overlap', () => {
    const prev = previousWeek(now);
    expect(prev).toEqual({ start: '2026-11-09', end: '2026-11-15' });
    expect(addDays(prev.end, 1)).toBe(currentWeek(now).start);
  });
});

describe('recentWeeks', () => {
  const now = new Date('2026-11-21T03:00:00Z');

  it('returns the requested count, oldest first, ending with this week', () => {
    const weeks = recentWeeks(12, now);
    expect(weeks).toHaveLength(12);
    expect(weeks.at(-1)).toEqual(currentWeek(now));
    expect(weeks[0]!.start < weeks[1]!.start).toBe(true);
  });

  it('weeks are contiguous', () => {
    const weeks = recentWeeks(5, now);
    for (let i = 1; i < weeks.length; i += 1) {
      expect(addDays(weeks[i - 1]!.end, 1)).toBe(weeks[i]!.start);
    }
  });
});

describe('isWithin', () => {
  const week = { start: '2026-11-16', end: '2026-11-22' };

  it('includes both boundary days', () => {
    expect(isWithin('2026-11-16', week)).toBe(true);
    expect(isWithin('2026-11-22', week)).toBe(true);
  });

  it('excludes the days either side', () => {
    expect(isWithin('2026-11-15', week)).toBe(false);
    expect(isWithin('2026-11-23', week)).toBe(false);
  });
});

describe('isIsoDate', () => {
  it('accepts a real calendar date', () => {
    expect(isIsoDate('2026-11-21')).toBe(true);
    expect(isIsoDate('2024-02-29')).toBe(true); // leap day
  });

  it('rejects text, impossible dates and the wrong shape', () => {
    for (const bad of ['abc', '2026-13-45', '2026-02-30', '2025-02-29', '21-11-2026', '2026-1-5', '', null, undefined]) {
      expect(isIsoDate(bad)).toBe(false);
    }
  });
});

import { formatWeek } from '../src/lib/format';

describe('formatWeek', () => {
  it('leaves the year off for the current year', () => {
    expect(formatWeek({ start: '2026-11-16', end: '2026-11-22' }, '2026')).toBe('16 Nov – 22 Nov');
  });

  it('adds the year for any other year', () => {
    expect(formatWeek({ start: '2025-06-02', end: '2025-06-08' }, '2026')).toBe('2 June – 8 June 2025');
  });

  it('names both years for a week crossing New Year', () => {
    expect(formatWeek({ start: '2024-12-30', end: '2025-01-05' }, '2026')).toBe('30 Dec 2024 – 5 Jan 2025');
  });
});
