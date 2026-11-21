import { NextResponse, type NextRequest } from "next/server";

import { readLock } from "../../../collector/lock";
import {
  COOLDOWN_MINUTES,
  startCollection,
  uiCollectionEnabled,
} from "../../../collector/trigger";
import { latestCollection, runsSince } from "../../../db/queries";
import { PROPERTIES } from "../../../collector/properties";

export const dynamic = "force-dynamic";

const disabled = () =>
  NextResponse.json(
    { error: "Collecting from the dashboard is not enabled here." },
    { status: 404 },
  );

/** Progress of the current (or most recent dashboard-started) collection. */
export async function GET(request: NextRequest) {
  if (!uiCollectionEnabled()) return disabled();

  const lock = readLock();
  const since = lock?.startedAt ?? request.nextUrl.searchParams.get("since");
  if (since !== null && Number.isNaN(Date.parse(since))) {
    return NextResponse.json({ error: 'Invalid "since".' }, { status: 400 });
  }

  const runs = since ? await runsSince(since) : [];
  return NextResponse.json({
    running: lock !== null,
    startedAt: since,
    total: PROPERTIES.length,
    done: runs.length,
    failed: runs.filter((r) => r.status === "failed").length,
    inserted: runs.reduce((n, r) => n + r.reviews_inserted, 0),
    updated: runs.reduce((n, r) => n + r.reviews_updated, 0),
  });
}

/** Starts a collection, if none is running and the last one is not too recent. */
export async function POST(request: NextRequest) {
  if (!uiCollectionEnabled()) return disabled();

  // Same-origin only: stops another website from triggering a scrape through
  // the operator's browser while the dashboard runs locally.
  const origin = request.headers.get("origin");
  if (origin === null || new URL(origin).host !== request.headers.get("host")) {
    return NextResponse.json(
      { error: "Cross-origin request refused." },
      { status: 403 },
    );
  }

  if (readLock()) {
    return NextResponse.json(
      { error: "A collection is already running." },
      { status: 409 },
    );
  }

  const last = (await latestCollection())?.lastFinishedAt;
  const minutesAgo = last ? (Date.now() - Date.parse(last)) / 60_000 : Infinity;
  if (minutesAgo < COOLDOWN_MINUTES) {
    const wait = Math.ceil(COOLDOWN_MINUTES - minutesAgo);
    return NextResponse.json(
      {
        error: `Collected ${Math.floor(minutesAgo)} min ago. Try again in ${wait} min.`,
      },
      { status: 429 },
    );
  }

  const lock = await startCollection();
  if (!lock) {
    return NextResponse.json(
      { error: "A collection is already running." },
      { status: 409 },
    );
  }
  return NextResponse.json({ startedAt: lock.startedAt }, { status: 202 });
}
