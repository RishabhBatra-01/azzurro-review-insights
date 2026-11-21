import { NextResponse, type NextRequest } from "next/server";

import {
  dispatchGithubCollection,
  githubRunInFlight,
} from "../../../collector/github";
import { readLock } from "../../../collector/lock";
import { PROPERTIES } from "../../../collector/properties";
import {
  collectionMode,
  COOLDOWN_MINUTES,
  startCollection,
} from "../../../collector/trigger";
import { latestCollection, runsSince } from "../../../db/queries";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status });
const disabled = () =>
  json({ error: "Collecting from the dashboard is not enabled here." }, 404);

/** The collection currently running, local or on GitHub. */
async function inFlight(mode: "local" | "github", since: string | null) {
  if (mode === "local") {
    const lock = readLock();
    return lock ? { startedAt: lock.startedAt } : null;
  }
  return githubRunInFlight(since);
}

/** Progress of the current collection, or of the one started at `since`. */
export async function GET(request: NextRequest) {
  const mode = collectionMode();
  if (!mode) return disabled();

  const sinceParam = request.nextUrl.searchParams.get("since");
  if (sinceParam !== null && Number.isNaN(Date.parse(sinceParam))) {
    return json({ error: 'Invalid "since".' }, 400);
  }

  try {
    const running = await inFlight(mode, sinceParam);
    const since = running?.startedAt ?? sinceParam;
    const runs = since ? await runsSince(since) : [];
    return json({
      running: running !== null,
      startedAt: since,
      total: PROPERTIES.length,
      done: runs.length,
      failed: runs.filter((r) => r.status === "failed").length,
      inserted: runs.reduce((n, r) => n + r.reviews_inserted, 0),
      updated: runs.reduce((n, r) => n + r.reviews_updated, 0),
    });
  } catch (error) {
    console.error(
      "collect status failed:",
      error instanceof Error ? error.message : error,
    );
    return json({ error: "Could not read collection status." }, 502);
  }
}

/**
 * Starts a collection. Open to any visitor of the dashboard (a product
 * decision), so the guards are what stand between a clicking visitor and
 * Booking.com: same-origin only, one run at a time, and a cooldown.
 */
export async function POST(request: NextRequest) {
  const mode = collectionMode();
  if (!mode) return disabled();

  // Same-origin only: stops another website triggering a scrape via a browser.
  const origin = request.headers.get("origin");
  if (origin === null || new URL(origin).host !== request.headers.get("host")) {
    return json({ error: "Cross-origin request refused." }, 403);
  }

  try {
    if (await inFlight(mode, null))
      return json({ error: "A collection is already running." }, 409);

    const last = (await latestCollection())?.lastFinishedAt;
    const minutesAgo = last
      ? (Date.now() - Date.parse(last)) / 60_000
      : Infinity;
    if (minutesAgo < COOLDOWN_MINUTES) {
      const wait = Math.ceil(COOLDOWN_MINUTES - minutesAgo);
      return json(
        {
          error: `Collected ${Math.floor(minutesAgo)} min ago. Try again in ${wait} min.`,
        },
        429,
      );
    }

    if (mode === "local") {
      const lock = await startCollection();
      if (!lock)
        return json({ error: "A collection is already running." }, 409);
      return json({ startedAt: lock.startedAt }, 202);
    }

    const startedAt = new Date().toISOString();
    await dispatchGithubCollection();
    return json({ startedAt }, 202);
  } catch (error) {
    console.error(
      "collect start failed:",
      error instanceof Error ? error.message : error,
    );
    return json({ error: "Could not start a collection." }, 502);
  }
}
