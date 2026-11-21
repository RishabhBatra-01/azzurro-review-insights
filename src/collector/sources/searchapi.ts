/**
 * Fallback source: Booking.com reviews via SearchApi (searchapi.io, engine
 * `booking_reviews`), a paid third-party service.
 *
 * Used only when the browser collector fails for a property (see run.ts), and
 * only for that property's newest reviews, because credits are limited and
 * because the provider gets past Booking.com's bot protection on its side —
 * a trade-off documented in the README rather than hidden.
 *
 * Reviews are mapped into the same raw shape Booking.com's own ReviewList
 * returns, so they pass the same validator (normalize.ts) as every other
 * review: one trust boundary, not two. SearchApi's review_id is Booking.com's
 * own review id (checked against stored reviews), so both sources dedupe.
 */
import type { PropertyConfig } from "../properties";
import type {
  FetchOptions,
  FetchResult,
  RawReview,
  ReviewSource,
} from "./types";

const ENDPOINT = "https://www.searchapi.io/api/v1/search";
const PAGE_SIZE = 10; // fixed by the provider
const TIMEOUT_MS = 30_000;

type SaReview = {
  review_id?: unknown;
  title?: unknown;
  liked?: unknown;
  disliked?: unknown;
  rating?: unknown;
  language?: unknown;
  date?: unknown;
  helpful_votes?: unknown;
  travel_type?: unknown;
  author?: { name?: unknown; country?: unknown; country_code?: unknown } | null;
  stay?: {
    room_type?: unknown;
    nights?: unknown;
    check_in_date?: unknown;
    check_out_date?: unknown;
  } | null;
  property_reply?: unknown;
  reply?: unknown;
};

type SaPage = {
  reviews?: SaReview[];
  search_information?: { total_results?: unknown };
  pagination?: { next_page?: unknown };
  error?: unknown;
};

const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const num = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
/** The property's reply may come as a string or an object with text. */
const replyText = (v: unknown) =>
  str(v) ??
  (v && typeof v === "object"
    ? str((v as Record<string, unknown>).text)
    : undefined);

/** Into Booking.com's ReviewList shape. Anything malformed is left for the validator to reject. */
export function toBookingShape(r: SaReview): RawReview {
  const date = str(r.date);
  const reply = replyText(r.property_reply) ?? replyText(r.reply);
  return {
    reviewUrl: str(r.review_id),
    reviewedDate: date ? Math.floor(Date.parse(date) / 1000) : undefined,
    reviewScore: num(r.rating),
    helpfulVotesCount: num(r.helpful_votes),
    textDetails: {
      positiveText: r.liked ?? null,
      negativeText: r.disliked ?? null,
      title: r.title ?? null,
      lang: str(r.language),
    },
    guestDetails: {
      username: r.author?.name ?? null,
      countryName: r.author?.country ?? null,
      countryCode: str(r.author?.country_code),
      guestTypeTranslation: r.travel_type ?? null,
    },
    bookingDetails: {
      numNights: num(r.stay?.nights),
      checkinDate: str(r.stay?.check_in_date),
      checkoutDate: str(r.stay?.check_out_date),
      roomType: { name: r.stay?.room_type ?? null },
      // Not provided by SearchApi: explicitly unknown, not missing.
      stayStatus: null,
    },
    partnerReply: reply ? { reply } : undefined,
  };
}

export class SearchApiSource implements ReviewSource {
  readonly name = "searchapi";

  constructor(private readonly apiKey: string) {}

  static fromEnv(): SearchApiSource | null {
    const key = process.env.SEARCHAPI_API_KEY;
    return key ? new SearchApiSource(key) : null;
  }

  private async fetchPage(
    property: PropertyConfig,
    page: number,
  ): Promise<SaPage> {
    const params = new URLSearchParams({
      engine: "booking_reviews",
      url: property.url,
      sort_by: "newest",
      page: String(page),
    });
    // Key in a header, not the URL, so it never lands in a logged URL.
    const res = await fetch(`${ENDPOINT}?${params}`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await res.json().catch(() => ({}))) as SaPage;
    if (!res.ok) {
      const reason =
        typeof body.error === "string"
          ? body.error.slice(0, 160)
          : `HTTP ${res.status}`;
      throw new Error(
        `SearchApi request failed for ${property.slug}: ${reason}`,
      );
    }
    return body;
  }

  async fetchReviews(
    property: PropertyConfig,
    options: FetchOptions,
  ): Promise<FetchResult> {
    const raw: RawReview[] = [];
    let reportedTotal: number | null = null;
    let consecutiveKnown = 0;
    let stoppedEarly = false;
    let seen = 0;

    for (let page = 1; raw.length < options.maxReviews; page += 1) {
      const body = await this.fetchPage(property, page);
      reportedTotal =
        num(body.search_information?.total_results) ?? reportedTotal;
      const reviews = body.reviews ?? [];
      seen += reviews.length;

      for (const r of reviews) {
        const id = str(r.review_id);
        if (id && options.isKnown?.(id)) {
          consecutiveKnown += 1;
        } else {
          consecutiveKnown = 0;
          raw.push(toBookingShape(r));
        }
        if (
          options.stopAfterKnown &&
          consecutiveKnown >= options.stopAfterKnown
        ) {
          stoppedEarly = true;
          break;
        }
        if (raw.length >= options.maxReviews) break;
      }

      if (
        stoppedEarly ||
        reviews.length < PAGE_SIZE ||
        !num(body.pagination?.next_page)
      )
        break;
    }

    return { raw, reportedTotal, stoppedEarly, seen };
  }
}
