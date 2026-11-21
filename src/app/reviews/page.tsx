import Link from "next/link";
import "server-only";
import {
  allProperties,
  reviewCoverage,
  searchReviews,
  type FeedReview,
} from "../../db/queries";
import { PageHero } from "../../components/hero";
import { CoverageStrip } from "../../components/coverage";
import { recentWeeks } from "../../insights/weeks";
import { TREND_WEEKS } from "../data";
import { SpotlightField } from "../../components/motion";
import { Card, Note, Pill } from "../../components/ui";
import { band } from "../../insights/scoring";
import { formatDateLong } from "../../lib/format";
import { TOPICS, TOPIC_LABELS } from "../../insights/topics";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined): string | undefined =>
  (Array.isArray(v) ? v[0] : v) || undefined;

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  const propertyParam = one(params.property);
  const band = one(params.band) as
    "positive" | "neutral" | "negative" | undefined;
  const topic = one(params.topic);
  const polarity = one(params.polarity) as "positive" | "negative" | undefined;
  const from = one(params.from);
  const to = one(params.to);
  const search = one(params.q);
  const page = Math.max(1, Number(one(params.page) ?? 1) || 1);

  const propertyId = propertyParam ? Number(propertyParam) : undefined;

  // The feed and the property/coverage data are independent, so they load in
  // parallel; coverage reuses the property list instead of fetching it again.
  const [[properties, coverage], { reviews, total }] = await Promise.all([
    allProperties().then(
      async (props) => [props, await reviewCoverage(props)] as const,
    ),
    searchReviews({
      propertyId: Number.isFinite(propertyId) ? propertyId : undefined,
      band,
      topic,
      polarity,
      from,
      to,
      search,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
  ]);

  const names = new Map(properties.map((p) => [p.id, p.assessment_label]));
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(
    propertyParam || band || topic || from || to || search,
  );

  return (
    <SpotlightField>
      <div className="space-y-6">
        <PageHero
          eyebrow="Guest feedback"
          title="Reviews"
          subtitle="Every collected review, newest first. Narrow it by property, dates, rating band or operational topic."
          aside={
            <div
              className="glass flex items-baseline gap-2 px-4 py-2.5"
              style={{ borderRadius: 999 }}
            >
              <span className="numeral text-xl leading-none">
                {total.toLocaleString()}
              </span>
              <span className="text-xs text-[var(--muted)]">
                matching review{total === 1 ? "" : "s"}
              </span>
            </div>
          }
        >
          <CoverageStrip
            coverage={coverage}
            windowStart={recentWeeks(TREND_WEEKS)[0]?.start ?? ""}
            windowWeeks={TREND_WEEKS}
          />
        </PageHero>

        {/* What is currently filtered, stated plainly. Arriving here from a topic
          on the Overview otherwise shows a filtered list with no visible reason
          for it — the only clue was a <select> further down the page. */}
        {hasFilters ? (
          <ActiveFilters
            params={params}
            chips={[
              propertyParam
                ? {
                    keys: ["property"],
                    label: "Property",
                    value: names.get(Number(propertyParam)) ?? propertyParam,
                  }
                : null,
              band
                ? {
                    keys: ["band"],
                    label: "Rating",
                    value: BAND_FILTER_LABEL[band] ?? band,
                  }
                : null,
              topic
                ? {
                    keys: ["topic", "polarity"],
                    label:
                      polarity === "positive"
                        ? "Praised"
                        : polarity === "negative"
                          ? "Complained about"
                          : "Topic",
                    value:
                      TOPIC_LABELS[topic as keyof typeof TOPIC_LABELS] ?? topic,
                  }
                : null,
              from
                ? { keys: ["from"], label: "From", value: formatDateLong(from) }
                : null,
              to
                ? { keys: ["to"], label: "To", value: formatDateLong(to) }
                : null,
              search
                ? { keys: ["q"], label: "Text", value: `“${search}”` }
                : null,
            ]}
          />
        ) : null}

        {/* Plain GET form: filters are in the URL, so they can be shared and
          bookmarked, and the page works without client-side JavaScript. */}
        <Card className="spotlight">
          <form
            method="get"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
          >
            <Field label="Property" id="property">
              <Select
                id="property"
                name="property"
                defaultValue={propertyParam ?? ""}
              >
                <option value="">All properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.assessment_label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Rating" id="band">
              <Select id="band" name="band" defaultValue={band ?? ""}>
                <option value="">Any rating</option>
                <option value="positive">Positive (8+)</option>
                <option value="neutral">Neutral (6–7.9)</option>
                <option value="negative">Negative (under 6)</option>
              </Select>
            </Field>

            <Field label="Topic" id="topic">
              <Select id="topic" name="topic" defaultValue={topic ?? ""}>
                <option value="">Any topic</option>
                {TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {TOPIC_LABELS[t]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="From" id="from">
              <Input
                id="from"
                name="from"
                type="date"
                defaultValue={from ?? ""}
              />
            </Field>

            <Field label="To" id="to">
              <Input id="to" name="to" type="date" defaultValue={to ?? ""} />
            </Field>

            <Field label="Search text" id="q">
              <Input
                id="q"
                name="q"
                type="search"
                placeholder="e.g. shower"
                defaultValue={search ?? ""}
              />
            </Field>

            {polarity ? (
              <input type="hidden" name="polarity" value={polarity} />
            ) : null}

            <div className="flex items-end gap-2 border-t border-[var(--border)] pt-3 sm:col-span-2 lg:col-span-6">
              <button
                type="submit"
                className="btn btn-primary rounded-full bg-[var(--accent)] px-5 py-2 text-sm font-semibold text-white"
              >
                Apply filters
              </button>
              {hasFilters ? (
                <Link
                  href="/reviews"
                  className="btn btn-secondary rounded-full border border-[var(--border)] px-5 py-2 text-sm font-medium text-[var(--text-secondary)]"
                >
                  Clear
                </Link>
              ) : null}
            </div>
          </form>
        </Card>

        {reviews.length === 0 ? (
          <Card className="spotlight">
            <p className="py-6 text-center text-sm text-[var(--muted)]">
              {hasFilters
                ? "No reviews match these filters. Try widening the date range or clearing the topic."
                : "No reviews stored yet. Run the collector with npm run collect."}
            </p>
          </Card>
        ) : (
          <ul className="space-y-3">
            {reviews.map((review) => (
              <li key={review.id}>
                <ReviewCard
                  review={review}
                  propertyName={names.get(review.property_id) ?? "—"}
                />
              </li>
            ))}
          </ul>
        )}

        {lastPage > 1 ? (
          <nav
            className="flex items-center justify-between"
            aria-label="Pagination"
          >
            <PageLink
              params={params}
              page={page - 1}
              disabled={page <= 1}
              direction="prev"
            >
              Previous
            </PageLink>
            <span className="text-sm text-[var(--muted)]">
              Page {page} of {lastPage}
            </span>
            <PageLink
              params={params}
              page={page + 1}
              disabled={page >= lastPage}
              direction="next"
            >
              Next
            </PageLink>
          </nav>
        ) : null}
      </div>
    </SpotlightField>
  );
}

const BAND_FILTER_LABEL: Record<string, string> = {
  positive: "Positive (8+)",
  neutral: "Neutral (6–7.9)",
  negative: "Negative (under 6)",
};

type Chip = { keys: string[]; label: string; value: string } | null;

/** Applied filters, each removable on its own without clearing the rest. */
function ActiveFilters({
  params,
  chips,
}: {
  params: SearchParams;
  chips: Chip[];
}) {
  const live = chips.filter((c): c is NonNullable<Chip> => c !== null);
  if (live.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-[var(--muted)]">Filtered by</span>
      {live.map((chip) => (
        <Link
          key={chip.keys.join("-")}
          href={urlWithout(params, chip.keys)}
          className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] py-1 pl-2.5 pr-2 text-xs transition-colors hover:border-[var(--border-strong)]"
        >
          <span className="text-[var(--muted)]">{chip.label}</span>
          <span className="font-medium text-[var(--text)]">{chip.value}</span>
          <span
            aria-hidden="true"
            className="grid h-4 w-4 place-items-center rounded-full bg-[var(--surface-sunken)] text-[var(--muted)] group-hover:bg-[var(--accent-soft)] group-hover:text-[var(--text)]"
          >
            ×
          </span>
          <span className="sr-only">(remove this filter)</span>
        </Link>
      ))}
      <Link
        href="/reviews"
        className="link-draw text-xs font-medium text-[var(--accent)]"
      >
        Clear all
      </Link>
    </div>
  );
}

/** The current query string minus the given keys, and minus paging. */
function urlWithout(params: SearchParams, keys: string[]): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = one(value);
    // Dropping a filter changes the result set, so page 1 is the only sane page.
    if (v && key !== "page" && !keys.includes(key)) next.set(key, v);
  }
  const qs = next.toString();
  return qs ? `/reviews?${qs}` : "/reviews";
}

