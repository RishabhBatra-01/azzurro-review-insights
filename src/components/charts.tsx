"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { VisuallyHidden } from "./visually-hidden";

/* ------------------------------------------------- average rating by property */

export type PropertyDatum = {
  name: string;
  short: string;
  average: number | null;
  reviews: number;
  band: "positive" | "neutral" | "negative" | null;
};

/**
 * One measure (average rating) across four properties, so this is a single
 * series — not four. Bars are coloured by the band the average falls in rather
 * than one hue per property: that reuses the sentiment scale used everywhere
 * else and makes "who is in the red" readable at a glance, instead of spending
 * four colours on decoration.
 */
/** Index under the pointer, from a Recharts mouse event; null when off-chart. */
export const hoveredIndex = (state: { activeTooltipIndex?: unknown }) => {
  const i = Number(state?.activeTooltipIndex);
  return Number.isInteger(i) && i >= 0 ? i : null;
};

/** Hovered bar at full strength, the rest eased back so it stands out. */
export const dimmed = (active: number | null, i: number) =>
  active === null || active === i ? 1 : 0.35;

function PropertyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: PropertyDatum }[];
}) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div
      className="chart-tip rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
      style={{ boxShadow: "var(--shadow-raised)" }}
    >
      <p className="font-semibold text-[var(--text)]">{d.name}</p>
      <p className="mt-1 text-[var(--text-secondary)]">
        {d.average === null ? (
          "No rated reviews this week"
        ) : (
          <>
            Average{" "}
            <span className="font-semibold text-[var(--text)]">
              {d.average.toFixed(2)}
            </span>{" "}
            / 10
          </>
        )}
      </p>
      <p className="text-[var(--muted)]">
        {d.reviews} review{d.reviews === 1 ? "" : "s"} this week
      </p>
    </div>
  );
}

export function RatingByProperty({
  data,
  highlight = null,
}: {
  data: PropertyDatum[];
  /** Index of the property the Overview is filtered to, kept at full
   *  strength while the others ease back. Hovering still takes over. */
  highlight?: number | null;
}) {
  const scored = data.filter((d) => d.average !== null);
  const [hovered, setActive] = useState<number | null>(null);
  const active = hovered ?? highlight;

  if (scored.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--muted)]">
        No rated reviews this week.
      </p>
    );
  }

  return (
    <>
      <div className="min-h-[216px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 22, right: 4, left: -6, bottom: 0 }}
            barCategoryGap="28%"
            onMouseMove={(state) => setActive(hoveredIndex(state))}
            onMouseLeave={() => setActive(null)}
          >
            {/* Band colour runs full strength at the top and eases off
                towards the baseline. The hue still names the band; the
                gradient only finishes the bar. Bottom stop kept at 75% so the
                faintest part still clears 3:1 on the card. */}
            <defs>
              {(["positive", "neutral", "negative"] as const).map((b) => (
                <linearGradient
                  key={b}
                  id={`rating-bar-${b}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={`var(--series-${b})`}
                    stopOpacity={1}
                  />
                  <stop
                    offset="100%"
                    stopColor={`var(--series-${b})`}
                    stopOpacity={0.75}
                  />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="2 5"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="short"
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval={0}
            />
            <YAxis
              domain={[0, 10]}
              ticks={[0, 2, 4, 6, 8, 10]}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              /* 34px, not the default: "10" was being clipped to "0". */
              width={34}
            />
            <Tooltip content={<PropertyTooltip />} cursor={false} />
            <Bar
              dataKey="average"
              radius={[8, 8, 3, 3]}
              isAnimationActive
              animationDuration={800}
              animationEasing="ease-out"
            >
              {data.map((d, i) => (
                <Cell
                  key={d.name}
                  fillOpacity={dimmed(active, i)}
                  fill={
                    d.band
                      ? `url(#rating-bar-${d.band})`
                      : "var(--border-strong)"
                  }
                />
              ))}
              <LabelList
                dataKey="average"
                position="top"
                offset={8}
                /* An explicit fill: Recharts otherwise paints the label in the
                   bar's own colour, and a value label wears ink, not data. */
                fill="var(--text)"
                fontSize={12}
                fontWeight={600}
                formatter={(v: unknown) =>
                  typeof v === "number" ? v.toFixed(1) : "—"
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <VisuallyHidden>
        <table>
          <caption>Average rating by property this week, out of 10</caption>
          <thead>
            <tr>
              <th scope="col">Property</th>
              <th scope="col">Average</th>
              <th scope="col">Reviews</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.name}>
                <th scope="row">{d.name}</th>
                <td>
                  {d.average === null
                    ? "no rated reviews"
                    : d.average.toFixed(1)}
                </td>
                <td>{d.reviews}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </>
  );
}

