# Review collection: full detail

The short version is in the [README](../README.md#how-reviews-are-collected). This page keeps the full record: what was tried, what the evidence showed, and how failures are handled.

## Review collection method

### Keeping data fresh: schedule and "Collect now"

Collection runs in two places, with the same code:

| | Where it runs | How it starts |
| --- | --- | --- |
| **Deployed** | GitHub Actions (`.github/workflows/collect.yml`) — real Chrome on a virtual screen | daily at 7am Sydney, or **Collect now** on the deployed site |
| **Local** | this machine — a Chrome window opens | **Collect now** with `ENABLE_UI_COLLECTION=1`, or `npm run collect` |

Vercel itself cannot collect: it has no screen or Chrome, and Booking.com
refuses headless browsers. So the deployed button asks GitHub to run the
workflow, and the chip follows it ("Starting collector…", "Collecting… 2 of
4", then "Collected: 1 new review") from GitHub's run status and the
`collection_run` table. Each run collects, then classifies new reviews.

**What was actually observed (21 Nov 2026), including a wrong turn.** The
first GitHub-hosted runs got through Booking.com — 4/4 properties, ~50 seconds,
two of them picking up a real new review, one triggered from the deployed
site's button. Later runs, on GitHub and locally, began failing with "could not
capture a ReviewList request", which was at first read as Booking.com blocking
repeated traffic. **It was not.** Loading the page and inspecting it showed the
"Read all reviews" button present and a click returning reviews. The cause was
timing: the button is in the server-rendered HTML before the page's scripts can
handle it, and a change meant to replace a fixed delay made the collector click
too early, so nothing happened. The collector now retries the click (up to
three times) until the review request appears; afterwards all four properties
collected through the browser alone. The lesson recorded here: inspect the page
before concluding that a site is blocking you. Failures are still recorded per
property (the freshness dot turns red), nothing is deleted, and the failure
log carries the page title and any WAF/captcha markers to tell the cases apart.

**Fallback: SearchApi.** When the browser collector fails for a property, the
run fetches that property's newest reviews through
[SearchApi](https://www.searchapi.io/docs/booking-reviews-api) (`booking_reviews`
engine) instead, if `SEARCHAPI_API_KEY` is set. Decisions and trade-offs:

- **It is a third-party, paid service that gets past Booking.com's bot
  protection on its side.** It was added while the browser collector was
  failing (a timing bug, since fixed — see above, though it looked like
  blocking at the time), and is kept as a safety net so the dashboard stays
  current if the browser path breaks again. Data
  collected this way is still Booking.com's reviews — SearchApi's `review_id`
  is Booking.com's own id (checked against stored reviews), so both paths
  deduplicate into the same rows.
- **Same trust boundary.** Its responses are mapped into Booking.com's raw
  shape and pass the same validator as every other review; fields it does not
  provide are stored as unknown (null), not guessed. Covered by tests.
- **Newest reviews only, never a backfill.** Each request returns 10 reviews
  and costs a credit; the fallback stops after a full page of reviews already
  held, so a routine run costs about one credit per failing property, three at
  most. A full backfill (~930 requests) is out of reach of the free tier.
- **Verified 21 Nov 2026:** with the browser path failing for all four
  properties, the run completed 4/4 via SearchApi using 4 credits. Which channel was used is
  printed in the run log (`via SearchApi`); it is not yet stored per run in the
  database.
- **Credit budget:** if the browser keeps failing, the daily schedule uses
  ~4 credits a day, so the free tier (100/month) lasts about three weeks
  (button clicks use more). When credits run out, requests fail, the run is
  recorded as failed, and nothing is deleted.

**Daily, at 7am Sydney,** because the portfolio gets ~3 reviews a day and the
dashboard reports by week, so the morning shift opening on fresh data is
enough. It started as every 6 hours and was reduced to daily to stay light on
Booking.com and within the SearchApi fallback's credits. It is one line in the
workflow to change; **Collect now** covers anything more urgent.

**The button is open to every visitor** (a deliberate choice: no password).
The route therefore enforces, for local and GitHub runs alike:

- same-origin requests only (403), so another website cannot trigger a run;
- **one run at a time** — while any run is active, scheduled or clicked, new
  requests are refused and the chip shows that run's progress;
- **5 minutes** between runs.

Worst case that is ~12 runs an hour; if that ever causes trouble, add a
password to `POST /api/collect`.

**Setup for the deployed button** (Vercel environment variables):

- `GITHUB_REPO` — `owner/repo`
- `GITHUB_DISPATCH_TOKEN` — a fine-grained GitHub token for **this repository
  only**, permission **Actions: Read and write**

and repository secrets `SUPABASE_URL` and `SUPABASE_SECRET_KEY` for the
workflow. Run logs are public on a public repository; they contain property
names and counts only, and GitHub masks the secrets.

**Refresh** is a different thing: it re-reads the database and says "Already
up to date" unless a collection has finished since the page loaded.

### What was tried, and what the evidence showed

**1. Plain HTTP requests — does not work.** All four property pages return
`HTTP 202` with a ~4KB **AWS WAF JavaScript challenge** instead of the page:

```
window.awsWafCookieDomainList = ['booking.com'];
<script src="/__challenge_.../challenge.js">
```

**2. Reviews are not in the HTML anyway.** They render only after JavaScript
runs, behind a "Read all reviews" button.

**3. The usual shortcut is off-limits.** Booking.com's `robots.txt` has:

```
User-agent: *
Disallow: /hotelfeaturedreviews/
```

That is the review endpoint most scrapers use. **This project never requests it.**
The property page (`/hotel/*.html`) is not disallowed, and `/dml/graphql` is not
mentioned in `robots.txt` at all.

### How it actually works

1. Open the public property page in a real Chromium browser (Playwright).
2. The page issues its own `ReviewList` GraphQL request.
3. Capture that request and **replay it with different `skip` values** through
   the same browser context.

Nothing is forged. The session and its tokens come from the real page. There is
no proxy rotation, no CAPTCHA solving, and no synthesised credentials. If the
session cannot obtain tokens legitimately, the run fails and says so.

**Headless does not work.** The page loads headless, but the reviews API refuses
it:

```json
{"message":"Request not supported","statusCode":400}
```

The same code with a visible browser returns real reviews. So the collector runs
headed — slower, but honest about what it is.

### Fields captured

`reviewUrl` (stable id) · score · review timestamp · title · positive text ·
negative text · language · property reply · reviewer first name · country ·
guest type · room type · nights · check-in and check-out dates · helpful votes

### Duplicates, updates and failures

- **Duplicates** are prevented by a database constraint,
  `UNIQUE (property_id, external_id)`, with `ON CONFLICT DO UPDATE` — not by
  application logic. Running the collector twice inserts zero rows the second
  time. Both sources (the browser and SearchApi) use Booking.com's own review
  id, so the same review from either source lands on the same row.
- **Repeats inside one run** are removed before saving
  (`dedupeByExternalId` in `src/collector/normalize.ts`). Paging works by
  offset, so if a guest posts a review mid-run the list shifts by one and a
  review can appear on two pages. The database would never store it twice, but
  a single save cannot update the same row twice either, so without this step
  the whole save for that property would fail.
- **Incremental updates** sort `NEWEST_FIRST` and stop after **20 consecutive**
  already-known reviews. Twenty rather than one, because sort order is not
  guaranteed to be strictly chronological.
- **Token expiry** (tokens last roughly 30 minutes) is handled by re-priming the
  session once from a fresh page load before failing.
- **One property failing never aborts the others.** Each property is
  collected and saved separately, so a failure is recorded against that
  property and the run moves on to the next one.
- **A failed run never deletes existing data.** Every attempt is recorded in
  `collection_run` with status `ok` / `partial` / `failed`.

### Detecting silent breakage

A parser that *breaks* is obvious. A parser that keeps working but records the
wrong thing is the real danger, so:

- **Published-score check** (`npm run health`) compares stored averages against
  the score Booking.com displays. That is ground truth we did not generate.
- **Count check** — collecting zero reviews from a property that reports
  thousands fails the run.
- **Zod validation** rejects out-of-range scores and malformed dates, which would
  catch a change of score scale.
- **Reject-ratio check** — if more than 20% of a batch fails validation, the run
  fails rather than storing an unreliable slice.

Most recent health check (21 Nov 2026, all 9,284 reviews held):

```
property                      stored   ours   booking   diff
olympic-paddington              125   6.50      6.5   0.00
venus-potts-point-sydney       2394   7.71      6.3   1.41
venus-surry-hills              2450   7.82      6.6   1.22
chateau-de-venus               4315   7.52      6.6   0.92
```

**How to read this.** Paddington matches exactly: we hold all 125 of its
reviews, all from 2026, and our plain average equals Booking.com's score.

The other three differ by about one point, and the reason is in the data, not
the collector. Their ratings have fallen sharply this year:

| property | 2024 average | 2025 average | 2026 average |
|---|---:|---:|---:|
| Potts Point | 8.28 | 7.52 | 5.38 |
| Central Sydney | 8.24 | 7.75 | 5.80 |
| Darling Harbour | 7.83 | 7.64 | 5.89 |

Our figure is a plain average over three years of reviews, so the good older
years pull it up. Booking.com's published score sits much closer to the recent
level, which suggests it gives recent reviews more weight (Booking.com does not
publish its exact formula). So for these three properties the check confirms
the scale and the rough level, not an exact match. The tolerance is 1.5 points,
which still catches the failures that matter (a wrong score scale, a broken
parser), but would not catch a small, subtle error.
