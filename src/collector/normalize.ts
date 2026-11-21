/**
 * Validates and normalizes raw booking.com reviews at the trust boundary.
 *
 * Scraped data is untrusted: a layout or API change can hand us nulls, wrong
 * types or a different score scale. Anything that fails validation is rejected
 * with a reason rather than stored, because a wrong number on an operations
 * dashboard is worse than a missing one.
 */
import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * booking.com returns HTML-escaped text ("We&#39;re glad"). Decode the small
 * set of entities that actually appear rather than pulling in a dependency.
 */
export function decodeEntities(input: string): string {
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&'); // last, so "&amp;#39;" doesn't double-decode
}

/** Trim, decode, and treat blank strings as absent. */
const cleanText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const text = decodeEntities(value).trim();
  return text.length > 0 ? text : null;
};

const rawReviewSchema = z.object({
  // Stable per-review id. Without it we cannot dedupe, so it is required.
  reviewUrl: z.string().min(1),
  reviewedDate: z.number().int().positive(),
  reviewScore: z.number().min(0).max(10).nullish(),
  helpfulVotesCount: z.number().int().nonnegative().nullish(),
  textDetails: z
    .object({
      positiveText: z.unknown(),
      negativeText: z.unknown(),
      title: z.unknown(),
      lang: z.string().nullish(),
    })
    .nullish(),
  guestDetails: z
    .object({
      username: z.unknown(),
      countryName: z.unknown(),
      countryCode: z.string().nullish(),
      guestTypeTranslation: z.unknown(),
    })
    .nullish(),
  bookingDetails: z
    .object({
      numNights: z.number().int().nonnegative().nullish(),
      checkinDate: z.string().regex(ISO_DATE).nullish(),
      checkoutDate: z.string().regex(ISO_DATE).nullish(),
      stayStatus: z.unknown(),
      roomType: z.object({ name: z.unknown() }).nullish(),
    })
    .nullish(),
  partnerReply: z.object({ reply: z.unknown() }).nullish(),
});

export type NormalizedReview = {
  external_id: string;
  reviewer_name: string | null;
  reviewer_country: string | null;
  reviewer_country_code: string | null;
  guest_type: string | null;
  room_type: string | null;
  num_nights: number | null;
  checkin_date: string | null;
  checkout_date: string | null;
  stay_status: string | null;
  review_score: number | null;
  title: string | null;
  positive_text: string | null;
  negative_text: string | null;
  lang: string | null;
  partner_reply: string | null;
  helpful_votes: number;
  reviewed_at: string;
  source: 'booking.com';
};

export type Rejection = { index: number; externalId: string | null; reason: string };

export function normalizeReview(raw: unknown): NormalizedReview {
  const r = rawReviewSchema.parse(raw);
  const text = r.textDetails;
  const guest = r.guestDetails;
  const booking = r.bookingDetails;

  return {
    external_id: r.reviewUrl,
    reviewer_name: cleanText(guest?.username),
    reviewer_country: cleanText(guest?.countryName),
    reviewer_country_code: guest?.countryCode?.toLowerCase() ?? null,
    guest_type: cleanText(guest?.guestTypeTranslation),
    room_type: cleanText(booking?.roomType?.name),
    num_nights: booking?.numNights ?? null,
    checkin_date: booking?.checkinDate ?? null,
    checkout_date: booking?.checkoutDate ?? null,
    stay_status: cleanText(booking?.stayStatus),
    review_score: r.reviewScore ?? null,
    title: cleanText(text?.title),
    positive_text: cleanText(text?.positiveText),
    negative_text: cleanText(text?.negativeText),
    lang: text?.lang ?? null,
    partner_reply: cleanText(r.partnerReply?.reply),
    helpful_votes: r.helpfulVotesCount ?? 0,
    reviewed_at: new Date(r.reviewedDate * 1000).toISOString(),
    source: 'booking.com',
  };
}

/**
 * Normalize a batch, keeping rejects visible. Callers decide what to do with
 * them; nothing is silently dropped.
 */
export function normalizeBatch(rawReviews: unknown[]): {
  valid: NormalizedReview[];
  rejected: Rejection[];
} {
  const valid: NormalizedReview[] = [];
  const rejected: Rejection[] = [];

  rawReviews.forEach((raw, index) => {
    try {
      valid.push(normalizeReview(raw));
    } catch (error) {
      const id = (raw as { reviewUrl?: unknown })?.reviewUrl;
      rejected.push({
        index,
        externalId: typeof id === 'string' ? id : null,
        reason: error instanceof z.ZodError ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') : String(error),
      });
    }
  });

  return { valid, rejected };
}
