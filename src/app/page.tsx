import Link from "next/link";
import {
  ArrowRight,
  Bed,
  ChartBar,
  ChartLineUp,
  Gauge,
  Stack,
  Buildings,
  CalendarBlank,
  ChatCircleDots,
  Key,
  MapPin,
  TextAa,
  Sparkle,
  SpeakerHigh,
  Star,
  Tag,
  TrendDown,
  TrendUp,
  Users,
} from "@phosphor-icons/react/dist/ssr";

import { loadOverview } from "./data";
import { PageHero } from "../components/hero";
import {
  CountUp,
  Flash,
  FreshBadge,
  FreshItem,
  FreshScope,
  Reveal,
  SpotlightField,
} from "../components/motion";
import { PAGE_NAV, PageTransition } from "../components/page-transition";
import { PropertyMap } from "../components/property-map";
import { OverviewFilters } from "../components/overview-filters";
import { selectableWeeks } from "./overview-view";
import { CollectionStatus } from "../components/collection-status";
import { collectionMode } from "../collector/trigger";
import {
  Bar,
  Card,
  DeltaBadge,
  KpiCard,
  Monogram,
  Note,
  Pill,
  Ring,
  SectionHeading,
  Sparkline,
} from "../components/ui";
import { RatingByProperty, WeeklyRatingTrend } from "../components/charts";
import { TrendChart } from "../components/trend-chart";
import {
  formatRange,
  formatDateLong,
  formatRelativeDay,
  formatWeek,
  shortLabel,
} from "../lib/format";
import { TOPICS, TOPIC_LABELS, type Topic } from "../insights/topics";
import { band, LOW_DATA_THRESHOLD } from "../insights/scoring";
import { todayInSydney } from "../insights/weeks";
import {
  topTopic,
  type TopicBreakdown,
  type TopicMovement,
} from "../insights/metrics";

export const dynamic = "force-dynamic";

const TOPIC_ICON: Record<Topic, typeof Sparkle> = {
  cleanliness: Sparkle,
  check_in: Key,
  staff: Users,
  noise: SpeakerHigh,
  facilities: Buildings,
  location: MapPin,
  room_condition: Bed,
  value: Tag,
};

type SearchParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const data = await loadOverview({
    property: one(params.property),
    week: one(params.week),
  });
  const { overall, current, previous, coverage, view } = data;
  const today = todayInSydney();
  const nameOf = new Map(
    data.properties.map((p) => [p.id, p.assessment_label]),
  );
  const weekCount = data.weeks.length;

  // What the page is showing, in words. Every label that used to say "this
  // week" or "portfolio" reads from here, so a filtered view never mislabels
  // itself as the default one.
  const selectedName =
    view.propertyId === null ? null : (nameOf.get(view.propertyId) ?? null);
  const scope = selectedName ?? "Portfolio";
  const scopeLower = selectedName ?? "portfolio";
  const words = view.isCurrentWeek
    ? {
        thisWeek: "this week",
        thisWeeks: "this week's",
        lastWeek: "last week",
        prevWeek: "the previous week",
      }
    : {
        thisWeek: "that week",
        thisWeeks: "that week's",
        lastWeek: "the week before",
        prevWeek: "the week before",
      };
  const weekLabel = view.isCurrentWeek
    ? "this week"
    : `, week of ${formatDateLong(current.start).replace(
        ` ${today.slice(0, 4)}`,
        "",
      )}`;

  // Links into the Reviews page carry the same property and, for a past week,
  // the same dates, so a drill-down shows the reviews behind the number.
  const reviewsHref = (extra: Record<string, string> = {}) => {
    const q = new URLSearchParams(extra);
    if (view.propertyId !== null) q.set("property", String(view.propertyId));
    if (!view.isCurrentWeek) {
      q.set("from", current.start);
      q.set("to", current.end);
    }
    const qs = q.toString();
    return qs ? `/reviews?${qs}` : "/reviews";
  };

  const propertyData = data.byProperty.map((p) => {
    const name = nameOf.get(p.propertyId) ?? "Unknown";
    return {
      id: p.propertyId,
      name,
      short: shortLabel(name),
      average: p.current.average,
      reviews: p.current.reviewCount,
      band: band(p.current.average),
      delta: p.delta,
      direction: p.direction,
      trend: data.propertyTrends.get(p.propertyId) ?? [],
    };
  });

  const collection = data.collection;
  const reviewChange =
    overall.current.reviewCount - overall.previous.reviewCount;

  /* One-shot entrance. The hero arrives first, then sections follow in
     reading order 60ms apart, so the page has settled in under a second. */
  let order = 1;
  const entrance = () => ({ animationDelay: `${order++ * 60}ms` });

  return (
    <PageTransition>
      <SpotlightField>
        <div className="space-y-8">
          {/* ------------------------------------------------------------ hero */}
          <PageHero
            eyebrow="Hotel review analytics"
            title="Portfolio Overview"
            subtitle={
              selectedName
                ? `Guest review performance, trends and operational issues for ${selectedName}.`
                : "Guest review performance, trends and operational issues across the four Sydney properties."
            }
            aside={
              collection?.lastFinishedAt ? (
                <CollectionStatus
                  status={{
                    ...collection,
                    lastFinishedAt: collection.lastFinishedAt,
                  }}
                  renderedAt={new Date().toISOString()}
                  collectMode={collectionMode()}
                />
              ) : null
            }
          >
            <OverviewFilters
              properties={data.properties}
              weeks={selectableWeeks()}
              propertyId={view.propertyId}
              weekStart={current.start}
              isDefault={view.propertyId === null && view.isCurrentWeek}
            />
            {/* States the view in words, so what the numbers cover is never left
    to the reader to infer from the controls. */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Pill>
                <CalendarBlank size={14} weight="duotone" aria-hidden="true" />
                {view.isCurrentWeek ? "This week" : "Week"}:{" "}
                {formatWeek(current, today.slice(0, 4))} · Mon–Sun, Sydney
              </Pill>
              <Pill>
                <Buildings size={14} weight="duotone" aria-hidden="true" />
                {selectedName ?? `All ${data.properties.length} properties`}
              </Pill>
            </div>

            {/* Bento: the headline rating takes the tall tile, the four
              supporting figures share the rest. */}
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
              <div className="glass flex flex-col p-5 sm:col-span-2 sm:p-6 lg:col-span-1 lg:row-span-2">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="topic-tile h-8 w-8"
                    style={{ ["--tile-hue" as string]: "var(--accent)" }}
                  >
                    <Star size={16} weight="duotone" />
                  </span>
                  <p className="eyebrow">
                    {scope} rating{view.isCurrentWeek ? " " : ""}
                    {weekLabel}
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2">
                  <span className="numeral text-[3.5rem] leading-[0.9] sm:text-[4.25rem]">
                    {overall.current.average === null ? (
                      "—"
                    ) : (
                      <CountUp value={overall.current.average} decimals={2} />
                    )}
                  </span>
                  <span className="pb-1.5 text-sm text-[var(--muted)]">
                    / 10
                  </span>
                  <span className="ml-auto pb-2">
                    <DeltaBadge
                      delta={overall.delta}
                      direction={overall.direction}
                    />
                  </span>
                </div>

                <div className="mt-auto pt-6">
                  <div className="[&_svg]:h-auto [&_svg]:w-full">
                    <Sparkline
                      values={data.overallAverages}
                      label={`Portfolio average rating over the last ${weekCount} weeks`}
                      width={360}
                      height={64}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--muted)]">
                    {weekCount}-week {scopeLower} average · {words.thisWeek}{" "}
                    from {overall.current.scoredCount} rated review
                    {overall.current.scoredCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>

              <KpiCard
                icon={<Star size={16} weight="duotone" />}
                tint="var(--muted)"
                label="Previous week"
                value={
                  overall.previous.average === null ? (
                    "—"
                  ) : (
                    <CountUp value={overall.previous.average} decimals={2} />
                  )
                }
                unit="/ 10"
                hint={formatRange(previous)}
              />
              <KpiCard
                icon={
                  overall.direction === "up" ? (
                    <TrendUp size={16} weight="duotone" />
                  ) : (
                    <TrendDown size={16} weight="duotone" />
                  )
                }
                tint={
                  overall.direction === "up"
                    ? "var(--status-good)"
                    : overall.direction === "down"
                      ? "var(--status-bad)"
                      : "var(--muted)"
                }
                label="Week over week"
                value={
                  overall.delta === null ? (
                    "—"
                  ) : (
                    <CountUp
                      value={overall.delta}
                      decimals={2}
                      prefix={overall.delta > 0 ? "+" : ""}
                    />
                  )
                }
                hint={
                  overall.delta === null
                    ? "one of the two weeks has too few rated reviews"
                    : "change in average rating"
                }
              />
              <KpiCard
                icon={<ChatCircleDots size={16} weight="duotone" />}
                tint="var(--topic-staff)"
                label={
                  view.isCurrentWeek ? "Reviews this week" : "Reviews that week"
                }
                value={<CountUp value={overall.current.reviewCount} />}
                badge={
                  <DeltaBadge
                    delta={reviewChange}
                    direction={
                      reviewChange === 0
                        ? "flat"
                        : reviewChange > 0
                          ? "up"
                          : "down"
                    }
                    decimals={0}
                  />
                }
                hint={`${overall.previous.reviewCount} ${words.prevWeek}`}
              />
              {/* The reference design's "review coverage" was a share of
                eligible stays. We hold no stay data, so this reports what we
                can prove: how much of the week the topic analysis can read. It
                is the denominator behind every topic percentage. */}
              <KpiCard
                icon={<TextAa size={16} weight="duotone" />}
                tint="var(--topic-check_in)"
                label="Readable for topics"
                value={<CountUp value={coverage.percentage} suffix="%" />}
                hint={`${coverage.classifiable} of ${coverage.total} reviews carry English text`}
              />
            </div>
          </PageHero>

          {/* -------------------------------------------------- property cards */}
          <section
            aria-label="Properties"
            className="rise grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            style={entrance()}
          >
            {propertyData.map((p) => (
              <Link
                key={p.id}
                href={
                  view.isCurrentWeek
                    ? `/reviews?property=${p.id}`
                    : `/reviews?property=${p.id}&from=${current.start}&to=${current.end}`
                }
                transitionTypes={PAGE_NAV}
                className="block"
              >
                {/* Glows once when this property's figures change on refresh,
                  e.g. after Collect now brings in new reviews. */}
                <Flash
                  watch={`${p.average}|${p.reviews}`}
                  className="h-full rounded-[var(--radius-card)]"
                >
                  <Card
                    linked
                    padded={false}
                    className={`spotlight group h-full p-4 ${
                      p.id === view.propertyId ? "selected-card" : ""
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {/* A monogram, not a photograph: we hold no licensed images
                      of these properties and will not borrow Booking.com's. */}
                      <Monogram name={p.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold leading-tight">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-[var(--muted)]">
                          {p.reviews === 0
                            ? `no reviews ${words.thisWeek}`
                            : `${p.reviews} review${p.reviews === 1 ? "" : "s"} ${words.thisWeek}`}
                        </p>
                      </div>
                      <ArrowRight
                        size={15}
                        weight="bold"
                        aria-hidden="true"
                        className="m-arrow shrink-0 text-[var(--muted)]"
                      />
                    </div>

                    <div className="mt-4 flex items-end justify-between gap-3">
                      <span className="flex flex-col gap-1.5">
                        <span className="flex items-baseline gap-1.5">
                          {p.band ? (
                            <span
                              aria-hidden="true"
                              className="h-2 w-2 self-center rounded-full"
                              style={{ background: `var(--series-${p.band})` }}
                            />
                          ) : null}
                          <span className="numeral text-[1.75rem] leading-none">
                            {p.average === null ? "—" : p.average.toFixed(1)}
                          </span>
                          <span className="text-xs text-[var(--muted)]">
                            / 10
                          </span>
                        </span>
                        {/* This property's own change on its previous week, from
                          the same comparison as the headline figure. */}
                        <span>
                          <DeltaBadge delta={p.delta} direction={p.direction} />
                        </span>
                      </span>
                      <Sparkline
                        values={p.trend}
                        label={`${p.name}: weekly average over the last ${weekCount} weeks`}
                        width={104}
                        height={34}
                      />
                    </div>
                  </Card>
                </Flash>
              </Link>
            ))}
          </section>

          {/* ------------------------------------------------------------- map */}
          <section
            aria-label="Property locations"
            className="rise"
            style={entrance()}
          >
            <Card className="spotlight">
              <SectionHeading
                icon={<MapPin size={17} weight="duotone" />}
                title="Where the properties are"
                note={`pins coloured by ${words.thisWeeks} rating band · select one for its reviews`}
              />
              <PropertyMap pins={propertyData} />
            </Card>
          </section>

          {/* ------------------------------------------------- charts + feed row */}
          <section
            id="properties"
            aria-label="Breakdown"
            className="rise grid gap-4 xl:grid-cols-[1fr_1.25fr_0.95fr]"
            style={entrance()}
          >
            <Card className="spotlight flex flex-col">
              <SectionHeading
                title="Rating by property"
                note={words.thisWeek}
                icon={<ChartBar size={17} weight="duotone" />}
              />
              <RatingByProperty
                data={propertyData}
                highlight={
                  view.propertyId === null
                    ? null
                    : propertyData.findIndex((p) => p.id === view.propertyId)
                }
              />
              <Note>
                Bars are coloured by band: blue 8 and above, grey 6&ndash;7.9,
                red below 6.
              </Note>
            </Card>

            <Card className="spotlight flex flex-col">
              <SectionHeading
                icon={<ChartLineUp size={17} weight="duotone" />}
                title="Weekly rating trend"
                note={`portfolio average, last ${weekCount} weeks`}
              />
              <WeeklyRatingTrend
                data={data.trend.map((point) => ({
                  week:
                    formatRange(point.range).split(" – ")[0] ??
                    point.range.start,
                  average: point.average,
                  reviews: point.reviewCount,
                }))}
              />
            </Card>

            <Card className="spotlight flex flex-col">
              <SectionHeading
                icon={<ChatCircleDots size={17} weight="duotone" />}
                title={
                  view.isCurrentWeek
                    ? "Recent reviews"
                    : "Latest reviews that week"
                }
                action={
                  <Link
                    href={reviewsHref()}
                    transitionTypes={PAGE_NAV}
                    className="link-draw m-arrow-next inline-flex items-center gap-1 text-xs font-semibold text-[var(--accent)]"
                  >
                    View all
                    <ArrowRight
                      size={13}
                      weight="bold"
                      aria-hidden="true"
                      className="m-arrow"
                    />
                  </Link>
                }
              />
              {data.recent.length === 0 ? (
                <Note>
                  {view.isCurrentWeek
                    ? "No reviews collected yet."
                    : "No reviews that week."}
                </Note>
              ) : (
                <FreshScope ids={data.recent.map((r) => r.id)}>
                  <ul className="divide-y divide-[var(--border)]">
                    {data.recent.map((r) => {
                      const tone = band(r.review_score);
                      // Show the side that matches the score. Always preferring the
                      // complaint made a 10/10 review read as "Dirty shower room".
                      const text =
                        tone === "positive"
                          ? (r.positive_text ?? r.negative_text)
                          : (r.negative_text ?? r.positive_text);
                      return (
                        <FreshItem
                          key={r.id}
                          id={r.id}
                          className="py-2.5 first:pt-0 last:pb-0"
                        >
                          <div className="flex items-center gap-2">
                            <Monogram
                              name={r.reviewer_name ?? "Guest"}
                              size={24}
                            />
                            <span className="numeral text-sm font-semibold">
                              {r.review_score === null
                                ? "—"
                                : r.review_score.toFixed(1)}
                            </span>
                            {tone ? (
                              <span
                                aria-hidden="true"
                                className="h-2 w-2 rounded-full"
                                style={{ background: `var(--series-${tone})` }}
                              />
                            ) : null}
                            <FreshBadge id={r.id} />
                            <span className="ml-auto text-[11px] text-[var(--muted)]">
                              {formatRelativeDay(r.reviewed_on_sydney, today)}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                            {text ?? (
                              <span className="text-[var(--muted)]">
                                Rating only — no written feedback.
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                            {nameOf.get(r.property_id) ?? "Unknown property"}
                          </p>
                        </FreshItem>
                      );
                    })}
                  </ul>
                </FreshScope>
              )}
            </Card>
          </section>

          {/* ----------------------------------------------------------- movers */}
          <section
            id="trends"
            aria-label="Topic movement"
            className="rise grid gap-4 lg:grid-cols-2"
            style={entrance()}
          >
            <MoverPanel
              kind="negative"
              title="Complaints rising"
              subtitle={`Topics guests raised more often than ${words.lastWeek}`}
              movement={data.complaintMovement}
              words={words}
              href={(topic) => reviewsHref({ topic, polarity: "negative" })}
            />
            <MoverPanel
              kind="positive"
              title="Praise rising"
              subtitle={`Topics guests praised more often than ${words.lastWeek}`}
              movement={data.praiseMovement}
              words={words}
              href={(topic) => reviewsHref({ topic, polarity: "positive" })}
            />
          </section>

          {/* -------------------------------------------------- operational topics */}
          <section
            id="topics"
            aria-label="Operational topics"
            className="rise"
            style={entrance()}
          >
            <SectionHeading
              icon={<Gauge size={17} weight="duotone" />}
              title="Operational topics"
              note={`share of each topic's mentions that were praise, ${words.thisWeek}`}
            />
            <Card className="spotlight">
              {data.topics.stats.length === 0 ? null : (
                <div className="mb-5 grid gap-3 border-b border-[var(--border)] pb-5 md:grid-cols-2">
                  <TopicHeadline
                    breakdown={data.complaints}
                    words={words}
                    href={(topic) =>
                      reviewsHref({ topic, polarity: "negative" })
                    }
                  />
                  <TopicHeadline
                    breakdown={data.praise}
                    words={words}
                    href={(topic) =>
                      reviewsHref({ topic, polarity: "positive" })
                    }
                  />
                  <p className="text-[11px] leading-relaxed text-[var(--muted)] md:col-span-2">
                    Each share is out of the English reviews with text in
                    Booking.com&apos;s &ldquo;Disliked&rdquo; (complaints) or
                    &ldquo;Liked&rdquo; (praise) box, not out of all reviews or
                    of reviews scored below 6: a review with no written
                    complaint cannot name a topic. A review can mention more
                    than one topic.
                  </p>
                </div>
              )}
              {data.topics.stats.length === 0 ? (
                <Note>
                  No reviews {words.thisWeek} carried English text, so no topics
                  could be read.
                </Note>
              ) : (
                <Reveal>
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {data.topics.stats.slice(0, 8).map((t) => {
                      const Icon = TOPIC_ICON[t.topic];
                      const hue = `var(--topic-${t.topic})`;
                      const label = TOPIC_LABELS[t.topic];
                      return (
                        <li key={t.topic}>
                          <Link
                            href={reviewsHref({ topic: t.topic })}
                            transitionTypes={PAGE_NAV}
                            className="group block h-full rounded-xl border border-[var(--border)] bg-[var(--surface-sunken)] p-3.5 transition-colors hover:border-[var(--border-strong)]"
                          >
                            <span className="flex items-start justify-between gap-2">
                              <span
                                aria-hidden="true"
                                className="topic-tile h-9 w-9"
                                style={{ ["--tile-hue" as string]: hue }}
                              >
                                <Icon size={17} weight="duotone" />
                              </span>
                              <Ring
                                percentage={(t.positive / t.mentions) * 100}
                                hue={hue}
                                lowData={t.lowData}
                                label={`${label}: ${Math.round((t.positive / t.mentions) * 100)}% of ${t.mentions} mention${
                                  t.mentions === 1 ? "" : "s"
                                } ${words.thisWeek} were praise`}
                              />
                            </span>
                            <span className="link-draw mt-3 inline-block text-[13px] font-semibold">
                              {label}
                            </span>
                            <span className="mt-1 block text-[11px] leading-relaxed text-[var(--muted)]">
                              {t.positive} praise · {t.negative} complaint
                              {t.negative === 1 ? "" : "s"}
                              {t.lowData ? (
                                <span className="block">
                                  too few to rely on
                                </span>
                              ) : null}
                            </span>
                          </Link>
                        </li>
                      );
                    })}

                    {/* Topics nobody wrote about this week. Worth showing: "no one
                  mentioned check-in" is a finding, and an absent card would
                  read as an oversight rather than an absence. */}
                    {TOPICS.filter(
                      (t) => !data.topics.stats.some((s) => s.topic === t),
                    ).map((topic) => {
                      const Icon = TOPIC_ICON[topic];
                      return (
                        <li key={topic}>
                          <div className="h-full rounded-xl border border-dashed border-[var(--border)] p-3.5">
                            <span className="flex items-start justify-between gap-2">
                              <span
                                aria-hidden="true"
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-[var(--surface-sunken)] text-[var(--muted)]"
                              >
                                <Icon size={17} weight="duotone" />
                              </span>
                            </span>
                            <span className="mt-3 inline-block text-[13px] font-semibold text-[var(--text-secondary)]">
                              {TOPIC_LABELS[topic]}
                            </span>
                            <span className="mt-1 block text-[11px] leading-relaxed text-[var(--muted)]">
                              not mentioned {words.thisWeek}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Reveal>
              )}
              <div className="mt-5 border-t border-[var(--border)] pt-3">
                <Note>
                  Out of <strong>{data.topics.denominator}</strong> review
                  {data.topics.denominator === 1 ? "" : "s"} {words.thisWeek}{" "}
                  written in English with text.
                  {data.topics.excluded > 0
                    ? ` ${data.topics.excluded} more had no text or were in another language and could not be read.`
                    : ""}
                </Note>
              </div>
            </Card>
          </section>

          {/* --------------------------------------------- volume & sentiment mix */}
          <section
            aria-label="Review volume"
            className="rise"
            style={entrance()}
          >
            <SectionHeading
              icon={<Stack size={17} weight="duotone" />}
              title="Review volume and sentiment mix"
              note={`last ${weekCount} weeks · hover a bar for the week's numbers`}
            />
            <Card className="spotlight">
              <TrendChart
                data={data.trend.map((point) => ({
                  week:
                    formatRange(point.range).split(" – ")[0] ??
                    point.range.start,
                  positive: point.bands.positive,
                  neutral: point.bands.neutral,
                  negative: point.bands.negative,
                }))}
              />
            </Card>
          </section>
        </div>
      </SpotlightField>
    </PageTransition>
  );
}

/**
 * The brief's example insight, in its own words: "38% of this week's written
 * complaints mentioned cleanliness". The count and denominator sit in the
 * sentence so the percentage can never be read without its base.
 */
function TopicHeadline({
  breakdown,
  words,
  href,
}: {
  breakdown: TopicBreakdown;
  words: { thisWeek: string };
  href: (topic: Topic) => string;
}) {
  const negative = breakdown.polarity === "negative";
  const top = topTopic(breakdown);
  const what = negative ? "a written complaint" : "written praise";
  const reviews = (n: number) => `${n} review${n === 1 ? "" : "s"}`;

  return (
    <div className="rounded-xl bg-[var(--surface-sunken)] p-4">
      <p className="eyebrow">{negative ? "Top complaint" : "Top praise"}</p>
      {top ? (
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          <span className="numeral text-2xl font-semibold text-[var(--text)]">
            {Math.round((top.count / top.denominator) * 100)}%
          </span>{" "}
          of the {reviews(top.denominator)} {words.thisWeek} with {what}{" "}
          mentioned{" "}
          {top.topics.map((topic, i) => (
            <span key={topic}>
              {i === 0 ? "" : i === top.topics.length - 1 ? " and " : ", "}
              <Link
                href={href(topic)}
                transitionTypes={PAGE_NAV}
                className="link-draw font-semibold text-[var(--text)]"
              >
                {TOPIC_LABELS[topic].toLowerCase()}
              </Link>
            </span>
          ))}{" "}
          ({top.count} of {top.denominator}).
        </p>
      ) : (
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
          {breakdown.denominator === 0
            ? `No reviews ${words.thisWeek} had ${what} in English.`
            : `Only ${reviews(breakdown.denominator)} ${words.thisWeek} had ${what} in English, too few to give a share.`}
        </p>
      )}
    </div>
  );
}

function MoverPanel({
  kind,
  title,
  subtitle,
  movement,
  words,
  href,
}: {
  kind: "positive" | "negative";
  title: string;
  subtitle: string;
  words: { thisWeek: string; lastWeek: string; prevWeek: string };
  /** Reviews page link for a topic, carrying the Overview's current view. */
  href: (topic: string) => string;
  movement: {
    movers: TopicMovement[];
    denominator: number;
    previousDenominator: number;
  };
}) {
  const Icon = kind === "negative" ? TrendDown : TrendUp;

  // Biggest movers first; with no comparison available, fall back to the
  // topics most mentioned this week so the panel is still useful.
  const rows = [...movement.movers]
    .sort((a, b) =>
      a.deltaPoints !== null && b.deltaPoints !== null
        ? b.deltaPoints - a.deltaPoints
        : b.current - a.current,
    )
    .slice(0, 4);

  const comparable = rows.some((r) => r.deltaPoints !== null);

  return (
    <Card className="spotlight flex flex-col">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{
            background:
              kind === "negative"
                ? "var(--status-bad-soft)"
                : "var(--status-good-soft)",
            color:
              kind === "negative" ? "var(--status-bad)" : "var(--status-good)",
          }}
        >
          <Icon size={16} weight="duotone" />
        </span>
        <div>
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">{subtitle}</p>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="mt-5 text-sm text-[var(--muted)]">
          Nothing {kind === "negative" ? "complained about" : "praised"} in
          writing {words.thisWeek}.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map((r) => (
            <li key={r.topic}>
              <Link
                href={href(r.topic)}
                transitionTypes={PAGE_NAV}
                className="group flex items-center justify-between gap-3 rounded -mx-1 px-1 py-1 text-sm transition-colors hover:bg-[var(--surface-sunken)]"
              >
                <span className="flex min-w-0 items-center gap-2">
                  {(() => {
                    const Icon = TOPIC_ICON[r.topic];
                    return (
                      <Icon
                        size={15}
                        weight="duotone"
                        aria-hidden="true"
                        className="shrink-0 text-[var(--muted)]"
                      />
                    );
                  })()}
                  <span className="link-draw truncate font-medium">
                    {TOPIC_LABELS[r.topic]}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[11px] text-[var(--muted)]">
                    {r.current} of {movement.denominator}
                  </span>
                  <DeltaBadge
                    delta={r.deltaPoints}
                    direction={
                      r.deltaPoints === null
                        ? "unknown"
                        : r.deltaPoints > 0
                          ? "up"
                          : r.deltaPoints < 0
                            ? "down"
                            : "flat"
                    }
                    suffix=" pts"
                    decimals={1}
                    upIsGood={kind === "positive"}
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto pt-4">
        <Note>
          {comparable ? (
            <>
              Change in percentage points against {movement.previousDenominator}{" "}
              readable review
              {movement.previousDenominator === 1 ? "" : "s"} {words.prevWeek}.
            </>
          ) : (
            <>
              Not enough readable reviews to compare weeks:{" "}
              {movement.denominator} {words.thisWeek},{" "}
              {movement.previousDenominator} {words.lastWeek}, and{" "}
              {LOW_DATA_THRESHOLD} is the minimum. Counts are shown instead.
            </>
          )}
        </Note>
      </div>
    </Card>
  );
}
