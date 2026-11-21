import { describe, expect, it } from "vitest";
import { toBookingShape } from "../src/collector/sources/searchapi";
import { normalizeBatch } from "../src/collector/normalize";

// Shape taken from a real SearchApi booking_reviews response.
const sample = {
  review_id: "db7af74897e78b71",
  title: "Horrible",
  liked: "Close to the stadium.",
  disliked: "The room wasn&#39;t clean.",
  rating: 3.0,
  language: "en",
  date: "2026-11-19T21:03:09Z",
  helpful_votes: 0,
  travel_type: "Couple",
  author: { name: "Parker", country: "Australia", country_code: "au" },
  stay: {
    room_type: "Standard Double Room",
    nights: 1,
    check_in_date: "2026-11-15",
    check_out_date: "2026-11-16",
  },
};

describe("SearchApi mapping", () => {
  it("passes the same validator as Booking.com data, keeping the Booking.com review id", () => {
    const { valid, rejected } = normalizeBatch([toBookingShape(sample)]);
    expect(rejected).toHaveLength(0);
    expect(valid[0]).toMatchObject({
      external_id: "db7af74897e78b71",
      review_score: 3,
      reviewer_name: "Parker",
      room_type: "Standard Double Room",
      num_nights: 1,
      reviewed_at: "2026-11-19T21:03:09.000Z",
    });
  });

  it("rejects a review with no id or date instead of storing it", () => {
    const { valid, rejected } = normalizeBatch([
      toBookingShape({ ...sample, review_id: undefined }),
      toBookingShape({ ...sample, date: "garbage" }),
    ]);
    expect(valid).toHaveLength(0);
    expect(rejected).toHaveLength(2);
  });

  it("rejects an out-of-range score", () => {
    expect(
      normalizeBatch([toBookingShape({ ...sample, rating: 42 })]).rejected,
    ).toHaveLength(1);
  });
});
