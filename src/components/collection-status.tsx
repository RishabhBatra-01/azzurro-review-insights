"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowClockwise, CloudArrowDown } from "@phosphor-icons/react/dist/ssr";

import type { CollectionStatus as Status } from "../insights/collection";
import { formatRelativeTime } from "../lib/format";

type Progress = {
  running: boolean;
  startedAt: string | null;
  total: number;
  done: number;
  failed: number;
  inserted: number;
  updated: number;
};

const POLL_MS = 3000;

/** What a finished collection actually changed, in plain words. */
function summarize(p: Progress): string {
  // The process ended without finishing a single property (Chrome failed to
  // open, the network dropped): that is not "no new reviews".
  if (p.done === 0) return "Collection stopped early — nothing was saved";
  const parts = [
    p.inserted === 0
      ? "no new reviews"
      : `${p.inserted} new review${p.inserted === 1 ? "" : "s"}`,
  ];
  if (p.updated > 0) parts.push(`${p.updated} updated`);
  if (p.failed > 0) parts.push(`${p.failed} of ${p.total} properties failed`);
  return `Collected: ${parts.join(", ")}`;
}

/**
 * Data freshness, with two actions.
 *
 * Refresh re-reads the database; it does not scrape. So it says "New data
 * loaded" only when a collection finished since the page loaded, otherwise
 * "Already up to date" — selling a reload as fresh collection would be exactly
 * the false liveness this chip exists to prevent.
 *
 * Collect now (local only, see src/collector/trigger.ts) starts a real
 * collection from Booking.com and reports progress from the run log.
 */
export function CollectionStatus({
  status,
  renderedAt,
  canCollect,
}: {
  status: Status & { lastFinishedAt: string };
  /** The server's clock at render, so the first client paint matches it. */
  renderedAt: string;
  canCollect: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [now, setNow] = useState(() => new Date(renderedAt));
  const [message, setMessage] = useState<string | null>(null);
  const [collecting, setCollecting] = useState<Progress | null>(null);
  const before = useRef<string | null>(null);

  // Keep "3 h ago" honest while the tab sits open.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Every result message clears itself after a while. Owned here, not by the
  // effects that set it, so re-running those effects cannot cancel the clear.
  useEffect(() => {
    if (message === null) return;
    const id = window.setTimeout(() => setMessage(null), 6000);
    return () => window.clearTimeout(id);
  }, [message]);

  // When a refresh settles, say whether it actually brought anything new.
  useEffect(() => {
    if (pending || before.current === null) return;
    setNow(new Date());
    setMessage(
      status.lastFinishedAt !== before.current
        ? "New data loaded"
        : "Already up to date",
    );
    before.current = null;
  }, [pending, status.lastFinishedAt]);

  const poll = useCallback(
    async (since: string | null): Promise<Progress | null> => {
      const query = since ? `?since=${encodeURIComponent(since)}` : "";
      const res = await fetch(`/api/collect${query}`, { cache: "no-store" });
      return res.ok ? ((await res.json()) as Progress) : null;
    },
    [],
  );

  // Follow a collection in flight — including one already running when the
  // page was opened — until it finishes, then load what it brought in.
  useEffect(() => {
    if (!canCollect) return;
    let cancelled = false;
    let timer: number | undefined;
    const since = collecting?.startedAt ?? null;

    const tick = async () => {
      const p = await poll(since).catch(() => null);
      if (cancelled || !p) return;
      if (p.running) {
        setCollecting(p);
        timer = window.setTimeout(tick, POLL_MS);
      } else if (collecting) {
        setCollecting(null);
        setMessage(summarize(p));
        startTransition(() => router.refresh());
      }
    };
    // Idle: check once on mount. Collecting: keep polling.
    if (collecting || since === null) void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Re-arm only when a run starts or ends, not on every progress update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCollect, collecting?.startedAt]);

  const collect = async () => {
    setMessage(null);
    const res = await fetch("/api/collect", { method: "POST" }).catch(
      () => null,
    );
    const body = (await res?.json().catch(() => null)) as {
      startedAt?: string;
      error?: string;
    } | null;
    if (!res || !res.ok || !body?.startedAt) {
      setMessage(body?.error ?? "Could not start a collection");
      return;
    }
    setCollecting({
      running: true,
      startedAt: body.startedAt,
      total: 4,
      done: 0,
      failed: 0,
      inserted: 0,
      updated: 0,
    });
  };

  const healthy = status.failed === 0 && status.partial === 0;
  const busy = pending || collecting !== null;

  return (
    <div
      className="glass flex flex-wrap items-center gap-x-2.5 gap-y-1.5 py-1.5 pl-3.5 pr-1.5 text-xs"
      style={{ borderRadius: 999 }}
    >
      {/* Pulses only while every property's latest run succeeded:
          a heartbeat on a failing pipeline would be a lie. */}
      <span
        aria-hidden="true"
        className="pulse"
        data-live={healthy || collecting ? "" : undefined}
        style={{
          ["--pulse" as string]: collecting
            ? "#e2c158"
            : healthy
              ? "#4ade80"
              : status.failed > 0
                ? "#fca5a0"
                : "#e2c158",
        }}
      />

      <span aria-live="polite" className="min-w-0">
        {collecting ? (
          <span className="font-semibold">
            Collecting from Booking.com… {collecting.done} of {collecting.total}
          </span>
        ) : message ? (
          <span className="font-semibold">{message}</span>
        ) : (
          <>
            <span className="font-semibold">
              Collected {formatRelativeTime(status.lastFinishedAt, now)}
            </span>
            <span className="text-[var(--muted)]">
              {" "}
              · {status.ok} of {status.total} properties OK
            </span>
          </>
        )}
      </span>

      <span className="flex shrink-0 items-center gap-1">
        {canCollect ? (
          <button
            type="button"
            onClick={collect}
            disabled={busy}
            title="Fetch new reviews from Booking.com now. A Chrome window opens while it runs."
            className="refresh-btn flex h-7 items-center gap-1.5 rounded-full px-2.5 font-semibold text-[var(--text-secondary)]"
          >
            <CloudArrowDown
              size={15}
              weight="bold"
              aria-hidden="true"
              className={collecting ? "bob" : undefined}
            />
            {collecting ? "Collecting" : "Collect now"}
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            before.current = status.lastFinishedAt;
            setMessage(null);
            startTransition(() => router.refresh());
          }}
          disabled={busy}
          aria-label={pending ? "Refreshing data" : "Refresh data"}
          title="Reload the latest collected data"
          className="refresh-btn grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--text-secondary)]"
        >
          <ArrowClockwise
            size={15}
            weight="bold"
            aria-hidden="true"
            className={pending ? "spin" : undefined}
          />
        </button>
      </span>
    </div>
  );
}
