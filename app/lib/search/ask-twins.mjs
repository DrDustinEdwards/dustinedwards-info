/**
 * Uploading the papers' markdown twins to the Ask index, with retries, and a record of what failed.
 *
 * PURE: the fetch, the upload and the sleep are passed in, so `check:tests` drives the failure paths
 * without an AI Search binding. `ask.server.ts` supplies the real bindings.
 *
 * ## WHY FAILURES ARE RETURNED, NOT SWALLOWED
 *
 * Measured 2026-09-23 after shipping e623457: one twin's upload threw
 * `AiSearchInternalError: unable_to_connect_to_ai_search`, a transient, and the loop logged it and
 * carried on. The converge then read 156 of 157 back, which ship waits out as eventual consistency,
 * so a write that had simply failed was reported as an index still catching up, and the drift stayed.
 * Each twin now gets a few attempts, and a key that still fails is RETURNED so the sync report can
 * refuse convergence and name it.
 *
 * ## WHY A FAILED KEY STILL JOINS `keys`
 *
 * The caller prunes every key it is not given, so leaving a failed twin out of `keys` would turn a
 * transient into a DELETION of the copy already indexed. `keys` means "should exist"; `failed` means
 * "was not written this time".
 */

/** How many times one twin is fetched and uploaded before it counts as failed. */
export const TWIN_ATTEMPTS = 3;

/** The pause before the second attempt; it doubles for each attempt after that. */
export const TWIN_BACKOFF_MS = 500;

/**
 * Runs `fn` up to `attempts` times, pausing between tries, and returns its value or throws the
 * last error.
 *
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ attempts?: number, backoffMs?: number, sleep?: (ms: number) => Promise<void> }} [opts]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, opts = {}) {
  const attempts = opts.attempts ?? TWIN_ATTEMPTS;
  const backoffMs = opts.backoffMs ?? TWIN_BACKOFF_MS;
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  /** @type {unknown} */
  let last;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (attempt < attempts) await sleep(backoffMs * 2 ** (attempt - 1));
    }
  }
  throw last;
}

/**
 * Uploads every twin, each with retries.
 *
 * @param {Array<{ key: string, path: string }>} twins the item key and the asset path of each twin
 * @param {{
 *   fetchText: (path: string) => Promise<string>,
 *   upload: (key: string, body: string) => Promise<unknown>,
 *   log?: (...args: unknown[]) => void,
 *   attempts?: number,
 *   backoffMs?: number,
 *   sleep?: (ms: number) => Promise<void>,
 * }} io `fetchText` throws on a missing or unreadable twin
 * @returns {Promise<{ keys: string[], failed: Array<{ key: string, error: string }> }>}
 */
export async function uploadTwins(twins, io) {
  const retry = { attempts: io.attempts, backoffMs: io.backoffMs, sleep: io.sleep };
  const log = io.log ?? console.error;
  const keys = [];
  const failed = [];
  for (const { key, path } of twins) {
    keys.push(key);
    try {
      const body = await withRetry(() => io.fetchText(path), retry);
      await withRetry(() => io.upload(key, body), retry);
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      log("ask twin upload failed after retries", key, message);
      failed.push({ key, error: message });
    }
  }
  return { keys, failed };
}
