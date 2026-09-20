/**
 * Reading GitHub's verdict on a commit, and deciding whether it may deploy.
 *
 * BOUNDARY: the decision is pure and the fetch decides nothing, so the refusal paths can be driven
 * by tests rather than by shipping a commit whose CI had deliberately been made to look failed.
 *
 * @see scripts/ship.mjs
 * @see test/ci-status.test.mjs
 */

/**
 * May this commit deploy? FAIL CLOSED IN EVERY DIRECTION, four refusals, each a state a naive
 * check reads as success:
 *
 *   - **no push-triggered run**: an empty list is the same shape as "nothing failed", which is
 *     what a truthy `every()` over an empty array gets wrong, silently, forever.
 *   - **still running**: the conclusion is null while a run is in flight, and green so far is not
 *     green.
 *   - **not success**: named explicitly, because cancelled, timed out and action required are
 *     none of them failures and none of them passes.
 *   - **unparseable payload**: an answer this function did not understand, not an empty result.
 *
 * PUSH-TRIGGERED RUNS ONLY, derived rather than named: filtering on the workflow file would go
 * stale the day a second push workflow lands.
 *
 * @param {unknown} payload the parsed GitHub `actions/runs` response
 * @param {string} sha for the message, short or full
 * @returns {{ ok: boolean, why: string, remedy: string }}
 */
export function ciVerdict(payload, sha) {
  const runs = /** @type {any} */ (payload)?.workflow_runs;
  if (!Array.isArray(runs)) {
    return {
      ok: false,
      why: `the GitHub API response carried no workflow_runs array for ${sha}`,
      remedy:
        "That is an answer this check did not understand, not an empty result, so it " +
        "refuses rather than reading it as nothing-failed. Nothing was deployed.",
    };
  }

  const push = runs.filter((r) => r && r.event === "push");

  if (push.length === 0) {
    return {
      ok: false,
      why: `no CI run exists for ${sha}`,
      remedy:
        `GitHub reports ${runs.length} run(s) for this sha and none triggered by a push. ` +
        "Either the commit is not pushed, or CI has not started yet. Push, wait for the " +
        "run, and re-run ship. Nothing was deployed.",
    };
  }

  const unfinished = push.filter((r) => r.status !== "completed");
  if (unfinished.length > 0) {
    return {
      ok: false,
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
      why: `CI did not pass for ${sha}`,
      remedy:
        `${failed.map((r) => `${r.name} concluded ${r.conclusion}`).join(", ")}. ` +
        `See ${failed[0].html_url ?? "the run in GitHub Actions"}. Fix the commit and ` +
        "push again; there is no override. Nothing was deployed.",
    };
  }

  return {
    ok: true,
    why: push.map((r) => `${r.name}: ${r.conclusion}`).join(", "),
    remedy: "",
  };
}

/**
 * Fetches the runs for one sha. Throws on anything that is not a 2xx body, deliberately: an
 * unreachable API and a failed CI run are different facts and the caller words them differently.
 *
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
    /*
     * **THE REPOSITORY IS PRIVATE**, so a 404 here is almost always an authentication problem rather
     * than a missing repo, and saying so is the difference between a one-minute fix and an afternoon:
     * GitHub answers 404 rather than 403 for a private resource you may not see, so an unauthenticated
     * caller is told the repo does not exist. A token is REQUIRED, not an optimisation.
     */
    const hint =
      response.status === 404 && !token
        ? " This repository is PRIVATE and no token was available, so GitHub answers 404 " +
          "rather than 403. Run `gh auth login`; the unauthenticated endpoint cannot work here."
        : "";
    throw new Error(`the GitHub API answered ${response.status}.${hint}`);
  }
  return response.json();
}
