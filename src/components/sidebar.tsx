'use client';

import Link from 'next/link';
import { PAGE_NAV } from './page-transition';
import { usePathname } from 'next/navigation';
import {
  ChartBar,
  ChatCircleDots,
  Compass,
  Buildings,
  SquaresFour,
  TrendUp,
} from '@phosphor-icons/react/dist/ssr';

/**
 * Primary navigation.
 *
 * Every row here goes somewhere real. The reference design has six items; so
 * does this, but the lower three are in-page anchors rather than invented
 * reports — they are styled like the page links because they are genuinely
 * navigation, just within a page. A nav item that leads nowhere would tell an
 * operator a report exists when it does not.
 */
const PAGES = [
  { href: '/', label: 'Portfolio Overview', icon: SquaresFour },
  { href: '/reviews', label: 'Reviews', icon: ChatCircleDots },
];

const SECTIONS = [
  { href: '/#properties', label: 'Property Comparison', icon: Buildings },
  { href: '/#trends', label: 'Trends & Themes', icon: TrendUp },
  { href: '/#topics', label: 'Operational Topics', icon: ChartBar },
];

/** The gold flourish above the wordmark. Drawn here rather than shipped as an
 *  asset: two strokes, no request, and it recolours with the theme. */
function Flourish() {
  return (
    <svg
      width="56"
      height="12"
      viewBox="0 0 56 12"
      fill="none"
      aria-hidden="true"
      className="text-[var(--nav-accent)]"
    >
      <path
        d="M2 8C10 8 12 2 20 2C26 2 27 8 34 8C42 8 44 3 54 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

function NavRow({
  href,
  label,
  icon: Icon,
  active,
  small = false,
}: {
  href: string;
  label: string;
  icon: typeof SquaresFour;
  active: boolean;
  small?: boolean;
}) {
  return (
    <Link
      href={href}
      transitionTypes={PAGE_NAV}
      aria-current={active ? 'page' : undefined}
      className={`nav-item relative flex items-center gap-3 rounded-lg pl-3 pr-3 ${
        small ? 'py-2 text-[13px]' : 'py-2.5 text-sm font-medium'
      } ${active ? 'text-[var(--nav-text)]' : 'text-[var(--nav-muted)]'}`}
      style={active ? { background: 'var(--nav-active)' } : undefined}
    >
      {/* The active marker is a gold bar on the leading edge, as in the
          reference. It sits inside the row so it cannot drift on zoom. */}
      {active ? (
        <span
          aria-hidden="true"
          className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[var(--nav-accent)]"
        />
      ) : null}
      <Icon
        size={small ? 16 : 19}
        weight={active ? 'duotone' : 'regular'}
        aria-hidden="true"
        className="shrink-0"
      />
      {label}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="relative flex h-full flex-col">
      {/* Brand */}
      <div className="px-5 pb-7 pt-7">
        <Flourish />
        <p className="mt-2 font-[family-name:var(--font-display)] text-[21px] leading-tight text-[var(--nav-text)]">
          Azzurro Hotels
        </p>
        <p className="eyebrow mt-0.5 text-[var(--nav-accent)]">Review Insights</p>
      </div>

      <nav aria-label="Main" className="px-3">
        <ul className="space-y-1">
          {PAGES.map((item) => (
            <li key={item.href}>
              <NavRow {...item} active={pathname === item.href} />
            </li>
          ))}
        </ul>

        <div className="mx-3 my-4 border-t border-[var(--nav-border)]" />

        <ul className="space-y-0.5">
          {SECTIONS.map((item) => (
            <li key={item.href}>
              <NavRow {...item} active={false} small />
            </li>
          ))}
        </ul>
      </nav>

      {/*
        The reference fades a lobby photograph in behind the lower sidebar. We
        hold no licensed photography of these properties and will not borrow
        Booking.com's, so this is a soft gold bloom instead: the same warmth,
        nothing claimed that is not ours.
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-72"
        style={{
          background:
            'radial-gradient(120% 80% at 20% 100%, rgb(212 175 55 / 0.16) 0%, rgb(212 175 55 / 0.05) 42%, transparent 72%)',
        }}
      />

      {/* Provenance sits in the chrome, so no screenshot travels without it. */}
      <div className="relative mt-auto border-t border-[var(--nav-border)] px-5 py-4">
        <div className="flex items-start gap-2">
          <Compass
            size={15}
            weight="duotone"
            aria-hidden="true"
            className="mt-0.5 shrink-0 text-[var(--nav-accent)]"
          />
          <p className="text-[11px] leading-relaxed text-[var(--nav-muted)]">
            Real guest reviews from public Booking.com property pages. Weeks run Monday–Sunday,
            Sydney time.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Small-screen navigation. The section anchors are dropped here — on a phone
 * the page is one column and scrolling to a section is quicker than reading a
 * list of links to it.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center justify-between gap-3 bg-[var(--nav-bg)] px-4 py-3 lg:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="shrink-0">
          <Flourish />
        </span>
        <p className="truncate font-[family-name:var(--font-display)] text-[15px] text-[var(--nav-text)]">
          Azzurro Review Insights
        </p>
      </div>

      <nav aria-label="Main">
        <ul className="flex gap-1">
          {PAGES.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  transitionTypes={PAGE_NAV}
                  aria-current={active ? 'page' : undefined}
                  className={`nav-item flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium ${
                    active
                      ? 'bg-[var(--nav-active)] text-[var(--nav-text)]'
                      : 'text-[var(--nav-muted)]'
                  }`}
                >
                  <Icon size={16} weight={active ? 'duotone' : 'regular'} aria-hidden="true" />
                  <span className="sr-only sm:not-sr-only">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
