import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowsClockwise,
  Buildings,
  CalendarCheck,
  CaretDown,
  ChatCircleDots,
  Compass,
  Gauge,
  Lightbulb,
  ListChecks,
  MagnifyingGlass,
  PencilSimpleSlash,
  Prohibit,
  ShareNetwork,
  SquaresFour,
  Star,
  TextAa,
  Translate,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";

import { PageHero } from "../../components/hero";
import { SpotlightField } from "../../components/motion";
import { PAGE_NAV, PageTransition } from "../../components/page-transition";
import {
  Card,
  DeltaBadge,
  Monogram,
  Pill,
  Ring,
  Sparkline,
} from "../../components/ui";
import { LOW_DATA_THRESHOLD } from "../../insights/scoring";
import { TOPICS, TOPIC_LABELS } from "../../insights/topics";
import { TREND_WEEKS } from "../data";

export const metadata: Metadata = {
  title: "How to use — Azzurro Review Insights",
};

/**
 * A first-day guide for operations staff. Static: it explains the screens, it
 * does not read data. Thresholds and topic names are imported rather than
 * typed, and the example badges and rings are the dashboard's own components,
 * so the guide cannot drift from what the screens actually show.
 */

type Icon = typeof Star;

const SECTIONS: { id: string; title: string; icon: Icon; hue: string }[] = [
  { id: "purpose", title: "What it is for", icon: Compass, hue: "var(--accent)" },
  { id: "overview", title: "The Overview screen", icon: SquaresFour, hue: "var(--topic-room_condition)" },
  { id: "numbers", title: "What the numbers mean", icon: Gauge, hue: "var(--topic-check_in)" },
  { id: "reviews", title: "The Reviews screen", icon: ChatCircleDots, hue: "var(--topic-staff)" },
  { id: "tasks", title: "Everyday tasks", icon: ListChecks, hue: "var(--topic-cleanliness)" },
  { id: "freshness", title: "How fresh the data is", icon: ArrowsClockwise, hue: "var(--topic-facilities)" },
  { id: "questions", title: "Common questions", icon: Lightbulb, hue: "var(--topic-noise)" },
  { id: "limits", title: "What it cannot do", icon: Prohibit, hue: "var(--topic-value)" },
];

const HOTELS = [
  { name: "Olympic Hotel Paddington", booking: "Olympic Paddington Budget Hotel" },
  { name: "Potts Point", booking: "Venus Potts Point" },
  { name: "Central Sydney", booking: "Venus Surry Hills" },
  { name: "Darling Harbour", booking: "Azzurro Pod Hotel Darling Harbour" },
];

const strong = "font-semibold text-[var(--text)]";

/* ------------------------------------------------------------- building blocks */

function Section({ id, lead, children }: { id: string; lead?: ReactNode; children: ReactNode }) {
  const index = SECTIONS.findIndex((s) => s.id === id);
  const { title, icon: SectionIcon, hue } = SECTIONS[index]!;
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <Card className="spotlight" padded={false}>
        <div className="p-5 sm:p-7">
          <header className="flex items-start gap-3.5">
            <span
              aria-hidden="true"
              className="topic-tile h-11 w-11"
              style={{ ["--tile-hue" as string]: hue }}
            >
              <SectionIcon size={22} weight="duotone" />
            </span>
            <div className="min-w-0">
              <p className="eyebrow" style={{ color: hue }}>
                Part {String(index + 1).padStart(2, "0")}
              </p>
              <h2
                id={`${id}-title`}
                className="mt-0.5 font-[family-name:var(--font-display)] text-[1.75rem] leading-tight tracking-tight"
              >
                {title}
              </h2>
            </div>
          </header>
          {lead ? (
            <p className="mt-4 max-w-3xl text-[15px] leading-relaxed text-[var(--text-secondary)]">
              {lead}
            </p>
          ) : null}
          <div className="mt-5 space-y-5 text-sm leading-relaxed text-[var(--text-secondary)]">
            {children}
          </div>
        </div>
      </Card>
    </section>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="eyebrow pt-1 text-[var(--muted)]">{children}</h3>;
}

/** A term, what it means, and (optionally) the real component it describes. */
function Term({
  name,
  specimen,
  example,
  children,
}: {
  name: string;
  specimen?: ReactNode;
  example?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
      <div className="flex items-start justify-between gap-3">
        <dt className={strong}>{name}</dt>
        {specimen ? (
          <span className="shrink-0" aria-hidden="true">
            {specimen}
          </span>
        ) : null}
      </div>
      <dd className="mt-1.5">{children}</dd>
      {example ? (
        <dd className="mt-auto pt-3">
          <span className="block rounded-lg border-l-2 border-[var(--accent)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            <span className={strong}>Example </span>
            {example}
          </span>
        </dd>
      ) : null}
    </div>
  );
}

