import type { PropertyCoverage } from "../db/queries";

const monthYear = (isoDate: string) =>
  new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-AU", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * "We hold X of Booking.com's Y" per property. Our totals are deliberately
 * smaller than Booking.com's — the collector keeps the most recent reviews —
 * and without saying so, the gap reads as missing data.
 */
export function CoverageStrip({
  coverage,
  windowStart,
  windowWeeks,
}: {
  coverage: PropertyCoverage[];
  /** First day (YYYY-MM-DD) of the overview's trend window. */
  windowStart: string;
  windowWeeks: number;
}) {
  const held = coverage.reduce((n, c) => n + c.held, 0);
  const allListed = coverage.every((c) => c.listed !== null);
  const listed = coverage.reduce((n, c) => n + (c.listed ?? 0), 0);
  // Checked, not assumed: true only if every property's history reaches back
  // past the window, or we hold everything Booking.com lists for it.
  const windowCovered = coverage.every(
    (c) =>
      (c.listed !== null && c.held >= c.listed) ||
      (c.oldest !== null && c.oldest <= windowStart),
  );

  return (
    <div className="mt-5">
      <p className="max-w-3xl text-sm text-[var(--text-secondary)]">
        We hold{" "}
        <strong className="text-[var(--text)]">{held.toLocaleString()}</strong>
        {allListed ? (
          <>
            {" "}
            of the{" "}
            <strong className="text-[var(--text)]">
              {listed.toLocaleString()}
            </strong>{" "}
            reviews Booking.com lists
          </>
        ) : (
          " reviews"
        )}
        : the most recent for each property, not its full history.{" "}
        {windowCovered
          ? `The overview uses the last ${windowWeeks} weeks, and every property is held in full for that period.`
          : `Some properties are not held in full for the overview’s ${windowWeeks}-week window, so treat their trends with care.`}
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {coverage.map((c) => (
          <li
            key={c.propertyId}
            className="glass px-3 py-1.5 text-xs"
            style={{ borderRadius: 999 }}
          >
            <span className="font-semibold text-[var(--text)]">{c.label}</span>
            <span className="text-[var(--muted)]">
              {" · "}
              {c.held.toLocaleString()}
              {c.listed !== null
                ? c.held >= c.listed
                  ? " (all)"
                  : ` of ${c.listed.toLocaleString()}`
                : ""}
              {c.oldest && (c.listed === null || c.held < c.listed)
                ? ` · since ${monthYear(c.oldest)}`
                : ""}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
