"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { dimmed, hoveredIndex } from "./charts";
import { VisuallyHidden } from "./visually-hidden";

export type TrendDatum = {
  week: string;
  positive: number;
  neutral: number;
  negative: number;
};

/**
 * Weekly review counts split by sentiment band.
 *
 * A stacked bar, because the question is both "how many reviews" and "what was
 * the mix" — and the two read together in one mark.
 *
 * Colour is the diverging scale (blue -> grey -> red), never green/red. Each
 * segment carries a 2px surface-coloured outline so adjacent bands stay
 * separable without relying on hue, and the legend plus a screen-reader table
 * mean identity is never colour-alone.
 */

const SERIES = [
  {
    key: "positive",
    label: "Positive",
    hint: "8 and above",
    color: "var(--series-positive)",
  },
  {
    key: "neutral",
    label: "Neutral",
    hint: "6 – 7.9",
    color: "var(--series-neutral)",
  },
  {
    key: "negative",
    label: "Negative",
    hint: "below 6",
    color: "var(--series-negative)",
  },
] as const;

type TooltipEntry = { name?: string; value?: number; color?: string };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, entry) => sum + (entry.value ?? 0), 0);

  return (
    <div
      className="chart-tip rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
      style={{ boxShadow: "var(--shadow-raised)" }}
    >
      <p className="mb-1.5 font-semibold text-[var(--text)]">Week of {label}</p>
      <table>
        <tbody>
          {[...payload].reverse().map((entry) => (
            <tr key={entry.name}>
              <td className="pr-2 align-middle">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ background: entry.color }}
                />
              </td>
              <td className="pr-3 text-[var(--text-secondary)]">
                {entry.name}
              </td>
              <td className="text-right font-semibold text-[var(--text)]">
                {entry.value}
              </td>
            </tr>
          ))}
          <tr className="border-t border-[var(--border)]">
            <td />
            <td className="pr-3 pt-1 text-[var(--muted)]">Total</td>
            <td className="pt-1 text-right font-semibold text-[var(--text)]">
              {total}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function TrendChart({ data }: { data: TrendDatum[] }) {
  const [active, setActive] = useState<number | null>(null);
  const empty = data.every((d) => d.positive + d.neutral + d.negative === 0);

  if (empty) {
    return (
      <p className="py-12 text-center text-sm text-[var(--muted)]">
        No reviews in the last {data.length} weeks.
      </p>
    );
  }

  return (
    <>
      {/* Legend above the plot, so identity is established before the marks. */}
      <ul className="mb-4 flex flex-wrap gap-x-5 gap-y-1.5">
        {SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-sm"
              style={{ background: s.color }}
            />
            <span className="font-medium text-[var(--text-secondary)]">
              {s.label}
            </span>
            <span className="text-[var(--muted)]">{s.hint}</span>
          </li>
        ))}
      </ul>

      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 4, left: -22, bottom: 0 }}
            barCategoryGap="22%"
            onMouseMove={(state) => setActive(hoveredIndex(state))}
            onMouseLeave={() => setActive(null)}
          >
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
              minTickGap={8}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "var(--muted)" }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "var(--accent-soft)", opacity: 0.55 }}
            />
            {SERIES.map((s, i) => (
              <Bar
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
                key={s.key}
                dataKey={s.key}
                stackId="bands"
                name={s.label}
                fill={s.color}
                /* 2px surface outline = the gap between stacked segments. */
                stroke="var(--surface)"
                strokeWidth={2}
                /* Round only the top of the topmost segment. */
                radius={i === SERIES.length - 1 ? [3, 3, 0, 0] : undefined}
              >
                {/* The hovered week stays full strength; the others ease
                    back, so the tooltip's week is obvious in the chart. */}
                {data.map((d, w) => (
                  <Cell key={d.week} fillOpacity={dimmed(active, w)} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* The same numbers, reachable without seeing the chart. */}
      <VisuallyHidden>
        <table>
          <caption>Weekly review counts by sentiment band</caption>
          <thead>
            <tr>
              <th scope="col">Week</th>
              <th scope="col">Positive</th>
              <th scope="col">Neutral</th>
              <th scope="col">Negative</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.week}>
                <th scope="row">{d.week}</th>
                <td>{d.positive}</td>
                <td>{d.neutral}</td>
                <td>{d.negative}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </>
  );
}
