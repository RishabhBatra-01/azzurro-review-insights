/**
 * One interface, several implementations. Milestone 1 proved the GraphQL path
 * works, but it depends on a private endpoint that can change, so the contract
 * stays narrow enough that a DOM reader or a hosted provider can satisfy it.
 */
import type { PropertyConfig } from "../properties";

/** A review exactly as the source reported it, before validation. */
export type RawReview = Record<string, unknown>;

export type FetchOptions = {
  /** Stop once this many consecutive already-known reviews are seen. */
  stopAfterKnown?: number;
  /** Hard ceiling on reviews per property, so a run can't go unbounded. */
  maxReviews: number;
  /** Returns true if we already hold this external id. */
  isKnown?: (externalId: string) => boolean;
};

export type FetchResult = {
  raw: RawReview[];
  /** Total the source claims the property has — used as a health check. */
  reportedTotal: number | null;
  /** True when we stopped early because we reached known reviews. */
  stoppedEarly: boolean;
  /** Reviews the source returned in total, known or new — the parser health signal. */
  seen: number;
};

export interface ReviewSource {
  readonly name: string;
  fetchReviews(
    property: PropertyConfig,
    options: FetchOptions,
  ): Promise<FetchResult>;
}