/* --------------------------------------------------------- weekly rating trend */

export type TrendDatum = {
  week: string;
  average: number | null;
  reviews: number;
};

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { payload?: TrendDatum }[];
  label?: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div
      className="chart-tip rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
      style={{ boxShadow: "var(--shadow-raised)" }}
    >
      <p className="font-semibold text-[var(--text)]">Week of {label}</p>
      <p className="mt-1 text-[var(--text-secondary)]">
        {point.average === null ? (
          "Not enough rated reviews"
        ) : (
          <>
            Average{" "}
            <span className="font-semibold text-[var(--text)]">
              {point.average.toFixed(2)}
            </span>{" "}
            / 10
          </>
        )}
      </p>
      <p className="text-[var(--muted)]">
        {point.reviews} review{point.reviews === 1 ? "" : "s"}
      </p>
    </div>
  );
}

/** A single series, so no legend: the panel heading names it. */
export function WeeklyRatingTrend({ data }: { data: TrendDatum[] }) {
  const scored = data.filter((d) => d.average !== null) as {
    average: number;
  }[];
  if (scored.length < 2) {
    return (
      <p className="py-10 text-center text-sm text-[var(--muted)]">
        Not enough weeks to plot a trend yet.
      </p>
    );
  }

  const values = scored.map((d) => d.average);
  // A rating scale pinned to 0–10 would flatten every real movement, so the
  // axis is padded around the actual range instead — and labelled, so a
  // reader can see it does not start at zero.
  const min = Math.max(0, Math.floor((Math.min(...values) - 0.4) * 2) / 2);
  const max = Math.min(10, Math.ceil((Math.max(...values) + 0.4) * 2) / 2);
  // Explicit, evenly spaced ticks. Recharts' automatic ticks collapsed to two
  // identical "5" labels on this range.
  const step = (max - min) / 4;
  const ticks = [0, 1, 2, 3, 4].map(
    (i) => Math.round((min + i * step) * 10) / 10,
  );

  return (
    <>
      <div className="min-h-[216px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -6, bottom: 0 }}
          >
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="0%"
                  stopColor="var(--data-line)"
                  stopOpacity={0.22}
                />
                <stop
                  offset="100%"
                  stopColor="var(--data-line)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="2 5"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              interval="preserveStartEnd"
              minTickGap={14}
            />
            <YAxis
              domain={[min, max]}
              ticks={ticks}
              tickFormatter={(v: number) => v.toFixed(1)}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              width={34}
            />
            <Tooltip
              content={<TrendTooltip />}
              cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            />
            <Area
              type="monotone"
              dataKey="average"
              stroke="var(--data-line)"
              strokeWidth={2}
              fill="url(#trendFill)"
              connectNulls={false}
              isAnimationActive
              animationDuration={800}
              animationEasing="ease-out"
              dot={{
                r: 3,
                fill: "var(--data-line)",
                stroke: "var(--surface)",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 5,
                fill: "var(--data-line)",
                stroke: "var(--surface)",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-[11px] text-[var(--muted)]">
        Axis is scaled to the range shown, not 0–10, so week-to-week movement
        stays visible.
      </p>

      <VisuallyHidden>
        <table>
          <caption>Portfolio average rating by week, out of 10</caption>
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">Average</th>
              <th scope="col">Reviews</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.week}>
                <th scope="row">{d.week}</th>
                <td>
                  {d.average === null
                    ? "not enough rated reviews"
                    : d.average.toFixed(2)}
                </td>
                <td>{d.reviews}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </>
  );
}
