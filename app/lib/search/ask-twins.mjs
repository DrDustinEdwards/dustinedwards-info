// A failed key still joins keys: the caller prunes every key it is not given, so leaving it out would
// turn a transient into a deletion. Failures are returned so the sync report can refuse to converge.

export const TWIN_ATTEMPTS = 3;

/**
 * Uploads in flight at once during sync_ask. The corpus is one document per search record (552 on 2026-11-08),
 * and one at a time took over five minutes, past the 300 s Node's fetch waits for response headers, so the
 * converge job's call died "fetch failed" with the Worker still uploading.
 */
export const ASK_UPLOAD_CONCURRENCY = 8;

const TWIN_BACKOFF_MS = 500;

/**
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
 * Runs `fn` over `items` with at most `limit` in flight and returns the results in item order. The first
 * rejection stops new work from starting and is thrown once the calls already in flight have settled.
 *
 * @template T, R
 * @param {readonly T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
export async function mapPool(items, limit, fn) {
  /** @type {R[]} */
  const results = Array.from({ length: items.length });
  let next = 0;
  let failed = false;
  /** @type {unknown} */
  let failure;
  const worker = async () => {
    while (!failed && next < items.length) {
      const index = next;
      next += 1;
      try {
        results[index] = await fn(/** @type {T} */ (items[index]), index);
      } catch (error) {
        if (!failed) failure = error;
        failed = true;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failed) throw failure;
  return results;
}

/**
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
