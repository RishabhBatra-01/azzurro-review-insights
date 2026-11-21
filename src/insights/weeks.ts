/**
 * Week boundaries, defined once.
 *
 * A week runs Monday 00:00 to Sunday 23:59 in Australia/Sydney, because the
 * properties and the operations team are in Sydney.
 *
 * Reviews are stored with `reviewed_on_sydney`, a date generated in the
 * database from the review timestamp. So everything here is plain calendar-date
 * arithmetic on UTC-midnight Dates, which sidesteps DST entirely — the only
 * place a timezone is consulted is working out what "today" is in Sydney.
 */
export const REPORTING_TIMEZONE = 'Australia/Sydney';

export type DateRange = { start: string; end: string };

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: REPORTING_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Today's calendar date in Sydney, as YYYY-MM-DD. */
export function todayInSydney(now: Date = new Date()): string {
  return dateFormatter.format(now);
}

function toUtcMidnight(isoDate: string): Date {
  const parts = isoDate.split('-').map(Number);
  const [y, m, d] = parts;
  if (parts.length !== 3 || y === undefined || m === undefined || d === undefined) {
    throw new Error(`Invalid date: ${isoDate}`);
  }
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const date = toUtcMidnight(isoDate);
  date.setUTCDate(date.getUTCDate() + days);
  return formatDate(date);
}

/** Monday of the week containing the given date. */
export function startOfWeek(isoDate: string): string {
  const date = toUtcMidnight(isoDate);
  // getUTCDay: Sunday = 0. Shift so Monday = 0.
  const offset = (date.getUTCDay() + 6) % 7;
  return addDays(isoDate, -offset);
}

export function weekContaining(isoDate: string): DateRange {
  const start = startOfWeek(isoDate);
  return { start, end: addDays(start, 6) };
}

export function currentWeek(now: Date = new Date()): DateRange {
  return weekContaining(todayInSydney(now));
}

export function previousWeek(now: Date = new Date()): DateRange {
  const start = addDays(currentWeek(now).start, -7);
  return { start, end: addDays(start, 6) };
}

/** Most recent `count` weeks, oldest first, ending with the current week. */
export function recentWeeks(count: number, now: Date = new Date()): DateRange[] {
  return weeksEndingWith(count, currentWeek(now));
}

/** `count` weeks, oldest first, ending with the given week. */
export function weeksEndingWith(count: number, last: DateRange): DateRange[] {
  const weeks: DateRange[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = addDays(last.start, -7 * i);
    weeks.push({ start, end: addDays(start, 6) });
  }
  return weeks;
}

/** The week before the given one. */
export function weekBefore(week: DateRange): DateRange {
  const start = addDays(week.start, -7);
  return { start, end: addDays(start, 6) };
}

/**
 * True only for a real calendar date written as YYYY-MM-DD. Dates arrive from
 * URLs, so "2026-13-45" or "abc" must be caught here rather than reach the
 * database, which rejects them with an error that would take the page down.
 */
export function isIsoDate(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isWithin(isoDate: string, range: DateRange): boolean {
  return isoDate >= range.start && isoDate <= range.end;
}
