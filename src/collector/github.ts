/**
 * Running the collector on GitHub Actions from the deployed dashboard.
 *
 * Vercel cannot run the collector (no screen, no Chrome, and Booking.com
 * refuses headless), so the deployed "Collect now" button dispatches the
 * `collect.yml` workflow instead, and progress is read back from GitHub and
 * from collection_run like a local run.
 *
 * Needs GITHUB_DISPATCH_TOKEN (fine-grained, this repo only, Actions:
 * read & write) and GITHUB_REPO ("owner/name"). Server-only.
 */
const WORKFLOW = "collect.yml";
/** A dispatched run takes a few seconds to appear in GitHub's API. */
const APPEAR_GRACE_MS = 90_000;

function config() {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO;
  return token && repo && /^[\w.-]+\/[\w.-]+$/.test(repo)
    ? { token, repo }
    : null;
}

export const githubCollectionConfigured = () => config() !== null;

async function github(path: string, init?: RequestInit): Promise<Response> {
  const c = config();
  if (!c) throw new Error("GitHub collection is not configured");
  return fetch(
    `https://api.github.com/repos/${c.repo}/actions/workflows/${WORKFLOW}${path}`,
    {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${c.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...init?.headers,
      },
    },
  );
}

/** The collect workflow run that is queued or running, if any (scheduled or clicked). */
export async function activeGithubRun(): Promise<{ startedAt: string } | null> {
  const res = await github("/runs?per_page=5");
  if (!res.ok) throw new Error(`GitHub runs lookup failed: HTTP ${res.status}`);
  const body = (await res.json()) as {
    workflow_runs: { status: string; created_at: string }[];
  };
  const active = body.workflow_runs.find((r) => r.status !== "completed");
  return active ? { startedAt: active.created_at } : null;
}

/**
 * Whether a collection started at `since` should still be treated as running:
 * GitHub says a run is active, or it was dispatched so recently that GitHub
 * may not list it yet.
 */
export async function githubRunInFlight(
  since: string | null,
): Promise<{ startedAt: string } | null> {
  const active = await activeGithubRun();
  if (active) return { startedAt: since ?? active.startedAt };
  if (since && Date.now() - Date.parse(since) < APPEAR_GRACE_MS)
    return { startedAt: since };
  return null;
}

export async function dispatchGithubCollection(): Promise<void> {
  const res = await github("/dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main" }),
  });
  if (!res.ok) throw new Error(`GitHub dispatch failed: HTTP ${res.status}`);
}
