/**
 * Collects reviews from booking.com's own ReviewList GraphQL operation.
 *
 * How it works, and why it works this way:
 *   - We open the public property page in a real browser. That page is allowed
 *     by booking.com's robots.txt; /hotelfeaturedreviews/ is disallowed and we
 *     never touch it.
 *   - The page issues its own ReviewList request. We capture that request and
 *     replay it with different `skip` values through the same browser context.
 *     Nothing is forged — the session and its tokens come from the real page.
 *   - Verified in Milestone 1: headless is refused by this endpoint
 *     ("Request not supported", statusCode 400), so the browser runs headed.
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import type { PropertyConfig } from '../properties';
import type { FetchOptions, FetchResult, RawReview, ReviewSource } from './types';

const PAGE_SIZE = 10; // fixed by the endpoint
const PACING_MS = 1200; // polite gap between calls

type CapturedRequest = { url: string; headers: Record<string, string>; body: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Headers that must not be replayed verbatim. */
const replayableHeaders = (headers: Record<string, string>) =>
  Object.fromEntries(
    Object.entries(headers).filter(
      ([k]) => !k.startsWith(':') && !['host', 'content-length'].includes(k.toLowerCase()),
    ),
  );

export class BookingGraphQLSource implements ReviewSource {
  readonly name = 'booking-graphql';
  private browser?: Browser;
  private context?: BrowserContext;

  async open(): Promise<void> {
    this.browser = await chromium.launch({ headless: false });
    this.context = await this.browser.newContext({
      locale: 'en-US',
      timezoneId: 'Australia/Sydney',
      viewport: { width: 1440, height: 900 },
    });
  }

  async close(): Promise<void> {
    await this.context?.close();
    await this.browser?.close();
  }

  /**
   * Load the property page and capture the ReviewList request it makes.
   * Tokens are short-lived, so this is re-run whenever a replay is rejected.
   */
  private async primeSession(property: PropertyConfig): Promise<CapturedRequest> {
    if (!this.context) throw new Error('source not opened');
    const page: Page = await this.context.newPage();
    let captured: CapturedRequest | null = null;

    page.on('request', (req) => {
      if (captured) return;
      const body = req.postData();
      if (req.url().includes('/dml/graphql') && body?.includes('ReviewList')) {
        captured = { url: req.url(), headers: req.headers(), body };
      }
    });

    try {
      await page.goto(`${property.url}?lang=en-us`, {
        waitUntil: 'domcontentloaded',
        timeout: 60_000,
      });
      await page.waitForTimeout(2500);
      const trigger = page.getByRole('button', { name: /read all reviews/i }).first();
      if (await trigger.count()) {
        await trigger.click();
        // Wait for the request rather than a fixed delay where possible.
        await page.waitForTimeout(4000);
      }
    } finally {
      await page.close();
    }

    if (!captured) {
      throw new Error(
        `could not capture a ReviewList request for ${property.slug} — the page may have changed`,
      );
    }
    return captured;
  }

  /** Replay the captured request with our own paging variables. */
  private async fetchBatch(captured: CapturedRequest, skip: number) {
    if (!this.context) throw new Error('source not opened');
    const payload = JSON.parse(captured.body);
    const node = Array.isArray(payload) ? payload[0] : payload;
    node.variables.input.skip = skip;
    node.variables.input.limit = PAGE_SIZE;
    node.variables.input.sorter = 'NEWEST_FIRST';

    const res = await this.context.request.post(captured.url, {
      headers: replayableHeaders(captured.headers),
      data: JSON.stringify(payload),
    });

    const json: any = await res.json().catch(() => null);
    const result = json?.data?.reviewListFrontend;

    if (!result || result.__typename !== 'ReviewListFrontendResult') {
      return {
        ok: false as const,
        message: result?.message ?? `unexpected response (HTTP ${res.status()})`,
      };
    }
    return {
      ok: true as const,
      reviews: (result.reviewCard ?? []) as RawReview[],
      total: typeof result.reviewsCount === 'number' ? result.reviewsCount : null,
    };
  }

  async fetchReviews(property: PropertyConfig, options: FetchOptions): Promise<FetchResult> {
    let captured = await this.primeSession(property);
    const raw: RawReview[] = [];
    let reportedTotal: number | null = null;
    let consecutiveKnown = 0;
    let stoppedEarly = false;
    let refreshed = false;

    for (let skip = 0; raw.length < options.maxReviews; skip += PAGE_SIZE) {
      const batch = await this.fetchBatch(captured, skip);

      if (!batch.ok) {
        // Tokens are short-lived. Re-prime once before giving up, so a long
        // run doesn't fail just because the session aged out.
        if (!refreshed) {
          refreshed = true;
          captured = await this.primeSession(property);
          skip -= PAGE_SIZE;
          continue;
        }
        throw new Error(`ReviewList rejected for ${property.slug}: ${batch.message}`);
      }

      refreshed = false;
      if (batch.total !== null) reportedTotal = batch.total;
      if (batch.reviews.length === 0) break;

      for (const review of batch.reviews) {
        const id = typeof review.reviewUrl === 'string' ? review.reviewUrl : null;
        if (id && options.isKnown?.(id)) {
          consecutiveKnown += 1;
        } else {
          consecutiveKnown = 0;
          raw.push(review);
        }
      }

      // Stop once we're clearly back into reviews we already hold. We require a
      // run of known reviews rather than a single one, because sort order is
      // not guaranteed to be perfectly chronological.
      if (options.stopAfterKnown && consecutiveKnown >= options.stopAfterKnown) {
        stoppedEarly = true;
        break;
      }

      if (reportedTotal !== null && skip + PAGE_SIZE >= reportedTotal) break;
      await sleep(PACING_MS);
    }

    return { raw, reportedTotal, stoppedEarly };
  }
}
