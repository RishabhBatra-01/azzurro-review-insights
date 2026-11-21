# Azzurro Hotels — Booking.com Review Insights

An operations dashboard that collects public Booking.com guest reviews for four
Azzurro properties in Sydney and turns them into weekly numbers and recurring
operational themes.

Built for non-technical operations staff: every number on screen states what it
is measuring and what it is measuring it against.

**Current dataset: 1,925 real reviews across all four properties.** No synthetic
or illustrative data is used anywhere.

| Brief label | Booking.com property | Reviews held | Property total |
| --- | --- | ---: | ---: |
| Olympic Hotel Paddington | Olympic Paddington Budget Hotel | 125 | 125 (complete) |
| Potts Point | Venus Potts Point | 600 | 2,394 |
| Central Sydney | Venus Surry Hills | 600 | 2,450 |
| Darling Harbour | Azzurro Pod Hotel Darling Harbour | 600 | 4,313 |

We hold the **most recent** reviews per property, not the full history — every
property is covered back to at least November 2025, and the overview only uses
the last 12 weeks. A full backfill (`--full`, ~9,300 reviews, ~25 minutes of
requests) would add only older reviews the dashboard never shows. The Reviews
page states this coverage on screen, per property ("600 of 4,313 · since
Nov 2025"), from Booking.com's count as recorded on each run, so the gap is not
mistaken for missing data.

---

## Setup

Requires **Node 20+** (developed on 24.13) and a free **Supabase** project.

```bash
npm install
npx playwright install chromium
```

Create `.env.local` from the template:

```bash
cp .env.example .env.local
```

Fill in two values from **Supabase → Project Settings → Data API / API keys**:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
```

Apply the schema by pasting each file in `supabase/migrations/` into the
Supabase **SQL Editor**, in order:

1. `0001_init.sql` — tables, constraints, indexes, row-level security
2. `0002_grants.sql` — grants the server role access
3. `0003_source_total.sql` — records Booking.com's own review count on each run

> `0002` is needed because this Supabase project did not carry the usual default
> privileges, so the secret key was denied by default. RLS stays on with no
> anonymous policy, so only the server can read or write.

## Running it

```bash
npm run collect     # collect the most recent 300 reviews per property
npm run classify    # assign operational topics to collected reviews
npm run dev         # dashboard at http://localhost:3000
```

Other commands:

| Command | What it does |
| --- | --- |
| `npm run collect -- --property olympic-paddington` | one property only |
| `npm run collect -- --max 600` | change the per-property ceiling |
| `npm run collect -- --full` | backfill history (ignores the early-stop rule) |
| `npm run classify -- --all` | re-classify everything after a lexicon change |
| `npm run health` | compare stored averages against Booking.com's published scores |
| `npm run export` | write `data/sample-reviews.json` |
| `npm test` | 59 unit tests |
| `npm run typecheck` / `npm run build` | type check / production build |

**The collector opens a visible browser window.** That is required, not a
preference — see below.

---

## Architecture

```
booking.com property page  (robots-allowed)
        │   Playwright, real browser, 1.2s pacing
        ▼
   src/collector/   capture ReviewList request → replay with paging
        │           → Zod validation → health checks
        ▼
   Supabase/Postgres
        │   review          source of truth
        │   review_topic    derived, rebuildable
        │   collection_run  provenance for every attempt
        ▼
   src/insights/    pure functions: week maths, score bands, topics
        ▼
   src/app/         Next.js server components → HTML
```

**Boundaries kept deliberately:**

- `src/db/` is the only code that knows Supabase exists.
- `src/insights/` is pure functions — no database, no network, no React. That is
  what makes the week maths and classifier unit-testable.
- `src/components/` take data as props and never fetch.
- `src/collector/` is a separate CLI. The web app imports only its lock and
  launchers (`lock.ts`, `trigger.ts`, `github.ts`), never the scraper. The
  dashboard starts a collection locally or by dispatching the GitHub workflow —
  see "Keeping data fresh" below.
- The browser never talks to Supabase. Server components render HTML, so no
  database key is ever shipped to the client.

```
src/
  collector/   sources/{types,booking-graphql}, session, normalize, run
  db/          client, queries, reviews, topics, export
  insights/    weeks, scoring, topics, metrics, classify, health
  app/         page.tsx (overview), reviews/page.tsx (feed)
  components/  ui, trend-chart
supabase/migrations/
data/          sample-reviews.json, fixtures/
tests/
```

---

## Review collection method

### Keeping data fresh: schedule and "Collect now"

Collection runs in two places, with the same code:

| | Where it runs | How it starts |
| --- | --- | --- |
| **Deployed** | GitHub Actions (`.github/workflows/collect.yml`) — real Chrome on a virtual screen | every 6 hours, or **Collect now** on the deployed site |
| **Local** | this machine — a Chrome window opens | **Collect now** with `ENABLE_UI_COLLECTION=1`, or `npm run collect` |

Vercel itself cannot collect: it has no screen or Chrome, and Booking.com
refuses headless browsers. So the deployed button asks GitHub to run the
workflow, and the chip follows it ("Starting collector…", "Collecting… 2 of
4", then "Collected: 1 new review") from GitHub's run status and the
`collection_run` table. Each run collects, then classifies new reviews.

**What was actually observed on GitHub Actions (21 Nov 2026):** the first
three GitHub-hosted runs got through Booking.com — 4/4 properties, ~50 seconds,
two of them picking up a real new review, one triggered from the deployed
site's button. After roughly six runs in 45 minutes, later runs loaded the
property pages (correct titles) but the "Read all reviews" control never
appeared, so 3–4 of 4 properties failed; the same code run from a home
connection at the same moment succeeded. That pattern is consistent with
Booking.com degrading pages for repeated data-centre traffic, though it is not
proven. **So hosted collection is best-effort, not guaranteed.** Failures are
recorded per property (the freshness dot turns red), nothing is deleted, the
log records the page title and any WAF/captcha markers, and the reliable
fallback is a local run. Nothing is done to get around it.

**Every 6 hours** because the portfolio gets ~3 reviews a day and the
dashboard reports by week: fresh enough, and four short runs a day stay light
on Booking.com. It is one line in the workflow to change.

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
  time.
- **Incremental updates** sort `NEWEST_FIRST` and stop after **20 consecutive**
  already-known reviews. Twenty rather than one, because sort order is not
  guaranteed to be strictly chronological.
- **Token expiry** (tokens last roughly 30 minutes) is handled by re-priming the
  session once from a fresh page load before failing.
- **One property failing never aborts the others**; each is its own transaction.
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

Most recent health check:

```
property                      stored   ours   booking   diff
olympic-paddington              125   6.50      6.5   0.00
venus-potts-point-sydney        600   6.11      6.3   0.19
venus-surry-hills               600   6.65      6.6   0.05
chateau-de-venus                600   6.01      6.6   0.59
```

Paddington matches exactly, and we hold all 125 of its reviews — independent
confirmation the pipeline is correct. The others differ because we hold only the
most recent 600, which skew from the all-time average.

---

## Definitions

These choices are deliberate and are stated on screen as well as here.

| Thing | Definition |
| --- | --- |
| Week | **Monday 00:00 – Sunday 23:59, Australia/Sydney** |
| Current week | the week containing today in Sydney |
| Date used | the **review** date, not the stay date |
| Positive | score **≥ 8.0** |
| Neutral | **6.0 – 7.9** |
| Negative | **< 6.0** |
| Low data | fewer than **3** scored reviews — no average or delta shown |
| Missing score | excluded from averages, never counted as zero |

`reviewed_on_sydney` is generated in the database from the review timestamp, so
every consumer agrees on which week a review belongs to.

---

## Insights: method and limitations

### Positive vs negative

Not inferred from text. Booking.com provides a numeric score per review, so the
bands above *are* the definition.

### Topics

Booking.com returns the "liked" and "disliked" text as **separate fields**. A
curated keyword lexicon is matched, on word boundaries, over each field
independently:

- a match in the disliked text → a **complaint** about that topic
- a match in the liked text → **praise**

Mixed feedback needs no special handling: "great location, noisy room" yields
`location/positive` and `noise/negative` on the same review. The matched term is
stored, so every tag can be explained in the UI.

No LLM or trained model is used. The data structure already carries the signal,
and a keyword match is explainable, free, deterministic and unit-testable.

### Denominators

Every percentage states its denominator on screen, because the denominator is
**not** "all reviews":

> Facilities 50% (3 of 6) — *out of 6 reviews this week written in English that
> contained a complaint. 16 other reviews had no written text or were not in
> English.*

This matters more than it sounds. In the collected data (1,000-row sample):

| | |
| --- | --- |
| Reviews with **no written text at all** | **49%** |
| Reviews **in English** | **50%** |
| English **and** containing text | **27%** |
| Reviews **missing a score** | **0%** |

So **ratings and week-over-week trends use 100% of reviews**, but **topic
analysis can only ever cover about 30%**. A naive implementation would run an
English keyword list over everything, find nothing in the French reviews, and
report that as "no issues mentioned" — understating every topic roughly threefold.

### Classifier quality — what was actually measured

A sample of 35 classified English reviews was read back and checked against the
text. Findings:

**Fixed:** bare `"area"` was matching "dining area", "communal area" and
"sitting area" and tagging them as *location*. It was removed from the lexicon
(`local area` / `surrounding area` kept), which removed **36 incorrect tags**
across the dataset. Regression tests pin this.

**Known, unfixed — polarity comes from which field the text sits in:**

- A guest wrote *"It was clean"* in the **disliked** box. Tagged
  `cleanliness/negative`. The field placement is wrong, and we trust the field.
- *"Check-in had a small hiccup, but the staff resolved it quickly"* sits in the
  disliked box, so `staff` is tagged negative although the staff were praised.

Keyword matching cannot fix either, because both are about sentiment *within* a
field. They are genuine limitations, not bugs.

**Other known limitations:**

- Paraphrasing is missed — "the room smelled" only matches via "smell".
- Negation is not handled — "not clean" and "very clean" both match cleanliness.
  Tolerable only because polarity comes from the field, not the wording.
- Topic tags are derived data in their own table and can be rebuilt at any time
  with `npm run classify -- --all`.

---

## Interface

A fixed left sidebar and a single overview screen, with the review feed on its
own page. The overview reads top to bottom: the week's headline figures, the
four properties side by side, rating trend, what guests actually said, then the
operational topics.

### Design decisions, and why

**Who this is for.** A hotel operations manager at about 8am whose four
properties are averaging around 6 out of 10, with a few minutes before a staff
standup. The job is to find which property slipped and what guests complained
about, specifically enough to act on it that day.

**So the interface is deliberately not celebratory.** Deep navy chrome with a
gold mark, a warm off-white canvas, white paper for the data. The register is a
good hotel's lobby: quiet, warm, in service of the information it carries.
Colour is spent almost entirely on data rather than decoration, because most
weeks the news here is bad and a luxurious skin over it would be theatre.

**Colour is never the only signal.** Every rating change carries an arrow, a
sign and a screen-reader word as well as a tint. Every chart band has a legend
entry and a swatch. Each chart ships a screen-reader table with the same
numbers.

**The sentiment scale is blue → grey → red, not green → red.** Red/green is the
one pair red-green colourblind readers cannot separate, and it is the usual
choice for exactly this kind of dashboard. The steps were checked with a
palette validator rather than by eye, in both themes against the real card
surfaces:

| | light | dark |
| --- | ---: | ---: |
| Worst colourblind-simulated separation (ΔE, target ≥ 8) | 8.4 | 8.5 |
| Worst normal-vision separation (floor ≥ 15) | 18.1 | 17.2 |
| Contrast vs card surface | all ≥ 3:1 | all ≥ 3:1 |

Token families are kept strictly apart: `--series-*` for data, `--status-*` for
state, `--data-line` for the single-series trend, and `--accent` for chrome.

**Gold runs in two tiers, because one gold cannot do both jobs.** The bright
gold that looks right on the navy sidebar is illegible on white:

| | On navy | On white |
| --- | ---: | ---: |
| `--nav-accent` `#d4af37` bright gold | **8.31:1** | 2.10:1 — unusable |
| `--accent` `#8a6d1f` bronze | — | **4.90:1** |

So bright gold appears only on dark chrome, and its bronze sibling carries every
link and active state on light surfaces. Both are in a hue the data and status
scales never touch, so the accent can never be mistaken for a value.

The portfolio trend line gets its own token, `--data-line` `#2d4a6b` (9.12:1 on
white). It is data, so it must not wear the accent; it carries no sentiment, so
it must not wear the positive blue either. When the chrome turned gold this line
silently inherited the accent and had to be given a colour of its own.

**Property bars are coloured by band, not one hue per property.** Average rating
across four properties is one measure, not four series, so four decorative hues
would imply a distinction that is not there. Colouring by band reuses the
sentiment scale and makes "who is in the red" readable at a glance.

**The rating trend's y-axis is not pinned to 0–10,** because that would flatten
every real week-to-week movement. The chart says so on its face.

### Topic identity colour

Each of the eight operational topics carries its own hue, on its icon tile and
its ring. This is **identity** colour — it answers "which topic", never "how
good". Judgement stays with the sentiment scale, and the ring deliberately does
not change colour by how positive a topic is, because that would mean inventing
a "good enough share" threshold we cannot defend from the data.

All eight were measured as glyph-on-tile and as ring-stroke-on-card, in both
themes, against the real surfaces:

| | light | dark |
| --- | ---: | ---: |
| Worst of sixteen contrast measurements | 3.32:1 | 3.77:1 |
| Required for non-text UI | 3:1 | 3:1 |

Two of the first picks failed and were replaced: the original orange came in at
2.81:1 and the original teal at 2.49:1, both under the 3:1 floor. Darkening them
also pushed the closest pair of hues further apart (a sum-of-RGB separation of
59 → 74), so the eight are easier to tell from one another as well as easier to
see.

A ring resting on fewer mentions than the low-data threshold is drawn at 45%
opacity with a muted number. Visual weight should track reliability: a 100% ring
built from one review must not outshout a 60% ring built from five.

Topics nobody mentioned this week still get a card, dashed and muted. "No one
wrote about check-in" is a finding; an absent card just looks like a bug.

### Type

Plus Jakarta Sans for the interface and every number; Instrument Serif for page
titles only. Both are loaded through `next/font`, which downloads them at build
time and serves them with the app — no new dependency, and a visitor's browser
never makes a request to Google.

Numbers deliberately use the sans, not the serif. They are tabular and lining,
which was checked in the browser rather than assumed: `1111` and `0000` measure
the same 90.4px, so a column of ratings aligns and a count-up never changes
width as it runs. (The earlier Georgia fallback set old-style figures that
dropped below the baseline.)

### The hero band

Each page opens on a dark band: a navy-to-violet gradient, a faint dot grid,
and three soft glows that drift slowly. The glows are radial gradients rather
than blurred shapes, so they are soft by construction and no filter has to be
recomputed while they move.

The KPI tiles are smoked glass — dark and translucent — rather than the usual
frosted white, and deliberately use no `backdrop-filter`: a blur sitting over a
moving background repaints on every frame.

The band carries its own token scope (`.on-dark`), so badges, icon tiles and
figures placed in it pick up light-on-dark values without knowing where they
are. Its contrast was checked at the **worst point the glows can reach** — the
indigo and gold peaks overlapping on the lightest end of the gradient, under a
tile — not at an average point:

| | at the brightest point | needs |
| --- | ---: | ---: |
| Body text | 8.49:1 | 4.5:1 |
| Muted text | 5.20:1 | 4.5:1 |
| Gold accent, status colours | ≥ 4.87:1 | 3:1 |
| Data line (ice blue) | 5.06:1 | 3:1 |

The first version failed this: with brighter glows and white glass, muted text
fell to 2.74:1. Dimming the glow peaks and switching to smoked glass fixed it.

**Freshness, from the real run log.** The hero shows when data was last
collected and how many properties' latest runs succeeded, read from the
collector's `collection_run` table. The dot pulses only while every property's
latest run is OK — a heartbeat on a failing pipeline would be a lie — and turns
amber or red without pulsing otherwise. If the run log cannot be read, the page
still renders and the chip is simply absent.

### Motion

Everything that moves has a job, and almost all of it plays once:

- The headline figures count up to their value. The server renders the real
  number first, so with JavaScript off or reduced motion on, the correct figure
  is simply there; screen readers read a hidden copy of the final value rather
  than the animation's frames. Verified in the browser: mid-flight at 4.75,
  settled on the real 5.23.
- Sparklines draw themselves left to right, then mark where they end. Rings
  draw their arc; bars grow from the left; charts draw in.
- Sections rise and fade in reading order, 60ms apart.
- The aurora drifts continuously but very slowly (19–27s cycles), and the
  freshness dot pings while the pipeline is healthy. These are the only two
  things that loop.
- A soft light follows the pointer across cards, with a brighter rim where it
  meets the border. It is lighting only — no lift and no pointer cursor — so a
  card that is not a link still does not promise a click. One delegated
  listener drives every card, and it is not attached at all on touch screens.

Nothing is tied to scroll position, and nothing animates width, height or any
other layout property. All of it sits inside
`@media (prefers-reduced-motion: no-preference)`, so for a reader who asked for
less motion it is never applied, rather than applied and shortened. Verified
both ways: with reduced motion the count-up starts on its final value and the
aurora and sparkline animations report `none`.

### What the design deliberately does not borrow

This screen follows a reference layout, with four things left out because the
data does not support them:

- **No property photographs.** We hold no licensed images of these properties
  and will not reuse Booking.com's. Monogram tiles instead.
- **Ratings stay out of 10,** the scale Booking.com actually publishes.
  Rendering them as five stars would misstate the source.
- **No "review coverage" of eligible stays** — we have no stay data. The fifth
  KPI reports what we can prove instead: how much of the week's intake the topic
  analysis can read at all, which is the denominator behind every topic
  percentage, and is currently about a third.
- **No navigation to reports that do not exist.** Two pages, two nav items. The
  remaining sidebar links are in-page anchors.

### Icons

[Phosphor](https://phosphoricons.com) (MIT), which replaced Lucide. The reason
is weights: Phosphor ships six per icon, and the interface uses that to carry
meaning rather than decoration — a nav item renders `duotone` when it is the
current page and `regular` otherwise, so the active state is signalled by icon
weight as well as by colour, a gold bar and `aria-current`.

### Responding to a click

Both routes ship a `loading.tsx` skeleton whose shape mirrors the real page, so
clicking a nav link paints a response immediately instead of leaving the old
page frozen until the query returns, and nothing jumps when the data lands.
Press feedback (a 1.5% scale-down) is deliberately *not* restricted to fine
pointers: on a touch screen it is the only confirmation that the tap landed.
Focus rings are defined once, globally, on every link and button rather than
per component.

### Interaction and accessibility

Hover, press and focus follow one set of numbers: 150ms in, 120ms out, 90ms
press, one easing curve, cards lift 2px, buttons step 1px and sink on press.
Only transform, opacity, colour and shadow animate — never width or height.
Hover rules are scoped to `(hover: hover) and (pointer: fine)` so a tap on a
phone cannot leave a control stuck in its hover state, and a card that is not a
link does not move at all.

**Checked at 320/360/390/768/1024/1280/1536px in both themes across three
URLs — 42 renders, no horizontal overflow and no clipped labels.** Three real
bugs were found that way: band labels clipping at phone widths, and twice a
chart's screen-reader table widening the page (a `<table>` expands past the
`sr-only` 1px width and ignores its overflow clip). The second occurrence is why
that markup now lives in one `VisuallyHidden` component instead of being
repeated.

Numbers use a serif face at display sizes and the sans face for small inline
figures — the serif fallback is Georgia, whose old-style figures drop below the
baseline and look ragged in a list of percentages.

## Known limitations and assumptions

**Collection**

- Requires a **visible browser**; headless is refused by the reviews API.
- Depends on a **private, undocumented** GraphQL operation. Booking.com can
  change it without notice. The collector is written behind a `ReviewSource`
  interface so a DOM reader or hosted provider can be swapped in.
- Booking.com's Terms of Service restrict automated access regardless of what
  `robots.txt` permits. This is a trial-scope demonstration. **The production
  route for a hotel group that owns these properties is the Booking.com
  Extranet**, or the Connectivity Review API via a PMS/channel-manager partner —
  no WAF, no breakage, no grey area.
- Only the most recent 600 reviews per property are stored by default. Deep
  backfill with `--full` is untested beyond 600.
- Review counts shift between runs (Paddington reported 124 then 125; Potts Point
  2,396 then 2,394), so reviews are both added and removed upstream.

**Data**

- Reviewer names are first names only, as published publicly. Profile photo URLs
  are deliberately not stored.
- Stay dates are exact; the displayed page UI only showed month granularity.

**Product**

- Olympic Paddington has 125 reviews total, so some weeks have very few. The
  dashboard shows "Not enough data to compare" below 3 scored reviews rather than
  a misleading average.
- Topic analysis is English-only (see above).

**Not done**

- No automated end-to-end browser test of the dashboard.
- Classifier evaluation was a 35-review read-through, not a formally labelled
  hold-out set with precision/recall figures.
- No deployed demo yet; runs locally.

---

## Security

- `.env.local` is gitignored and was verified ignored before it was created.
- No key is shipped to the browser: the dashboard renders server-side, and the
  Supabase client is only imported by `src/db/`.
- Row-level security is enabled on all four tables with **no anonymous policy**,
  verified: an anonymous request returns `401`.
- Search input is escaped before being interpolated into PostgREST filters.
