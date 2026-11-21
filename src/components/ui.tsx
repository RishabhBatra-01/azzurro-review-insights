import type { ReactNode } from "react";

/* ------------------------------------------------------------------ layout */

export function Card({
  children,
  className = "",
  raised = false,
  padded = true,
  linked = false,
}: {
  children: ReactNode;
  className?: string;
  raised?: boolean;
  padded?: boolean;
  /** Only set this when the whole card is a link. A card that does not lead
   *  anywhere must not react to the pointer, or it promises a click it has
   *  nothing to do with. */
  linked?: boolean;
}) {
  return (
    <div
      className={`border border-[var(--border)] bg-[var(--surface)] ${
        padded ? "p-5" : ""
      } ${linked ? "card-link" : ""} ${className}`}
      style={{
        borderRadius: "var(--radius-card)",
        boxShadow: raised ? "var(--shadow-raised)" : "var(--shadow-card)",
      }}
    >
      {children}
    </div>
  );
}

export function SectionHeading({
  title,
  note,
  action,
  icon,
}: {
  title: string;
  note?: string;
  action?: ReactNode;
  /** A small icon chip before the title, in the accent family. */
  icon?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
      <h2 className="flex items-center gap-2.5 font-[family-name:var(--font-display)] text-[1.6rem] leading-tight tracking-tight">
        {icon ? (
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent)]"
          >
            {icon}
          </span>
        ) : null}
        {title}
      </h2>
      {note ? <p className="text-xs text-[var(--muted)]">{note}</p> : null}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ numbers */

/**
 * A rating out of 10. An em dash — never a zero — when there is no score, so a
 * missing value can't be mistaken for a terrible one.
 */
export function Score({
  value,
  size = "md",
}: {
  value: number | null;
  size?: "sm" | "md" | "lg" | "hero";
}) {
  const scale = {
    sm: "text-xl",
    md: "text-[1.75rem] leading-none",
    lg: "text-4xl leading-none",
    hero: "text-[3.5rem] leading-[1.05] sm:text-[4rem]",
  }[size];

  if (value === null) {
    return (
      <span
        className={`numeral ${scale} text-[var(--muted)]`}
        aria-label="no score available"
      >
        —
      </span>
    );
  }

  return (
    <span className={`numeral ${scale}`}>
      {value.toFixed(1)}
      <span
        className={`ml-1 font-[family-name:var(--font-sans)] text-[var(--muted)] ${
          size === "hero" ? "text-base" : "text-xs"
        }`}
      >
        /10
      </span>
    </span>
  );
}

/**
 * Week-over-week change.
 *
 * Direction is carried three ways — an arrow, a signed number, and the words
 * "higher"/"lower" — so it survives colourblindness, greyscale printing and
 * screen readers. "Unknown" is stated, never flattened to zero.
 */
export function Delta({
  delta,
  direction,
  showWord = true,
}: {
  delta: number | null;
  direction: "up" | "down" | "flat" | "unknown";
  showWord?: boolean;
}) {
  if (delta === null || direction === "unknown") {
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px] text-[var(--muted)] ring-1 ring-inset ring-[var(--border)]">
        Not enough data to compare
      </span>
    );
  }

  const arrow = direction === "up" ? "▲" : direction === "down" ? "▼" : "◆";
  const word =
    direction === "up"
      ? "higher"
      : direction === "down"
        ? "lower"
        : "unchanged";
  const tone =
    direction === "up"
      ? "text-[var(--status-good)]"
      : direction === "down"
        ? "text-[var(--status-bad)]"
        : "text-[var(--muted)]";

  return (
    <span
      className={`inline-flex items-baseline gap-1 text-sm font-semibold ${tone}`}
    >
      <span aria-hidden="true" className="text-[0.7em]">
        {arrow}
      </span>
      <span>
        {delta > 0 ? "+" : ""}
        {delta.toFixed(2)}
      </span>
      {showWord ? (
        <span className="font-normal text-[var(--muted)]">
          {word} than last week
        </span>
      ) : (
        <span className="sr-only">{word} than last week</span>
      )}
    </span>
  );
}

