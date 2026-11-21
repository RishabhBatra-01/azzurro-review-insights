# Insights: method, definitions and measured quality

The short version is in the [README](../README.md#how-the-insights-work). This page has the full method, the numbers behind it and what was checked.

## Definitions

These choices are deliberate and are stated on screen as well as here.

| Thing | Definition |
| --- | --- |
| Week | **Monday 00:00 – Sunday 23:59, Australia/Sydney** |
| Current week | the week containing today in Sydney, unless another week is picked on the Overview |
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

This matters more than it sounds. Across all 9,284 collected reviews:

| | |
| --- | --- |
| Reviews with **no written text at all** | **3,761 (40.5%)** |
| Labelled English (`en`) by Booking.com | **4,795 (51.6%)** |
| Labelled `xu` (language not identified) | **1,800 (19.4%)** |
| Labelled another language (`fr`, `es`, `de`, `ja`, `xt`…) | **2,689 (29.0%)** |
| **Readable for topics** (English, with text) | **4,060 (43.7%)** |
| Reviews **missing a score** | **0** |

So **ratings and week-over-week trends use 100% of reviews**, but **topic
analysis can only ever cover about 44%**. A naive implementation would run an
English keyword list over everything, find nothing in the French reviews, and
report that as "no issues mentioned", understating every topic by more than
half.

### Which reviews count as English

Booking.com labels each review with a language code. `en` is trusted. But
about one review in five is labelled **`xu`**, which appears to mean "language
not identified" (Booking.com does not document it). Reading them showed most
are plainly English, for example *"great location | had a little problem with
the robo check in…"*. Excluding them threw away over a quarter of the usable text (1,081 of 4,060).

So for `xu` reviews the **text decides** (`isEnglish` in
`src/insights/topics.ts`): the letters must be at least 90% Latin script, and
the text must contain at least as many common English short words ("the",
"was", "very"…) as common French, Spanish, German, Italian, Dutch, Portuguese
or Scandinavian ones. Every other language code stays excluded, including
`xt`, which turned out to be mostly Chinese.

Result: **1,081 of the 1,085 `xu` reviews with text are now read**, raising the
readable total from 2,979 to 4,060. The 4 still excluded were checked by eye:
two are just "-", two are Chinese. The review page no longer marks an English
`xu` review as "written in another language".

Limit: a short `xu` review in another Latin-script language that uses none of
the listed words (e.g. one word like "Perfetto") passes the check. It then
simply matches no English topic, so it inflates a denominator by one rather
than creating a wrong tag.

### The headline insight

The Overview leads the topics section with the brief's example, in its form:

> **39%** of the 18 reviews that week with a written complaint mentioned
> **facilities** (7 of 18).

and the same for praise. The count and denominator are always in the sentence.
**"Negative" here means a review with text in the Disliked box, not a review
scored below 6**, and the page says so: a low score with no written text cannot
name a topic, and a high score can still carry a complaint. If fewer than 3
reviews had a written complaint, it says that instead of showing a percentage.
Ties name every tied topic. The sentence follows the property and week filters,
and each topic in it links to the reviews behind it.

### Classifier quality — what was actually measured

A sample of 35 classified English reviews was read back and checked against the
text. Findings:

**Fixed:** bare `"area"` was matching "dining area", "communal area" and
"sitting area" and tagging them as *location*. It was removed from the lexicon
(`local area` / `surrounding area` kept), which removed **36 incorrect tags**
across the dataset. Regression tests pin this.

**Fixed:** `"hair"` (for "hair in the shower") was matching **"hair dryer"**:
5 of the 8 cleanliness tags it produced were complaints about a missing hair
dryer. "Hair dryer" is now read as one word and counts as *facilities*; real
hair complaints stay *cleanliness*. Tested both ways.

**Known, unfixed — polarity comes from which field the text sits in:**

- A guest wrote *"It was clean"* in the **disliked** box. Tagged
  `cleanliness/negative`. The field placement is wrong, and we trust the field.
- *"Check-in had a small hiccup, but the staff resolved it quickly"* sits in the
  disliked box, so `staff` is tagged negative although the staff were praised.

- A guest who writes *"None, everything was clean"* in the **disliked** box gets
  a `cleanliness/negative` tag. Rare: 12 of 9,902 tags come from disliked text
  starting "nothing", "none" or "no complaints".

Keyword matching cannot fix these, because they are about sentiment *within* a
field. They are genuine limitations, not bugs.

**Other known limitations:**

- Paraphrasing is missed — "the room smelled" only matches via "smell".
- Negation is not handled — "not clean" and "very clean" both match cleanliness.
  Tolerable only because polarity comes from the field, not the wording.
- Topic tags are derived data in their own table and can be rebuilt at any time
  with `npm run classify -- --all`.
