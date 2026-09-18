/**
 * One retry, for Cloudflare READ paths only.
 *
 * THE CLASS, measured across four gates, wearing TWO OPPOSITE SYMPTOMS: some died in seconds and
 * one HUNG, taking a tier run past its timeout and clean on retry. A hang and a five-second death
 * are the same class, which is why this wraps both a rejection AND a timeout.
 *
 * IT PRINTS BEFORE IT RETRIES, and that is the load-bearing part: one incident reported a count of
 * failures with the failing gate's NAME never captured before the retry, so it could not be
 * diagnosed. A silent retry converts a diagnosable transient into an invisible one.
 *
 * READS ONLY. Never wrap a write: a retried write is a write that may have landed twice. A SECOND
 * failure propagates unchanged, so the gate fails exactly as it would have without this wrapper.
 */

/** Generous: the R2 hang ran past ten minutes, and a slow read is not a hang. */
const DEFAULT_TIMEOUT_MS = 90_000;
const RETRY_DELAY_MS = 1_500;

/**
 * @template T
 * @param {() => T | Promise<T>} fn the READ to attempt
 * @param {{ label: string, timeoutMs?: number }} options
 * @returns {Promise<T>}
 */
export async function retryRead(fn, { label, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const attempt = () =>
    new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(new Error(`timed out after ${timeoutMs}ms (the hang symptom)`));
      }, timeoutMs);
      // `fn` may be synchronous, as the wrangler spawns are, and normalising both here avoids forcing
      // every call site to become async.
      Promise.resolve()
        .then(fn)
        .then(
          (value) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(value);
          },
          (error) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(error);
          },
        );
    });

  try {
    return /** @type {T} */ (await attempt());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // NAMED AND PRINTED BEFORE THE RETRY: an undiagnosable transient is worse than a visible one.
    console.error(
      `  transient read failed, retrying once: ${label}\n` +
        `    first error: ${message.split("\n")[0].slice(0, 200)}`,
    );
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    // Second failure propagates UNCHANGED. The gate fails as it would have.
    return /** @type {T} */ (await attempt());
  }
}
