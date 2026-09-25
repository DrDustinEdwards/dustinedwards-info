/**
 * A name string, not a class: the thrower is .mjs and the catcher is .ts, and instanceof across
 * two build graphs breaks when a bundler duplicates the module.
 */
export const DIVERGENCE_ERROR_NAME = "D1DivergenceError";

/**
 * @param {{ slug: string, commitSha: string, attempts: number, cause?: unknown }} facts
 * @returns {string}
 */
function divergenceMessage({ slug, commitSha, attempts, cause }) {
  const reason = cause instanceof Error ? cause.message : String(cause ?? "unknown");
  return (
    `The post "${slug}" WAS committed as ${commitSha}, and the database index ` +
    `could not be updated after ${attempts} attempt(s): ${reason}. ` +
    `Your writing is safe in git and is not lost. The site will serve the ` +
    `previous version of this post until the index catches up. ` +
    `Do NOT save again; the commit already landed and a second save changes nothing. ` +
    `Repair: run the content sync (npm run sync:content -- --remote), or press ` +
    `Sync Ask corpus on /admin/posts, either of which rebuilds this row from the repo.`
  );
}

/**
 * Never reverts the commit on failure: the repo is the source and D1 is derived.
 * One retry only: a second failure is not transient, and the repair is a rebuild from the repo.
 * The recorder must not write to D1, the store that just failed; the caller passes KV.
 *
 * @param {{
 *   write: () => Promise<unknown>,
 *   recordDivergence: (facts: { slug: string, commitSha: string, error: string }) => Promise<unknown>,
 *   slug: string,
 *   commitSha: string,
 *   attempts?: number,
 * }} options
 * @returns {Promise<{ ok: true, attempts: number, retried: boolean }>}
 */
export async function convergeWithRetry({
  write,
  recordDivergence,
  slug,
  commitSha,
  attempts = 2,
}) {
  /** @type {unknown} */
  let last;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await write();
      return { ok: true, attempts: attempt, retried: attempt > 1 };
    } catch (error) {
      last = error;
    }
  }

  const message = divergenceMessage({ slug, commitSha, attempts, cause: last });

  try {
    await recordDivergence({
      slug,
      commitSha,
      error: last instanceof Error ? last.message : String(last ?? "unknown"),
    });
  } catch (recordError) {
    // Logged, never rethrown: the divergence error must still reach the operator.
    console.error("failed to record a D1 divergence", recordError);
  }

  const error = new Error(message);
  error.name = DIVERGENCE_ERROR_NAME;
  error.cause = last;
  return Promise.reject(error);
}
