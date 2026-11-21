# Interface and design decisions

Why the dashboard looks and behaves the way it does.

## Interface

A fixed left sidebar and a single overview screen, with the review feed on its
own page. The overview reads top to bottom: the week's headline figures, the
four properties side by side, rating trend, what guests actually said, then the
operational topics.

### Filters

**Overview: property and week.** Two pickers in the header choose one property
(or all four) and which Mon–Sun week counts as "this week", back about three
years. The choice is kept in the URL (`/?property=2&week=2026-10-12`), so a view
can be bookmarked or shared.

- Every headline figure, the week-over-week change, the trend charts, topic
  movement, operational topics and recent reviews are worked out from **one
  filtered set of reviews** (`scoped` in `src/app/data.ts`), so no panel can
  show all properties while the page says one. Checked against figures
  calculated directly from the database for four different property and week
  combinations, back to 2024: every number matched.
- Labels follow the view: "Potts Point rating, week of 12 Oct", "that week",
  "the week before", and the year is shown for any week outside the current
  year.
- The property cards, the rating-by-property chart and the map always show all
  four properties, because comparing them is their job; the chosen property is
  outlined or highlighted.
- Links into the Reviews page carry the same property and, for a past week, the
  same dates, so a drill-down lists the reviews behind the number.
- The Overview works in whole weeks rather than any start and end date, because
  every figure on it is "this week against the week before". The Reviews page
  keeps free From/To dates.
- An unknown property, an impossible date, a future week or one older than the
  picker offers falls back to the default view (all properties, this week).

**Reviews: property, dates, rating band, topic and text.** Also kept in the URL.
A date that is not a real calendar date is ignored rather than sent to the
database, and a page number past the end goes to the last page that exists.

**Per-property change.** Each property card shows that property's own change
against the week before, or "Too few to compare" when either week has fewer
than three rated reviews, using the same comparison as the headline figure.

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
- The aurora drifts continuously but very slowly (19–27s cycles), two faint
  beams of light cross the hero now and then, the freshness dot pings while the
  pipeline is healthy, and the map pins pulse in their rating colour. All are
  transform/opacity only.
- A soft light follows the pointer across cards, with a brighter rim where it
  meets the border. It is lighting only — no lift and no pointer cursor — so a
  card that is not a link still does not promise a click. One delegated
  listener drives every card, and it is not attached at all on touch screens.

**What changed, after Collect now or Refresh.** Figures re-count from their old
value to the new one (not from zero); a property card whose figures moved glows
once; reviews that just arrived slide into "Recent reviews" with a "New" tag
that clears after six seconds. Nothing is marked on a plain page load, because
nothing has changed. While a collection runs, the status chip shows one segment
per property (gold working, green done, red failed) and names each property as
it finishes; all of it comes from the run log, so the bar only moves when a
property has really been collected.

**Moving around.** Links between pages carry a `nav-page` transition type, and
each page is wrapped in React's `<ViewTransition>` (`src/components/page-transition.tsx`),
so the old page lifts away and the new one rises in. Refresh, Collect now and the
browser's back button carry no type and stay still; the browser's default
whole-page crossfade is switched off for the same reason. Browsers without the
View Transitions API just swap pages. The Reviews filter form is `next/form`, so
applying filters is an in-app navigation and the results arrive top to bottom,
40ms apart. Hovering a chart bar eases the other bars back and the tooltip
eases in. Loading skeletons now mirror each page, dark hero band included, with
a soft shimmer.

**The map** (`src/components/property-map.tsx`) is plain SVG with suburb-level
positions and a hand-simplified harbour; it says "not to scale, positions
approximate" on screen. On phones the labels would collide, so the pins are
numbered and keyed underneath.

The only scroll-tied effect is the topic rings: when they start below the fold,
their arcs wait and fill as they scroll into view. Their percentages are shown
from the start. Nothing animates width, height or any other layout property. All of it sits inside
`@media (prefers-reduced-motion: no-preference)`, so for a reader who asked for
less motion it is never applied, rather than applied and shortened. Verified
both ways: with reduced motion the count-up starts on its final value, the
aurora and sparkline animations report `none`, view transitions run at zero
duration, and a changed property card gets a static outline instead of a glow.

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