/** Numbered steps joined by a thin rail. */
function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="relative flex gap-3">
          {i < items.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute left-[13px] top-[30px] bottom-[-10px] w-px bg-[var(--border)]"
            />
          ) : null}
          <span
            aria-hidden="true"
            className="relative grid h-[27px] w-[27px] shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[12px] font-semibold text-[var(--accent)] ring-1 ring-inset ring-[var(--border)]"
          >
            {i + 1}
          </span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Go({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} transitionTypes={PAGE_NAV} className="link-draw font-medium text-[var(--text)]">
      {children}
    </Link>
  );
}

/** A task card: a question someone actually asks, the steps, and a shortcut. */
function Task({
  icon: TaskIcon,
  hue,
  title,
  steps,
  href,
  cta,
}: {
  icon: Icon;
  hue: string;
  title: string;
  steps: ReactNode[];
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span aria-hidden="true" className="topic-tile h-9 w-9" style={{ ["--tile-hue" as string]: hue }}>
          <TaskIcon size={18} weight="duotone" />
        </span>
        <h3 className={`leading-snug ${strong}`}>{title}</h3>
      </div>
      <Steps items={steps} />
      {href ? (
        <div className="mt-auto pt-4">
          <Link
            href={href}
            transitionTypes={PAGE_NAV}
            className="group inline-flex items-center gap-1.5 rounded-full bg-[var(--surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--text)] ring-1 ring-inset ring-[var(--border)] transition-colors hover:ring-[var(--border-strong)]"
          >
            {cta}
            <ArrowRight size={13} weight="bold" aria-hidden="true" className="m-arrow" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function Question({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] transition-colors open:bg-[var(--surface)]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3.5 font-semibold text-[var(--text)] [&::-webkit-details-marker]:hidden">
        {q}
        <CaretDown
          size={16}
          weight="bold"
          aria-hidden="true"
          className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180"
        />
      </summary>
      <p className="px-4 pb-4 text-[var(--text-secondary)]">{children}</p>
    </details>
  );
}

/** A small icon-led fact card, used for the "at a glance" rows. */
function Fact({ icon: FactIcon, hue, title, children }: { icon: Icon; hue: string; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
      <FactIcon size={20} weight="duotone" aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: hue }} />
      <span>
        <span className={`block ${strong}`}>{title}</span>
        <span className="mt-0.5 block text-xs">{children}</span>
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------------ page */

export default function GuidePage() {
  const min = LOW_DATA_THRESHOLD;

  return (
    <PageTransition>
      <SpotlightField>
        <div className="space-y-6">
          <PageHero
            eyebrow="Help · for the operations team"
            title="How to use this dashboard"
            subtitle="Your first-day guide: what each screen shows, what every number means, and how to answer the questions you will ask most often. About ten minutes to read."
          >
            <ol className="mt-6 grid gap-3 sm:grid-cols-3">
              {[
                { icon: CalendarCheck, title: "Pick a hotel and week", text: "Filters at the top of the Overview." },
                { icon: Star, title: "Read the headline", text: "Rating, change on last week, top complaint." },
                { icon: ChatCircleDots, title: "Read the reviews", text: "Click any card, tile or topic to see them." },
              ].map((s, i) => (
                <li key={s.title} className="glass flex items-start gap-3 p-4">
                  <span className="numeral text-[1.9rem] leading-none text-[var(--accent)]">{i + 1}</span>
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      <s.icon size={15} weight="duotone" aria-hidden="true" />
                      {s.title}
                    </span>
                    <span className="mt-0.5 block text-xs text-[var(--text-secondary)]">{s.text}</span>
                  </span>
                </li>
              ))}
            </ol>
          </PageHero>

          <div className="grid gap-6 xl:grid-cols-[200px_minmax(0,1fr)]">
            {/* Contents: a sticky rail on wide screens, a wrap of chips below. */}
            <nav aria-label="On this page" className="xl:sticky xl:top-6 xl:self-start">
              <p className="eyebrow mb-2 hidden px-2 xl:block">On this page</p>
              <ul className="flex flex-wrap gap-2 xl:flex-col xl:gap-0.5">
                {SECTIONS.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#${s.id}`}
                      className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text)] xl:rounded-lg xl:border-transparent xl:bg-transparent xl:px-2 xl:py-2 xl:text-[13px] xl:hover:bg-[var(--surface)]"
                    >
                      <span aria-hidden="true" className="hidden w-5 text-[11px] tabular-nums text-[var(--muted)] xl:inline">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <s.icon size={15} weight="duotone" aria-hidden="true" style={{ color: s.hue }} />
                      {s.title}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="min-w-0 space-y-6">
              <Section
                id="purpose"
                lead="This dashboard shows what guests say about our four Sydney hotels on Booking.com: how each hotel is rated this week, whether that is better or worse than last week, and what guests keep praising or complaining about."
              >
                <ul className="grid gap-3 sm:grid-cols-3">
                  <Fact icon={ChatCircleDots} hue="var(--accent)" title="Real reviews">
                    Copied from each hotel&apos;s public Booking.com page every morning.
                  </Fact>
                  <Fact icon={Gauge} hue="var(--accent)" title="Counted, not guessed">
                    Every number is counted from those reviews. Nothing is estimated.
                  </Fact>
                  <Fact icon={MagnifyingGlass} hue="var(--accent)" title="Always traceable">
                    Click a figure to read the reviews behind it.
                  </Fact>
                </ul>

                <SubHeading>Our hotels and their Booking.com names</SubHeading>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {HOTELS.map((h) => (
                    <li key={h.name} className="flex min-w-0 items-center gap-3 rounded-xl border border-[var(--border)] p-3">
                      <Monogram name={h.name} size={34} />
                      <span className="min-w-0">
                        <span className={`block ${strong}`}>{h.name}</span>
                        <span className="block truncate text-xs text-[var(--muted)]">On Booking.com: {h.booking}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section
                id="overview"
                lead={
                  <>
                    <Go href="/">Portfolio Overview</Go> is the home screen. It reads from top to bottom, from the big
                    picture down to individual topics.
                  </>
                }
              >
                <Steps
                  items={[
                    <>
                      <span className={strong}>Filters</span> in the dark band: pick one hotel or all, and a week, then
                      press <span className={strong}>Show</span>. The whole page follows your choice.{" "}
                      <span className={strong}>Back to this week, all properties</span> resets it.
                    </>,
                    <>
                      <span className={strong}>Headline figures</span>: the week&apos;s average rating, the previous
                      week, the change, how many reviews arrived, and how many could be read for topics.
                    </>,
                    <>
                      <span className={strong}>Hotel cards</span>: each hotel&apos;s average, its change on the week
                      before, and a small line for the last {TREND_WEEKS} weeks. Click a card for that hotel&apos;s
                      reviews.
                    </>,
                    <>
                      <span className={strong}>Map, Rating by property and Weekly rating trend</span>: the same averages
                      drawn as pins, bars and a line. Hover or tap for exact numbers.
                    </>,
                    <>
                      <span className={strong}>Recent reviews</span>, then <span className={strong}>Complaints rising</span>{" "}
                      and <span className={strong}>Praise rising</span>: which topics guests mention more than the week
                      before.
                    </>,
                    <>
                      <span className={strong}>Operational topics</span>: the top complaint and top praise as sentences,
                      then a tile per topic. Last, <span className={strong}>Review volume and sentiment mix</span> shows
                      how many reviews came in each week.
                    </>,
                  ]}
                />
                <p className="rounded-xl bg-[var(--surface-sunken)] px-4 py-3 text-xs">
                  The sidebar links <span className={strong}>Property Comparison</span>,{" "}
                  <span className={strong}>Trends &amp; Themes</span> and{" "}
                  <span className={strong}>Operational Topics</span> jump straight to those parts of the Overview.
                </p>
              </Section>

              <Section
                id="numbers"
                lead={
                  <>
                    Ratings are out of 10, the scale Booking.com uses. A{" "}
                    <span className={strong}>week runs Monday to Sunday, Sydney time</span>, and a review counts in the
                    week it was written, not the week the guest stayed. The badges and rings below are the
                    dashboard&apos;s own, shown with example values.
                  </>
                }
              >
                <SubHeading>Colours</SubHeading>
                <div className="grid gap-3 sm:grid-cols-3">
                  {(
                    [
                      ["positive", "Positive", "8 or more"],
                      ["neutral", "Neutral", "6 to 7.9"],
                      ["negative", "Negative", "below 6"],
                    ] as const
                  ).map(([tone, name, range]) => (
                    <div key={tone} className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)]">
                      <div aria-hidden="true" className="h-1.5" style={{ background: `var(--series-${tone})` }} />
                      <div className="flex items-center justify-between gap-2 p-3.5">
                        <span className={strong}>{name}</span>
                        <Pill tone={tone}>{range}</Pill>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-xs">
                  Used for hotel cards, map pins, bars and review cards. Changes also carry an arrow and a sign, so you
                  never have to rely on colour alone.
                </p>

                <SubHeading>Headline figures</SubHeading>
                <dl className="grid gap-3 md:grid-cols-2">
                  <Term
                    name="Rating this week"
                    specimen={<Sparkline values={[6.1, 5.8, 6.4, 6.0, 5.6, 5.3]} label="Example trend line" width={84} height={26} />}
                    example="5.29 / 10 is the average score of every rated review written this week."
                  >
                    A plain average of the scores in reviews written this week. Reviews without a score are left out of
                    the average. The line beside it shows the last {TREND_WEEKS} weeks.
                  </Term>
                  <Term
                    name="Week over week"
                    specimen={<DeltaBadge delta={-0.76} direction="down" />}
                    example="−0.76 means the average dropped by 0.76 points out of 10 since last week."
                  >
                    This week&apos;s average minus last week&apos;s. Green is better, red is worse.
                  </Term>
                  <Term name="Too few to compare" specimen={<DeltaBadge delta={null} direction="unknown" />}>
                    Shown instead of a change when either week has fewer than {min} rated reviews. A change based on
                    one or two guests would be misleading.
                  </Term>
                  <Term
                    name="Reviews this week"
                    specimen={<DeltaBadge delta={4} direction="up" decimals={0} />}
                    example="24 reviews, 4 more than last week."
                  >
                    How many reviews were written this week, including ones with only a score.
                  </Term>
                  <Term
                    name="Readable for topics"
                    specimen={<TextAa size={22} weight="duotone" className="text-[var(--topic-check_in)]" />}
                    example="46% means 11 of 24 reviews had English text we could read."
                  >
                    The share of reviews that topics can be read from: they need written text in English. Every topic
                    percentage on the page is out of these reviews.
                  </Term>
                  <Term
                    name="Percentage points (pts)"
                    specimen={<DeltaBadge delta={10} direction="up" suffix=" pts" decimals={0} upIsGood={false} />}
                    example="Going from 20% to 30% is +10 pts, not +50%."
                  >
                    The gap between two percentages, used wherever a share changes.
                  </Term>
                </dl>

                <SubHeading>Topics</SubHeading>
                <div className="flex flex-wrap gap-2">
                  {TOPICS.map((t) => (
                    <span
                      key={t}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] px-2.5 py-1 text-xs font-medium text-[var(--text)]"
                    >
                      <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: `var(--topic-${t})` }} />
                      {TOPIC_LABELS[t]}
                    </span>
                  ))}
                </div>
                <p>
                  Every review with English text is checked for these eight topics. Text in the{" "}
                  <span className={strong}>Liked</span> box counts as praise; text in the{" "}
                  <span className={strong}>Disliked</span> box counts as a complaint. One review can mention several
                  topics.
                </p>
                <dl className="grid gap-3 md:grid-cols-2">
                  <Term
                    name="Top complaint / Top praise"
                    example="“38% of the 8 reviews this week with a written complaint mentioned Cleanliness (3 of 8).”"
                  >
                    The topic mentioned most. It is out of reviews that wrote something in that box, not all reviews.
                    With fewer than {min} of them, it says there are too few to give a share.
                  </Term>
                  <Term
                    name="Topic tiles"
                    specimen={<Ring percentage={75} hue="var(--topic-cleanliness)" label="Example: 75% praise" size={46} />}
                    example="75% with “3 praise · 1 complaint”: 3 of the 4 mentions were positive."
                  >
                    Of all mentions of that topic, the share that were praise. Marked{" "}
                    <span className={strong}>too few to rely on</span> under {min} mentions.
                  </Term>
                  <Term
                    name="Complaints rising / Praise rising"
                    specimen={<DeltaBadge delta={15.8} direction="up" suffix=" pts" decimals={1} upIsGood={false} />}
                    example="Noise +15.8 pts: out of every 100 written complaints, 15.8 more mentioned noise than last week."
                  >
                    The change in each topic&apos;s share since last week. A complaint rising shows red; praise rising
                    shows green. With fewer than {min} readable reviews in either week, plain counts are shown instead.
                  </Term>
                </dl>
              </Section>

              <Section
                id="reviews"
                lead={
                  <>
                    <Go href="/reviews">Reviews</Go> lists every collected review, newest first, 25 to a page.
                  </>
                }
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <SubHeading>Filtering</SubHeading>
                    <div className="mt-3">
                      <Steps
                        items={[
                          <>
                            Set any of <span className={strong}>Property</span>, <span className={strong}>Rating</span>,{" "}
                            <span className={strong}>Topic</span>, <span className={strong}>From / To</span> and{" "}
                            <span className={strong}>Search text</span>.
                          </>,
                          <>
                            Press <span className={strong}>Apply filters</span>. The count at the top right shows how
                            many match.
                          </>,
                          <>
                            Active filters show as tags. Remove one with its <span className={strong}>×</span>, or press{" "}
                            <span className={strong}>Clear</span>.
                          </>,
                        ]}
                      />
                    </div>
                    <p className="mt-4 flex gap-2 rounded-xl bg-[var(--surface-sunken)] px-3.5 py-3 text-xs">
                      <WarningCircle size={16} weight="duotone" aria-hidden="true" className="mt-px shrink-0 text-[var(--topic-check_in)]" />
                      <span>
                        <span className={strong}>Search text</span> finds those exact letters in the title, Liked and
                        Disliked text. &ldquo;lift&rdquo; will not find &ldquo;elevator&rdquo;, so try both.
                      </span>
                    </p>
                  </div>

                  {/* A labelled sketch of a review card: layout only, no real review. */}
                  <div>
                    <SubHeading>Reading a review card</SubHeading>
                    <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4" style={{ boxShadow: "var(--shadow-card)" }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={strong}>
                            Review title <span className="font-normal text-[var(--muted)]">· Hotel</span>
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">Guest · country · trip type · room</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="numeral text-xl leading-none">
                            4.0<span className="ml-0.5 text-[11px] text-[var(--muted)]">/10</span>
                          </span>
                          <Pill tone="negative">Negative</Pill>
                        </div>
                      </div>
                      <div className="mt-3 space-y-1.5 border-t border-[var(--border)] pt-3 text-xs">
                        <p className="flex items-center gap-2">
                          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--series-positive)]" />
                          <span className={strong}>Liked</span> what the guest praised
                        </p>
                        <p className="flex items-center gap-2">
                          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-[var(--series-negative)]" />
                          <span className={strong}>Disliked</span> what the guest complained about
                        </p>
                      </div>
                      <p className="mt-3 rounded-lg border-l-2 border-[var(--accent)] bg-[var(--accent-soft)] px-3 py-2 text-xs">
                        <span className={strong}>Property replied</span> shown if the hotel answered
                      </p>
                    </div>
                    <p className="mt-3 text-xs text-[var(--muted)]">
                      Layout only, not a real review. A guest who wrote nothing shows &ldquo;Rating only&rdquo;; a review
                      in another language is marked as left out of topics.
                    </p>
                  </div>
                </div>
              </Section>

              <Section id="tasks" lead="The questions you are most likely to ask, and the quickest way to answer each.">
                <div className="grid gap-3 md:grid-cols-2">
                  <Task
                    icon={CalendarCheck}
                    hue="var(--topic-room_condition)"
                    title="Monday check: how did last week go?"
                    steps={[
                      "On the Overview, pick last week in Week and press Show.",
                      "Read the rating and Week over week.",
                      "Scan the hotel cards for red ones or big drops.",
                      "Click the Top complaint topic to read those reviews.",
                    ]}
                    href="/"
                    cta="Open the Overview"
                  />
                  <Task
                    icon={Buildings}
                    hue="var(--topic-facilities)"
                    title="How is one hotel doing?"
                    steps={[
                      "On the Overview, pick the hotel in Property and press Show.",
                      "Every figure now covers only that hotel.",
                      "Or click its card to go straight to its reviews.",
                    ]}
                    href="/?property=1"
                    cta="Try it with Paddington"
                  />
                  <Task
                    icon={MagnifyingGlass}
                    hue="var(--topic-cleanliness)"
                    title="Find one type of complaint"
                    steps={[
                      "Open Reviews.",
                      "Property: Potts Point. Topic: Cleanliness. Add dates for a period.",
                      "Optional: Rating: Negative, for unhappy guests only.",
                      "Press Apply filters.",
                    ]}
                    href="/reviews?property=2&topic=cleanliness&polarity=negative"
                    cta="Cleanliness complaints, Potts Point"
                  />
                  <Task
                    icon={ShareNetwork}
                    hue="var(--topic-staff)"
                    title="Show a colleague what you see"
                    steps={[
                      "Set the filters you want.",
                      "Copy the web address from your browser.",
                      "Send it: they see the same hotel, week and filters.",
                    ]}
                  />
                </div>
              </Section>

              <Section
                id="freshness"
                lead={
                  <>
                    New reviews are collected automatically <span className={strong}>every morning at 7am Sydney
                    time</span>. The small bar at the top of the Overview says when that last happened.
                  </>
                }
              >
                <ul className="grid gap-3 sm:grid-cols-3">
                  {[
                    { dot: "#22c55e", title: "Green dot", text: "The last collection worked for every hotel." },
                    {
                      dot: "#f87171",
                      title: "Red or amber dot",
                      text: "One or more hotels could not be collected. Their newest reviews may be missing until the next run. Saved reviews are kept.",
                    },
                    {
                      dot: "var(--accent)",
                      title: "Collect now",
                      text: "Where shown, fetches new reviews straight away. Takes a few minutes, shows progress, and can run once every 5 minutes.",
                    },
                  ].map((s) => (
                    <li key={s.title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface-sunken)] p-4">
                      <span className={`flex items-center gap-2.5 ${strong}`}>
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: s.dot, boxShadow: `0 0 0 4px color-mix(in srgb, ${s.dot} 22%, transparent)` }}
                        />
                        {s.title}
                      </span>
                      <p className="mt-1.5 text-xs">{s.text}</p>
                    </li>
                  ))}
                </ul>
                <p className="text-xs">
                  If new reviews arrive while the page is open, they slide in with a short-lived{" "}
                  <span className={strong}>New</span> tag.
                </p>
              </Section>

              <Section id="questions">
                <div className="space-y-2.5">
                  <Question q="Why is our rating different from the score on Booking.com?">
                    Booking.com&apos;s headline score covers a long period and is calculated their own way. This
                    dashboard shows a plain average of the reviews written in the week you picked, so it reacts quickly
                    to what recent guests said.
                  </Question>
                  <Question q="Why don't the topic numbers add up to the number of reviews?">
                    One review can mention several topics, and many mention none (a score with no text, for example).
                    Topic shares are out of readable reviews only.
                  </Question>
                  <Question q="Why are some reviews not counted in topics?">
                    Topics are read from English text. Reviews with only a score, or written in another language, still
                    count in the ratings but not in topics. &ldquo;Readable for topics&rdquo; shows how many were
                    included.
                  </Question>
                  <Question q="Why does a figure show “—” or “too few”?">
                    That week had fewer than {min} reviews to work with. Rather than show a number one guest could swing,
                    the dashboard says so. Smaller hotels often have quiet weeks; try a longer date range on the Reviews
                    screen.
                  </Question>
                  <Question q="A review mentions a topic but isn't tagged with it. Why?">
                    Topics are found by looking for set words and phrases (for example &ldquo;dirty&rdquo;,
                    &ldquo;stain&rdquo; and &ldquo;mould&rdquo; for cleanliness). A complaint worded unusually can be
                    missed, so always read the reviews before acting on a number.
                  </Question>
                </div>
              </Section>

              <Section id="limits">
                <ul className="grid gap-3 sm:grid-cols-2">
                  <Fact icon={ArrowsClockwise} hue="var(--topic-value)" title="Not live">
                    Collected once a day, and guests often write days or weeks after checking out. Use it to spot
                    patterns, not to handle a guest still in the hotel.
                  </Fact>
                  <Fact icon={Compass} hue="var(--topic-value)" title="Booking.com only">
                    Reviews on Google, TripAdvisor or other sites are not included.
                  </Fact>
                  <Fact icon={Translate} hue="var(--topic-value)" title="Topics read English only">
                    And by matching words, so some complaints are missed. Ratings include every review in every
                    language.
                  </Fact>
                  <Fact icon={PencilSimpleSlash} hue="var(--topic-value)" title="Read-only">
                    You cannot reply to guests or change reviews here. Replies are posted on Booking.com.
                  </Fact>
                </ul>
                <p className="text-xs text-[var(--muted)]">
                  Something looks wrong or confusing? Note the web address and what you expected to see, and pass it to
                  whoever looks after the dashboard.
                </p>
              </Section>
            </div>
          </div>
        </div>
      </SpotlightField>
    </PageTransition>
  );
}