const BAND_LABEL = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
} as const;

function ReviewCard({
  review,
  propertyName,
}: {
  review: FeedReview;
  propertyName: string;
}) {
  const score = review.review_score;
  // Thresholds live in scoring.ts and are unit-tested; this reuses them rather
  // than restating 8.0 / 6.0 in the UI where they could drift.
  const tone = band(score);

  return (
    <Card className="spotlight">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {/* Most reviews have no title. Rather than print a filler word, the
              property name becomes the heading and stands on its own. */}
          <p className="text-sm font-semibold leading-snug">
            {review.title ?? propertyName}
            {review.title ? (
              <span className="font-normal text-[var(--muted)]">
                {" "}
                · {propertyName}
              </span>
            ) : null}
          </p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {[
              review.reviewer_name,
              review.reviewer_country,
              review.guest_type,
              review.room_type,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {/* The number stays in primary ink; a swatch beside it carries the band,
            so the value is never encoded by colour alone. */}
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="numeral text-2xl leading-none">
              {score === null ? "—" : score.toFixed(1)}
              {score === null ? null : (
                <span className="ml-0.5 text-[11px] text-[var(--muted)]">
                  /10
                </span>
              )}
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {formatDateLong(review.reviewed_on_sydney)}
            </p>
          </div>
          {tone ? (
            <Pill tone={tone}>{BAND_LABEL[tone]}</Pill>
          ) : (
            <Pill>No score</Pill>
          )}
        </div>
      </div>

      {review.positive_text || review.negative_text ? (
        <div className="mt-4 space-y-2.5 border-t border-[var(--border)] pt-3.5">
          {review.positive_text ? (
            <Quote tone="positive" label="Liked" text={review.positive_text} />
          ) : null}
          {review.negative_text ? (
            <Quote
              tone="negative"
              label="Disliked"
              text={review.negative_text}
            />
          ) : null}
        </div>
      ) : (
        <div className="mt-3">
          <Note>Rating only — this guest left no written feedback.</Note>
        </div>
      )}

      {review.lang && review.lang !== "en" ? (
        <p className="mt-3 text-xs text-[var(--muted)]">
          Written in another language ({review.lang}) — excluded from topic
          analysis.
        </p>
      ) : null}

      {review.partner_reply ? (
        <div className="mt-3 rounded-lg border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] p-3">
          <p className="eyebrow">Property replied</p>
          <p className="mt-1.5 text-sm leading-relaxed">
            {review.partner_reply}
          </p>
        </div>
      ) : null}
    </Card>
  );
}

/** A quoted half of a review. The label wears ink; the swatch wears the colour. */
function Quote({
  tone,
  label,
  text,
}: {
  tone: "positive" | "negative";
  label: string;
  text: string;
}) {
  return (
    <div className="flex gap-2.5">
      <span
        aria-hidden="true"
        className="mt-1.5 h-2 w-2 shrink-0 rounded-sm"
        style={{ background: `var(--series-${tone})` }}
      />
      <p className="text-sm leading-relaxed">
        <span className="font-semibold text-[var(--text)]">{label}</span>
        <span className="text-[var(--muted)]"> · </span>
        <span className="text-[var(--text-secondary)]">{text}</span>
      </p>
    </div>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-[var(--muted)]">
        {label}
      </label>
      {children}
    </div>
  );
}

const CONTROL =
  "field-control w-full rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] px-3 py-2 text-sm text-[var(--text)]";

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={CONTROL} />;
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={CONTROL} />;
}

function PageLink({
  params,
  page,
  disabled,
  direction,
  children,
}: {
  params: SearchParams;
  page: number;
  disabled: boolean;
  direction: "prev" | "next";
  children: React.ReactNode;
}) {
  const arrow = (
    <span aria-hidden="true" className="m-arrow">
      {direction === "prev" ? "\u2190" : "\u2192"}
    </span>
  );

  // Disabled stays in the flow so the row does not reflow at the first and
  // last page, but it is not a link and does not respond to the pointer.
  if (disabled) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)]">
        {direction === "prev" ? arrow : null}
        {children}
        {direction === "next" ? arrow : null}
      </span>
    );
  }

  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const v = one(value);
    if (v && key !== "page") next.set(key, v);
  }
  next.set("page", String(page));

  return (
    <Link
      href={`/reviews?${next.toString()}`}
      className={`inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] ${
        direction === "prev" ? "m-arrow-prev" : "m-arrow-next"
      }`}
    >
      {direction === "prev" ? arrow : null}
      {children}
      {direction === "next" ? arrow : null}
    </Link>
  );
}
