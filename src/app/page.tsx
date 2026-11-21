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
import { CountUp, SpotlightField } from "../components/motion";
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
import { formatRange, formatRelativeDay, shortLabel } from "../lib/format";
import { TOPICS, TOPIC_LABELS, type Topic } from "../insights/topics";
import { band, LOW_DATA_THRESHOLD } from "../insights/scoring";
import { todayInSydney } from "../insights/weeks";
import type { TopicMovement } from "../insights/metrics";

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

export default async function OverviewPage() {
  const data = await loadOverview();
  const { overall, current, previous, coverage } = data;
  const today = todayInSydney();
  const nameOf = new Map(
    data.properties.map((p) => [p.id, p.assessment_label]),
  );
  const weekCount = data.weeks.length;

  const propertyData = data.byProperty.map((p) => {
    const name = nameOf.get(p.propertyId) ?? "Unknown";
    return {
      id: p.propertyId,
      name,
      short: shortLabel(name),
      average: p.current.average,
      reviews: p.current.reviewCount,
      band: band(p.current.average),
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
    <SpotlightField>
      <div className="space-y-8">
        {/* ------------------------------------------------------------ hero */}
        <PageHero
          eyebrow="Hotel review analytics"
          title="Portfolio Overview"
          subtitle="Guest review performance, trends and operational issues across the four Sydney properties."
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
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Pill>
              <CalendarBlank size={14} weight="duotone" aria-hidden="true" />
              {formatRange(current)} · Mon–Sun, Sydney
            </Pill>
            <Pill>
              <Buildings size={14} weight="duotone" aria-hidden="true" />
              {data.properties.length} properties
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
                <p className="eyebrow">Portfolio rating this week</p>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-2">
                <span className="numeral text-[3.5rem] leading-[0.9] sm:text-[4.25rem]">
                  {overall.current.average === null ? (
                    "—"
                  ) : (
                    <CountUp value={overall.current.average} decimals={2} />
                  )}
                </span>
                <span className="pb-1.5 text-sm text-[var(--muted)]">/ 10</span>
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
                  {weekCount}-week portfolio average · this week from{" "}
                  {overall.current.scoredCount} rated review
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
              label="Reviews this week"
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
              hint={`${overall.previous.reviewCount} the previous week`}
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
              href={`/reviews?property=${p.id}`}
              className="block"
            >
              <Card
                linked
                padded={false}
                className="spotlight group h-full p-4"
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
                        ? "no reviews this week"
                        : `${p.reviews} review${p.reviews === 1 ? "" : "s"} this week`}
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
                    <span className="text-xs text-[var(--muted)]">/ 10</span>
                  </span>
                  <Sparkline
                    values={p.trend}
                    label={`${p.name}: weekly average over the last ${weekCount} weeks`}
                    width={104}
                    height={34}
                  />
                </div>
              </Card>
            </Link>
          ))}
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
              note="this week"
              icon={<ChartBar size={17} weight="duotone" />}
            />
            <RatingByProperty data={propertyData} />
            <Note>
              Bars are coloured by band: blue 8 and above, grey 6&ndash;7.9, red
              below 6.
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
                  formatRange(point.range).split(" – ")[0] ?? point.range.start,
                average: point.average,
                reviews: point.reviewCount,
              }))}
            />
          </Card>

          <Card className="spotlight flex flex-col">
            <SectionHeading
              icon={<ChatCircleDots size={17} weight="duotone" />}
              title="Recent reviews"
              action={
                <Link
                  href="/reviews"
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
              <Note>No reviews collected yet.</Note>
            ) : (
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
                    <li key={r.id} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-2">
                        <Monogram name={r.reviewer_name ?? "Guest"} size={24} />
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
                    </li>
                  );
                })}
              </ul>
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
            subtitle="Topics guests raised more often than last week"
            movement={data.complaintMovement}
          />
          <MoverPanel
            kind="positive"
            title="Praise rising"
            subtitle="Topics guests praised more often than last week"
            movement={data.praiseMovement}
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
            note="share of each topic's mentions that were praise, this week"
          />
          <Card className="spotlight">
            {data.topics.stats.length === 0 ? (
              <Note>
                No reviews this week carried English text, so no topics could be
                read.
              </Note>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {data.topics.stats.slice(0, 8).map((t) => {
                  const Icon = TOPIC_ICON[t.topic];
                  const hue = `var(--topic-${t.topic})`;
                  const label = TOPIC_LABELS[t.topic];
                  return (
                    <li key={t.topic}>
                      <Link
                        href={`/reviews?topic=${t.topic}`}
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
                            percentage={t.positiveShare}
                            hue={hue}
                            lowData={t.lowData}
                            label={`${label}: ${Math.round(t.positiveShare)}% of ${t.mentions} mention${
                              t.mentions === 1 ? "" : "s"
                            } this week were praise`}
                          />
                        </span>
                        <span className="link-draw mt-3 inline-block text-[13px] font-semibold">
                          {label}
                        </span>
                        <span className="mt-1 block text-[11px] leading-relaxed text-[var(--muted)]">
                          {t.positive} praise · {t.negative} complaint
                          {t.negative === 1 ? "" : "s"}
                          {t.lowData ? (
                            <span className="block">too few to rely on</span>
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
                          not mentioned this week
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-5 border-t border-[var(--border)] pt-3">
              <Note>
                Out of <strong>{data.topics.denominator}</strong> review
                {data.topics.denominator === 1 ? "" : "s"} this week written in
                English with text.
                {data.topics.excluded > 0
                  ? ` ${data.topics.excluded} more had no text or were in another language and could not be read.`
                  : ""}
              </Note>
            </div>
          </Card>
        </section>

        {/* --------------------------------------------- volume & sentiment mix */}
        <section aria-label="Review volume" className="rise" style={entrance()}>
          <SectionHeading
            icon={<Stack size={17} weight="duotone" />}
            title="Review volume and sentiment mix"
            note={`last ${weekCount} weeks · hover a bar for the week's numbers`}
          />
          <Card className="spotlight">
            <TrendChart
              data={data.trend.map((point) => ({
                week:
                  formatRange(point.range).split(" – ")[0] ?? point.range.start,
                positive: point.bands.positive,
                neutral: point.bands.neutral,
                negative: point.bands.negative,
              }))}
            />
          </Card>
        </section>
      </div>
    </SpotlightField>
  );
}

function MoverPanel({
  kind,
  title,
  subtitle,
  movement,
}: {
  kind: "positive" | "negative";
  title: string;
  subtitle: string;
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
          writing this week.
        </p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {rows.map((r) => (
            <li key={r.topic}>
              <Link
                href={`/reviews?topic=${r.topic}&polarity=${kind}`}
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
              {movement.previousDenominator === 1 ? "" : "s"} the previous week.
            </>
          ) : (
            <>
              Not enough readable reviews to compare weeks:{" "}
              {movement.denominator} this week, {movement.previousDenominator}{" "}
              last week, and {LOW_DATA_THRESHOLD} is the minimum. Counts are
              shown instead.
            </>
          )}
        </Note>
      </div>
    </Card>
  );
}
