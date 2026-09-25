/** The workflow whose push run IS the review. Another push-triggered workflow being green is not CI. */
const CI_WORKFLOW_PATH = ".github/workflows/ci.yml";

/**
 * Fails closed: no push run (an empty list reads as "nothing failed"), a run in flight, and any
 * conclusion but success (canceled, timed out) all refuse. So do an answer that is not about this
 * sha (a run whose head_sha is another commit, which is what an ignored or empty filter returns), a
 * page that does not hold every run, and a set of push runs without the CI workflow among them.
 * Callers branch on `state`, not `why`.
 *
 * @param {unknown} payload
 * @param {string} sha the commit, full or abbreviated to at least 7 hex characters
 * @param {{ workflowPath?: string }} [options]
 * @returns {{ ok: boolean, state: "green" | "running" | "failed" | "no-run" | "unparseable", why: string, remedy: string }}
 */
export function ciVerdict(payload, sha, { workflowPath = CI_WORKFLOW_PATH } = {}) {
  // An empty or short sha would prefix-match every run below.
  if (typeof sha !== "string" || !/^[0-9a-f]{7,40}$/i.test(sha)) {
    return {
      ok: false,
      state: "unparseable",
      why: `${JSON.stringify(sha)} is not a commit sha`,
      remedy:
        "Without a sha there is nothing to match the runs against, so any run would do. " +
        "Nothing was deployed.",
    };
  }

  const runs = /** @type {any} */ (payload)?.workflow_runs;
  if (!Array.isArray(runs)) {
    return {
      ok: false,
      state: "unparseable",
      why: `the GitHub API response carried no workflow_runs array for ${sha}`,
      remedy:
        "That is an answer this check did not understand, not an empty result, so it " +
        "refuses rather than reading it as nothing-failed. Nothing was deployed.",
    };
  }

  // GitHub filtered by head_sha, so a run for any other commit means the filter was not applied.
  const foreign = runs.filter(
    (r) => !r || typeof r.head_sha !== "string" || !r.head_sha.toLowerCase().startsWith(sha.toLowerCase()),
  );
  if (foreign.length > 0) {
    return {
      ok: false,
      state: "unparseable",
      why: `the GitHub API returned ${foreign.length} run(s) that are not for ${sha}`,
      remedy:
        `The first is for ${JSON.stringify(foreign[0]?.head_sha)}. The head_sha filter was not ` +
        "applied, so this list says nothing about this commit. Nothing was deployed.",
    };
  }

  // per_page tops out at 100; a list shorter than the total hides runs that may have failed.
  const total = /** @type {any} */ (payload)?.total_count;
  if (typeof total === "number" && total > runs.length) {
    return {
      ok: false,
      state: "unparseable",
      why: `the GitHub API returned ${runs.length} of ${total} run(s) for ${sha}`,
      remedy: "The unread runs could hold a failure, so a partial page is not a verdict. Nothing was deployed.",
    };
  }

  const push = runs.filter((r) => r.event === "push");

  if (push.length === 0) {
    return {
      ok: false,
      state: "no-run",
      why: `no CI run exists for ${sha}`,
      remedy:
        `GitHub reports ${runs.length} run(s) for this sha and none triggered by a push. ` +
        "Either the commit is not pushed, or CI has not started yet. Push, wait for the " +
        "run, and re-run ship. Nothing was deployed.",
    };
  }

  if (!push.some((r) => r.path === workflowPath)) {
    return {
      ok: false,
      state: "no-run",
      why: `no ${workflowPath} push run exists for ${sha}`,
      remedy:
        `GitHub reports push run(s) from ${push.map((r) => r.path ?? r.name).join(", ")}, and none is ` +
        "CI. Another workflow being green is not CI being green. Push, wait for CI, and re-run " +
        "ship. Nothing was deployed.",
    };
  }

  const unfinished = push.filter((r) => r.status !== "completed");
  if (unfinished.length > 0) {
    return {
      ok: false,
      state: "running",
      why: `CI is still running for ${sha}`,
      remedy:
        `${unfinished.map((r) => `${r.name} is ${r.status}`).join(", ")}. A run that is ` +
        "green so far is not a green run. Wait for it to finish and re-run ship. " +
        "Nothing was deployed.",
    };
  }

  const failed = push.filter((r) => r.conclusion !== "success");
  if (failed.length > 0) {
    return {
      ok: false,
      state: "failed",
      why: `CI did not pass for ${sha}`,
      remedy:
        `${failed.map((r) => `${r.name} concluded ${r.conclusion}`).join(", ")}. ` +
        `See ${failed[0].html_url ?? "the run in GitHub Actions"}. Fix the commit and ` +
        "push again; there is no override. Nothing was deployed.",
    };
  }

  return {
    ok: true,
    state: "green",
    why: push.map((r) => `${r.name}: ${r.conclusion}`).join(", "),
    remedy: "",
  };
}

/**
 * @param {{ owner: string, repo: string, sha: string, token?: string, apiBase?: string }} options
 */
export async function fetchCiRuns({ owner, repo, sha, token = "", apiBase = "https://api.github.com" }) {
  const response = await fetch(
    `${apiBase}/repos/${owner}/${repo}/actions/runs?head_sha=${sha}&per_page=100`,
    {
      headers: {
        accept: "application/vnd.github+json",
        "user-agent": "dustinedwards-ship",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    },
  );
  if (!response.ok) {
    // GitHub answers 404, not 403, for a private repo you may not see, so a 404 is usually auth.
    const hint =
      response.status === 404 && !token
        ? " This repository is PRIVATE and no token was available, so GitHub answers 404 " +
          "rather than 403. Run `gh auth login`; the unauthenticated endpoint cannot work here."
        : "";
    throw new Error(`the GitHub API answered ${response.status}.${hint}`);
  }
  return response.json();
}
