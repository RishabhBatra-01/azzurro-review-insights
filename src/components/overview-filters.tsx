import Form from "next/form";
import Link from "next/link";

import type { DateRange } from "../insights/weeks";
import { formatWeek } from "../lib/format";

/**
 * Property and week pickers for the Overview. A GET form, so the choice lives
 * in the URL and can be bookmarked or shared; next/form makes the submit an
 * in-app navigation. The week list is generated, never typed, so it can only
 * offer weeks that exist.
 */
export function OverviewFilters({
  properties,
  weeks,
  propertyId,
  weekStart,
  isDefault,
}: {
  properties: { id: number; assessment_label: string }[];
  /** Newest first. */
  weeks: DateRange[];
  propertyId: number | null;
  weekStart: string;
  isDefault: boolean;
}) {
  // Group the long week list by year, so finding "October last year" is a
  // matter of scrolling to a heading rather than counting rows.
  const byYear = new Map<string, DateRange[]>();
  for (const w of weeks) {
    const year = w.start.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), w]);
  }

  return (
    <Form
      action="/"
      className="overview-filters mt-5 flex flex-wrap items-end gap-x-3 gap-y-2"
    >
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-[var(--muted)]">
          Property
        </span>
        <select
          name="property"
          defaultValue={propertyId ?? ""}
          className="filter-select"
        >
          <option value="">All properties</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.assessment_label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-medium text-[var(--muted)]">
          Week (Mon–Sun, Sydney)
        </span>
        <select name="week" defaultValue={weekStart} className="filter-select">
          {[...byYear].map(([year, list]) => (
            <optgroup key={year} label={year}>
              {list.map((w, i) => (
                <option key={w.start} value={w.start}>
                  {formatWeek(w, weeks[0]!.start.slice(0, 4))}
                  {year === weeks[0]!.start.slice(0, 4) && i === 0
                    ? " (this week)"
                    : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <button type="submit" className="filter-apply">
        Show
      </button>
      {isDefault ? null : (
        <Link href="/" className="link-draw pb-2 text-xs font-medium">
          Back to this week, all properties
        </Link>
      )}
    </Form>
  );
}
