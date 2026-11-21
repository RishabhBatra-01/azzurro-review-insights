/**
 * Read queries for the dashboard. Rows come back minimal and get aggregated by
 * the pure functions in src/insights, so thresholds live in exactly one place.
 */
import { db } from "./client";
import type { ReviewRow } from "../insights/metrics";
import {
  summarizeRuns,
  type CollectionStatus,
  type RunRow,
} from "../insights/collection";

const PAGE = 1000; // PostgREST default ceiling

export type PropertyRow = {
  id: number;
  slug: string;
  display_name: string;
  assessment_label: string;
};

export async function allProperties(): Promise<PropertyRow[]> {
  const { data, error } = await db()
    .from("property")
    .select("id, slug, display_name, assessment_label")
    .order("id");
  if (error) throw new Error(`allProperties failed: ${error.message}`);
  return (data ?? []) as PropertyRow[];
}

/**
 * Reviews on or after `since` (and up to `until`, when given). Paged, because
 * PostgREST caps at 1000 rows.
 */
export async function reviewsSince(
  since: string,
  until?: string,
): Promise<ReviewRow[]> {
  const rows: ReviewRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = db()
      .from("review")
      .select(
        "property_id, review_score, reviewed_on_sydney, lang, positive_text, negative_text",
      )
      .gte("reviewed_on_sydney", since);
    if (until) query = query.lte("reviewed_on_sydney", until);
    const { data, error } = await query
      // id breaks ties, so paging cannot skip or repeat rows that share a date.
      .order("reviewed_on_sydney", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`reviewsSince failed: ${error.message}`);
    const page = (data ?? []) as ReviewRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

/** Every stored review. Used by the health check, not by page rendering. */
export async function allReviews(): Promise<ReviewRow[]> {
  return reviewsSince("1970-01-01");
}

export type ReviewFilters = {
  propertyId?: number;
  from?: string;
  to?: string;
  band?: "positive" | "neutral" | "negative";
  topic?: string;
  polarity?: "positive" | "negative";
  search?: string;
  limit: number;
  offset: number;
};

export type FeedReview = {
  id: number;
  property_id: number;
  external_id: string;
  reviewer_name: string | null;
  reviewer_country: string | null;
  guest_type: string | null;
  room_type: string | null;
  review_score: number | null;
  title: string | null;
  positive_text: string | null;
  negative_text: string | null;
  partner_reply: string | null;
  lang: string | null;
  reviewed_on_sydney: string;
};

const FEED_COLUMNS =
  "id, property_id, external_id, reviewer_name, reviewer_country, guest_type, room_type," +
  " review_score, title, positive_text, negative_text, partner_reply, lang, reviewed_on_sydney";

/** Filtered review feed. Returns the page plus the total matching count. */
export async function searchReviews(
  filters: ReviewFilters,
): Promise<{ reviews: FeedReview[]; total: number }> {
  const { data, error, count } = await filteredReviews(filters, FEED_COLUMNS)
    .order("reviewed_on_sydney", { ascending: false })
    .order("id", { ascending: false })
    .range(filters.offset, filters.offset + filters.limit - 1);

  // A page past the end (an old bookmark after the results shrank) is not an
  // error for the reader: return no reviews plus the real total, so the page
  // can send them to the last page that exists.
  if (error?.code === "PGRST103") {
    const head = await filteredReviews(filters, "id", true);
    if (head.error)
      throw new Error(`searchReviews failed: ${head.error.message}`);
    return { reviews: [], total: head.count ?? 0 };
  }
  if (error) throw new Error(`searchReviews failed: ${error.message}`);
  return {
    reviews: (data ?? []) as unknown as FeedReview[],
    total: count ?? 0,
  };
}

/** The review query with every filter applied, shared by the page and its count. */
function filteredReviews(
  filters: ReviewFilters,
  columns: string,
  headOnly = false,
) {
  // An inner join on review_topic is only applied when filtering by topic, so
  // the common case stays a single-table read.
  const select = filters.topic
    ? `${columns}, review_topic!inner(topic, polarity)`
    : columns;

  let query = db()
    .from("review")
    .select(select, { count: "exact", head: headOnly });

  if (filters.propertyId !== undefined)
    query = query.eq("property_id", filters.propertyId);
  if (filters.from) query = query.gte("reviewed_on_sydney", filters.from);
  if (filters.to) query = query.lte("reviewed_on_sydney", filters.to);

  // Band boundaries come from the same thresholds the metrics use.
  if (filters.band === "positive") query = query.gte("review_score", 8);
  if (filters.band === "neutral")
    query = query.gte("review_score", 6).lt("review_score", 8);
  if (filters.band === "negative") query = query.lt("review_score", 6);

  if (filters.topic) {
    query = query.eq("review_topic.topic", filters.topic);
    if (filters.polarity)
      query = query.eq("review_topic.polarity", filters.polarity);
  }

  if (filters.search) {
    // Strip the characters PostgREST uses as or() delimiters and quoting before
    // interpolating user input, so a search term cannot alter the filter it sits in.
    const safe = filters.search.replace(/[(),*"\\]/g, " ").trim();
    if (safe) {
      query = query.or(
        `positive_text.ilike.%${safe}%,negative_text.ilike.%${safe}%,title.ilike.%${safe}%`,
      );
    }
  }
  return query;
}

/**
 * The latest collection run per property. Forty rows comfortably covers the
 * most recent run of four properties even after a burst of retries.
 */
export async function latestCollection(): Promise<CollectionStatus | null> {
  const { data, error } = await db()
    .from("collection_run")
    .select("property_id, started_at, finished_at, status")
    .order("started_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(`latestCollection failed: ${error.message}`);
  return summarizeRuns((data ?? []) as RunRow[]);
}

/** Per-property runs that started at or after `since` — progress of a collection in flight. */
export async function runsSince(since: string) {
  const { data, error } = await db()
    .from("collection_run")
    .select(
      "property_id, status, reviews_inserted, reviews_updated, property(assessment_label)",
    )
    .gte("started_at", since)
    .order("finished_at", { ascending: true });
  if (error) throw new Error(`runsSince failed: ${error.message}`);
  return (data ?? []) as unknown as {
    property_id: number | null;
    status: "ok" | "partial" | "failed";
    reviews_inserted: number;
    reviews_updated: number;
    property: { assessment_label: string } | null;
  }[];
}

export type PropertyCoverage = {
  propertyId: number;
  label: string;
  held: number;
  /** Booking.com's count at the latest run that reported one; null if unknown. */
  listed: number | null;
  oldest: string | null;
};

/**
 * How much of each property's review history we hold, against what Booking.com
 * lists. The collector keeps the most recent reviews per property, so the two
 * differ by design; showing both stops a reader mistaking that for missing data.
 */
export async function reviewCoverage(
  properties: PropertyRow[],
): Promise<PropertyCoverage[]> {
  // Everything below is independent, so it runs as one parallel wave rather
  // than a chain of round trips. The caller passes the property list it
  // already loads, instead of this function fetching it again.
  const [runs, perProperty] = await Promise.all([
    // Tolerates a database without migration 0003: totals are then unknown
    // rather than the page failing.
    db()
      .from("collection_run")
      .select("property_id, source_total")
      .not("source_total", "is", null)
      .order("started_at", { ascending: false })
      .limit(100),
    Promise.all(
      properties.map((p) =>
        Promise.all([
          db()
            .from("review")
            .select("id", { count: "exact", head: true })
            .eq("property_id", p.id),
          db()
            .from("review")
            .select("reviewed_on_sydney")
            .eq("property_id", p.id)
            .order("reviewed_at", { ascending: true })
            .limit(1),
        ]),
      ),
    ),
  ]);

  const listed = new Map<number, number>();
  for (const r of (runs.error ? [] : (runs.data ?? [])) as {
    property_id: number;
    source_total: number;
  }[]) {
    if (!listed.has(r.property_id)) listed.set(r.property_id, r.source_total);
  }

  return properties.map((p, i) => {
    const [count, oldest] = perProperty[i]!;
    if (count.error)
      throw new Error(`reviewCoverage failed: ${count.error.message}`);
    return {
      propertyId: p.id,
      label: p.assessment_label,
      held: count.count ?? 0,
      listed: listed.get(p.id) ?? null,
      oldest:
        (oldest.data?.[0]?.reviewed_on_sydney as string | undefined) ?? null,
    };
  });
}
