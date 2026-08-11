/**
 * One retry, for Cloudflare READ paths only.
 *
 * ## The class, measured five times
 *
 * Transient failures on Cloudflare control-plane and storage reads, in four
 * different gates, wearing TWO OPPOSITE SYMPTOMS:
 *
 *   check:backup      remote sqlite_master read, died in seconds
 *                     (SQLITE_CANTOPEN), clean on retry
 *   check:llms        remote D1 read, error 10000, clean on retry
 *   check:invariants  remote D1 read, error 10000, clean on retry
 *   check:media       R2 list, "R2 error response does not contain the
 *                     CF-R2-Error header", statusCode 400. It HUNG rather than
 *                     failing, and took check:all past a ten minute timeout
 *                     against a 116-160s norm. Clean on retry at 27s.
 *
 * A hang and a five-second death are the same class. That is why this wraps
 * both a rejection AND a timeout: catching only the rejection would leave the
 * worst-behaved instance untouched.
 *
 * ## IT PRINTS BEFORE IT RETRIES, and that is the load-bearing part
 *
 * A fifth incident on 2026-08-09 reported "17 passed, 1 failed" and the failing
 * gate NAME was never captured before the retry, so the instance could not be
 * diagnosed and is recorded in core.md as undiagnosed. A silent retry converts
 * a diagnosable transient into an invisible one, which is worse than the
 * failure. The label and the first error always reach stderr.
 *
 * ## READS ONLY. Never wrap a write.
 *
 * A retried write is a write that may have landed twice. Every call site here
 * is a read: sqlite_master, a D1 SELECT, an R2 list. `sync:content` and the
 * publish paths are deliberately not wrapped.
 *
 * A SECOND failure propagates unchanged, with its original error, so the gate
 * fails exactly as it would have without this wrapper.
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
      // `fn` may be synchronous, as the wrangler spawns are. Promise.resolve
      // normalises both without forcing every call site to become async.
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
    // NAMED AND PRINTED BEFORE THE RETRY. See the header: an undiagnosable
    // transient is worse than a visible one.
    console.error(
      `  transient read failed, retrying once: ${label}\n` +
        `    first error: ${message.split("\n")[0].slice(0, 200)}`,
    );
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    // Second failure propagates UNCHANGED. The gate fails as it would have.
    return /** @type {T} */ (await attempt());
  }
}