/** A KPI tile: label, big value, and one line of context. */
export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "positive" | "neutral" | "negative";
}) {
  const rule = tone ? `var(--series-${tone})` : "var(--border-strong)";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-sunken)] p-3 sm:p-4">
      <div className="flex items-center gap-2">
        {/* A colour swatch beside the label, never colour on the label itself. */}
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 shrink-0 rounded-sm"
          style={{ background: rule }}
        />
        <p className="eyebrow">{label}</p>
      </div>
      <p className="numeral mt-2 text-[1.75rem] leading-none">{value}</p>
      {hint ? (
        <p className="mt-1.5 text-[11px] text-[var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- charts */

/**
 * Inline sparkline. Hand-rolled SVG rather than a chart library — it is twelve
 * points and one path, and this keeps it out of the client bundle.
 */
export function Sparkline({
  values,
  label,
  width = 132,
  height = 32,
  color = "var(--data-line)",
}: {
  values: (number | null)[];
  label: string;
  width?: number;
  height?: number;
  /** Defaults to the data-line token: a sparkline is data, never the accent. */
  color?: string;
}) {
  const points = values.filter((v): v is number => v !== null);
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = 3;

  // Nulls break the line rather than being drawn as zero.
  const segments: string[] = [];
  let open = false;
  values.forEach((v, i) => {
    if (v === null) {
      open = false;
      return;
    }
    const x = pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / span) * (height - pad * 2);
    segments.push(`${open ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`);
    open = true;
  });

  let lastIndex = -1;
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (values[i] !== null) {
      lastIndex = i;
      break;
    }
  }
  const last = values[lastIndex];
  const lastX =
    pad + (lastIndex / Math.max(1, values.length - 1)) * (width - pad * 2);
  const lastY =
    last === null || last === undefined
      ? 0
      : height - pad - ((last - min) / span) * (height - pad * 2);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <path
        className="spark-line"
        pathLength={1}
        d={segments.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* The latest point is marked, since "where it ends" is the question. */}
      {last !== null && last !== undefined ? (
        <circle
          className="spark-dot"
          cx={lastX}
          cy={lastY}
          r={3.5}
          fill={color}
          stroke="var(--surface)"
          strokeWidth={2}
        />
      ) : null}
    </svg>
  );
}

/** Horizontal proportion bar for topic breakdowns. */
export function Bar({ percentage, hue }: { percentage: number; hue?: string }) {
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full"
      style={{
        background: hue
          ? `color-mix(in srgb, ${hue} 14%, transparent)`
          : "var(--accent-soft)",
      }}
    >
      {/* Grows via scaleX rather than width so the fill cannot force layout. */}
      <div
        className="bar-fill h-full rounded-full"
        style={{
          width: `${Math.max(2, Math.min(100, percentage))}%`,
          background: hue ?? "var(--accent)",
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------- text */

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs leading-relaxed text-[var(--muted)]">{children}</p>
  );
}

export function Pill({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "positive" | "neutral" | "negative";
}) {
  const dot =
    tone === "default" ? null : (
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full"
        style={{ background: `var(--series-${tone})` }}
      />
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--surface-sunken)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] ring-1 ring-inset ring-[var(--border)]">
      {dot}
      {children}
    </span>
  );
}

/* ------------------------------------------------------------- KPI elements */

/**
 * A compact change indicator. Direction is carried by an arrow, a sign and a
 * screen-reader word as well as the tint, so it survives colourblindness and
 * greyscale.
 */
