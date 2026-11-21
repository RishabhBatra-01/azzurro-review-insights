/**
 * Which slice of data the Overview shows: one property or all of them, and
 * which week counts as "this week". Both come from the URL, so anything that
 * is not a real property or a real, available week falls back to the default
 * view instead of reaching a query.
 */
import {
  addDays,
  currentWeek,
  isIsoDate,
  weekContaining,
  type DateRange,
} from "../insights/weeks";

/** How far back the week picker goes. Booking.com lists about three years. */
export const SELECTABLE_WEEKS = 157;

export type OverviewView = {
  /** Null means all properties. */
  propertyId: number | null;
  week: DateRange;
  isCurrentWeek: boolean;
};

export function resolveView(
  params: { property?: string; week?: string },
  propertyIds: readonly number[],
  now: Date = new Date(),
): OverviewView {
  const thisWeek = currentWeek(now);

  const id = Number(params.property);
  const propertyId =
    params.property && Number.isInteger(id) && propertyIds.includes(id)
      ? id
      : null;

  const oldest = addDays(thisWeek.start, -7 * (SELECTABLE_WEEKS - 1));
  let week = thisWeek;
  if (isIsoDate(params.week)) {
    // Any day picks the Mon–Sun week it falls in; the future and anything
    // older than the picker offers fall back to the current week.
    const picked = weekContaining(params.week);
    if (picked.start <= thisWeek.start && picked.start >= oldest) week = picked;
  }

  return { propertyId, week, isCurrentWeek: week.start === thisWeek.start };
}

/** The weeks the picker offers, newest first. */
export function selectableWeeks(now: Date = new Date()): DateRange[] {
  const thisWeek = currentWeek(now);
  return Array.from({ length: SELECTABLE_WEEKS }, (_, i) => {
    const start = addDays(thisWeek.start, -7 * i);
    return { start, end: addDays(start, 6) };
  });
}
