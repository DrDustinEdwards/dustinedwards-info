/**
 * Reads only: a retried write may land twice. Wraps a timeout as well as a rejection because
 * Cloudflare transients show up as both a fast death and a hang.
 */

/** Generous: the R2 hang ran past ten minutes, and a slow read is not a hang. */
const DEFAULT_TIMEOUT_MS = 90_000;
const RETRY_DELAY_MS = 1_500;

/**
 * @template T
 * @param {() => T | Promise<T>} fn
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
    console.error(
      `  transient read failed, retrying once: ${label}\n` +
        `    first error: ${message.split("\n")[0].slice(0, 200)}`,
    );
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return /** @type {T} */ (await attempt());
  }
}