export function DeltaBadge({
  delta,
  direction,
  suffix = "",
  decimals = 2,
  upIsGood = true,
}: {
  delta: number | null;
  direction: "up" | "down" | "flat" | "unknown";
  suffix?: string;
  decimals?: number;
  /** False where rising is bad news, such as a complaint topic climbing. */
  upIsGood?: boolean;
}) {
  if (delta === null || direction === "unknown") {
    return (
      <span className="inline-flex items-center rounded-full bg-[var(--surface-sunken)] px-2 py-0.5 text-[11px] text-[var(--muted)] ring-1 ring-inset ring-[var(--border)]">
        Too few to compare
      </span>
    );
  }

  const up = direction === "up";
  const flat = direction === "flat";
  // The arrow always follows the number; only the tint follows the meaning.
  const good = up === upIsGood;
  const tone = flat
    ? "bg-[var(--surface-sunken)] text-[var(--muted)] ring-[var(--border)]"
    : good
      ? "bg-[var(--status-good-soft)] text-[var(--status-good)] ring-transparent"
      : "bg-[var(--status-bad-soft)] text-[var(--status-bad)] ring-transparent";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone}`}
    >
      {/* Nudges once in its own direction after the figures finish counting,
          so "down" reads as movement, not just a glyph. */}
      <span
        aria-hidden="true"
        className="delta-arrow text-[0.85em]"
        data-dir={flat ? undefined : up ? "up" : "down"}
      >
        {flat ? "◆" : up ? "▲" : "▼"}
      </span>
      {delta > 0 ? "+" : ""}
      {delta.toFixed(decimals)}
      {suffix}
      <span className="sr-only">
        {flat ? " unchanged" : up ? " higher" : " lower"} than the previous week
        {flat ? "" : good ? ", an improvement" : ", worse"}
      </span>
    </span>
  );
}

/** One headline figure, with the context needed to read it. */
export function KpiCard({
  icon,
  label,
  value,
  unit,
  badge,
  hint,
  tint,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  unit?: string;
  badge?: ReactNode;
  hint?: string;
  /** Identity hue for the icon tile. Marks what the figure is about; it never
   *  encodes whether the figure is good. */
  tint?: string;
}) {
  return (
    // A smoked-glass tile. Designed to sit inside the hero's .on-dark scope,
    // which supplies the light-on-dark ink and status colours it uses.
    <div className="glass group p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="topic-tile h-8 w-8"
          style={{ ["--tile-hue" as string]: tint ?? "var(--accent)" }}
        >
          {icon}
        </span>
        <p className="eyebrow min-w-0 truncate">{label}</p>
      </div>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="numeral text-[2rem] leading-none">{value}</span>
        {unit ? (
          <span className="text-xs text-[var(--muted)]">{unit}</span>
        ) : null}
        {badge ? <span className="ml-auto self-center">{badge}</span> : null}
      </div>

      {hint ? (
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** A square monogram, used where the reference design used a property photo. */
export function Monogram({ name, size = 36 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] font-[family-name:var(--font-display)] text-[var(--accent)]"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials || "?"}
    </span>
  );
}

/**
 * A donut showing one percentage. Used for topic sentiment, where a ring reads
 * a share more directly at small size than a bar does.
 *
 * The stroke carries the topic's identity hue, not a judgement colour: the
 * number says how positive the topic is, and the caption underneath gives the
 * raw praise/complaint counts. Keeping judgement out of this colour means we
 * never have to invent a "good share" threshold we cannot defend.
 */
export function Ring({
  percentage,
  hue,
  size = 52,
  label,
  lowData = false,
}: {
  percentage: number;
  hue: string;
  size?: number;
  label: string;
  /** Dims the ring when it rests on too few mentions, so the loudest mark on
   *  screen is never the least reliable one. A 100% ring drawn from a single
   *  review should not outshout a 60% ring drawn from five. */
  lowData?: boolean;
}) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percentage));
  const offset = circumference * (1 - clamped / 100);

  return (
    <span
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={hue}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ ["--ring-circumference" as string]: `${circumference}` }}
        />
      </svg>
      <span
        className="absolute text-[11px] font-semibold tabular-nums"
        style={{ color: lowData ? "var(--muted)" : "inherit" }}
      >
        {Math.round(clamped)}%
      </span>
    </span>
  );
}

/** A grey block standing in for content while a route loads. */
export function Skeleton({ className = "" }: { className?: string }) {
  const rounded = /(^|\s)rounded/.test(className) ? "" : "rounded-lg";
  return (
    <div className={`skeleton ${rounded} ${className}`} aria-hidden="true" />
  );
}

/** The dark hero band in skeleton form: title block left, status chip right. */
function HeroSkeleton({
  chipWidth,
  children,
}: {
  chipWidth: string;
  children: ReactNode;
}) {
  return (
    <div className="hero on-dark px-5 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start xl:gap-x-8">
        <div>
          <Skeleton className="h-3 w-40" />
          <Skeleton className="mt-3 h-11 w-72 max-w-full" />
          <Skeleton className="mt-3 h-4 w-[34rem] max-w-full" />
        </div>
        <Skeleton className={`h-10 rounded-full ${chipWidth} max-w-full`} />
      </div>
      {children}
    </div>
  );
}

/**
 * Route-level loading state. Shown the instant a nav link is clicked, so the
 * interface answers the click rather than sitting frozen until the query
 * returns. Each page has its own: the shape mirrors the real page, hero band
 * included, so nothing jumps when the data lands.
 */
export function PageSkeleton({
  variant = "overview",
}: {
  variant?: "overview" | "reviews";
}) {
  return (
    <div
      className={variant === "overview" ? "space-y-8" : "space-y-6"}
      role="status"
      aria-label="Loading"
    >
      {variant === "overview" ? (
        <>
          <HeroSkeleton chipWidth="w-[26rem]">
            <div className="mt-5 flex gap-2">
              <Skeleton className="h-7 w-56 rounded-full" />
              <Skeleton className="h-7 w-28 rounded-full" />
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
              <Skeleton className="h-[260px] rounded-[18px] sm:col-span-2 lg:col-span-1 lg:row-span-2 lg:h-auto" />
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[124px] rounded-[18px]" />
              ))}
            </div>
          </HeroSkeleton>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[118px] rounded-[16px]" />
            ))}
          </div>
          <Skeleton className="h-[360px] rounded-[16px]" />
        </>
      ) : (
        <>
          <HeroSkeleton chipWidth="w-48">
            <Skeleton className="mt-5 h-4 w-[40rem] max-w-full" />
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-7 w-44 rounded-full" />
              ))}
            </div>
          </HeroSkeleton>
          <Skeleton className="h-[150px] rounded-[16px]" />
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[170px] rounded-[16px]" />
          ))}
        </>
      )}
      <span className="sr-only">Loading dashboard data…</span>
    </div>
  );
}
