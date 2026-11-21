import Link from "next/link";

import { PAGE_NAV } from "./page-transition";

type Pin = {
  id: number;
  name: string;
  average: number | null;
  reviews: number;
  band: "positive" | "neutral" | "negative" | null;
};

/*
 * Approximate suburb-level positions (latitude, longitude), keyed by the
 * label used across the dashboard. Deliberately coarse: this is a stylised
 * map to orient the reader, not a street map, and the page says so.
 */
const PLACES: Record<string, [number, number]> = {
  "Olympic Hotel Paddington": [-33.8905, 151.224],
  "Potts Point": [-33.872, 151.225],
  "Central Sydney": [-33.883, 151.209],
  "Darling Harbour": [-33.876, 151.2],
};

// The map frame, in degrees. Squashed vertically to fit a wide card, which is
// why the page says "not to scale".
const W = 1000;
const H = 360;
const LON = [151.175, 151.247] as const;
const LAT = [-33.852, -33.895] as const;

const project = ([lat, lon]: [number, number]) => ({
  x: ((lon - LON[0]) / (LON[1] - LON[0])) * W,
  y: ((lat - LAT[0]) / (LAT[1] - LAT[0])) * H,
});

/*
 * The harbour's southern shore, west to east, at roughly suburb accuracy:
 * Johnstons Bay, Darling Harbour, Sydney Cove, Farm Cove, Woolloomooloo,
 * Elizabeth Bay and Rushcutters Bay. Simplified on purpose.
 */
const SHORE: [number, number][] = [
  [-33.864, 151.175],
  [-33.865, 151.181],
  [-33.873, 151.1865],
  [-33.865, 151.1905],
  [-33.8615, 151.1935],
  [-33.865, 151.1972],
  [-33.8755, 151.2003],
  [-33.865, 151.2033],
  [-33.858, 151.2035],
  [-33.8555, 151.208],
  [-33.8612, 151.2113],
  [-33.856, 151.2145],
  [-33.8612, 151.2177],
  [-33.858, 151.2215],
  [-33.8695, 151.2232],
  [-33.861, 151.2262],
  [-33.8705, 151.2295],
  [-33.867, 151.2315],
  [-33.8755, 151.2337],
  [-33.866, 151.2385],
  [-33.863, 151.247],
];

/** The water above the shoreline, smoothed with a Catmull-Rom spline. */
function harbourPath(): string {
  const pts = SHORE.map(project);
  let d = `M0,0 L${W},0 L${pts.at(-1)!.x},${pts.at(-1)!.y}`;
  // Walk east to west so the shape closes back at the top-left corner.
  const rev = [...pts].reverse();
  for (let i = 0; i < rev.length - 1; i += 1) {
    const p0 = rev[Math.max(0, i - 1)]!;
    const p1 = rev[i]!;
    const p2 = rev[i + 1]!;
    const p3 = rev[Math.min(rev.length - 1, i + 2)]!;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return `${d} L0,0 Z`;
}

const HARBOUR = harbourPath();

const ringLabel = (p: Pin) =>
  p.average === null
    ? `${p.name}: no rated reviews this week`
    : `${p.name}: ${p.average.toFixed(1)} out of 10 this week, from ${p.reviews} review${p.reviews === 1 ? "" : "s"}`;

/**
 * Where the four properties sit, each pin coloured by this week's rating band
 * (the same scale as every chart) and linking to that property's reviews.
 */
export function PropertyMap({ pins }: { pins: Pin[] }) {
  const placed = pins
    .map((p, i) => {
      const at = PLACES[p.name];
      return at ? { ...p, ...project(at), i } : null;
    })
    .filter((p) => p !== null);

  return (
    <>
      <div className="property-map relative overflow-hidden rounded-[14px] border border-[var(--border)] bg-[var(--surface-sunken)]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full"
          role="img"
          aria-label="Stylised map of central Sydney showing the four properties"
        >
          <defs>
            <pattern
              id="map-grid"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M24 0H0V24"
                fill="none"
                stroke="var(--border)"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="url(#map-grid)" />
          <path d={HARBOUR} className="map-water" />
          <text x="420" y="34" className="map-label" textAnchor="middle">
            Sydney Harbour
          </text>
          <text x="505" y="190" className="map-label" textAnchor="middle">
            CBD
          </text>
        </svg>

        {/* Pins are HTML over the SVG, so each is a real, focusable link. */}
        <ul>
          {placed.map((p) => (
            <li
              key={p.id}
              className="map-pin"
              style={{
                left: `${(p.x / W) * 100}%`,
                top: `${(p.y / H) * 100}%`,
                ["--pin" as string]: p.band
                  ? `var(--series-${p.band})`
                  : "var(--muted)",
                ["--pin-delay" as string]: `${p.i * 0.7}s`,
              }}
            >
              <Link
                href={`/reviews?property=${p.id}`}
                transitionTypes={PAGE_NAV}
                className="map-pin-link"
                aria-label={ringLabel(p)}
              >
                <span aria-hidden="true" className="map-pin-dot">
                  {p.i + 1}
                </span>
                <span aria-hidden="true" className="map-pin-tag">
                  <span className="font-semibold">{p.name}</span>
                  <span className="numeral">
                    {p.average === null ? "—" : p.average.toFixed(1)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      {/* Narrow screens have no room for labels on the map, so the numbered
          dots are keyed here instead. */}
      <ol className="map-key">
        {placed.map((p) => (
          <li key={p.id}>
            <span
              aria-hidden="true"
              className="map-pin-dot"
              style={{
                ["--pin" as string]: p.band
                  ? `var(--series-${p.band})`
                  : "var(--muted)",
              }}
            >
              {p.i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="numeral font-semibold">
              {p.average === null ? "—" : p.average.toFixed(1)}
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[11px] text-[var(--muted)]">
        Stylised, not to scale · positions approximate (suburb level)
      </p>
    </>
  );
}
