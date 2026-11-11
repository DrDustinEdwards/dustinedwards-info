// The Ask upload path, pure so `node --test` reaches it. A failed key is reported, never thrown: the caller prunes
// every key it is not given, so dropping it would turn a transient into a deletion, and one key's failure must not
// fail the whole sync (a single AI Search "rate limited" once turned sync_ask into a 500, 2026-11-11).

/**
 * Four tries, 1 s then 2 s then 4 s apart. AI Search answers a burst with "You are being rate limited" and now and
 * then with "Internal Error"; two tries 500 ms apart outlived neither on the deploys of 2026-11-11.
 */
export const ASK_UPLOAD_ATTEMPTS = 4;

/**
 * Uploads in flight at once during sync_ask. Since the sync uploads only what changed (askUploadsNeeded) a deploy
 * usually sends a handful; a first sync or a corpus-wide change sends every item, and one at a time that took over
 * five minutes, past the 300 s Node's fetch waits for response headers.
 */
const ASK_UPLOAD_CONCURRENCY = 8;

const ASK_UPLOAD_BACKOFF_MS = 1000;

/**
 * @template T
 * @param {() => Promise<T>} fn
 * @param {{ attempts?: number, backoffMs?: number, sleep?: (ms: number) => Promise<void> }} [opts]
 * @returns {Promise<T>}
 */
export async function withRetry(fn, opts = {}) {
  const attempts = opts.attempts ?? ASK_UPLOAD_ATTEMPTS;
  const backoffMs = opts.backoffMs ?? ASK_UPLOAD_BACKOFF_MS;
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
 * Uploads every item, at most ASK_UPLOAD_CONCURRENCY at once, each retried. Never rejects: an item whose upload
 * outlives its retries is logged and returned in `failed`, so the report can refuse to converge on it by name.
 *
 * @param {ReadonlyArray<{ key: string, body: string }>} items
 * @param {{
 *   upload: (key: string, body: string) => Promise<unknown>,
 *   log?: (...args: unknown[]) => void,
 *   attempts?: number,
 *   backoffMs?: number,
 *   sleep?: (ms: number) => Promise<void>,
 * }} io
 * @returns {Promise<{ uploaded: string[], failed: Array<{ key: string, error: string }> }>}
 */
export async function uploadAskItems(items, io) {
  const retry = { attempts: io.attempts, backoffMs: io.backoffMs, sleep: io.sleep };
  const log = io.log ?? console.error;
  /** @type {string[]} */
  const uploaded = [];
  /** @type {Array<{ key: string, error: string }>} */
  const failed = [];
  await mapPool(items, ASK_UPLOAD_CONCURRENCY, async ({ key, body }) => {
    try {
      await withRetry(() => io.upload(key, body), retry);
      uploaded.push(key);
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      log("ask upload failed after retries", key, message);
      failed.push({ key, error: message });
    }
  });
  return { uploaded, failed };
}

/** Item statuses that hold, or will hold, the uploaded body. `error`, `outdated` and `skipped` do not. */
const HELD = new Set(["completed", "queued", "running"]);

/**
 * The items a sync must upload: those the index does not hold in a good state, and those whose body differs from
 * the one last uploaded under that key (the `ask_uploads` ledger). AI Search reports no usable checksum (every item
 * reads "0"), so the ledger is the only record of what an item holds. Re-uploading an unchanged body costs a rate
 * limited request and, from 2026-12-01, ingestion tokens, for nothing.
 *
 * @template {{ key: string, hash: string }} T
 * @param {readonly T[]} items each with the sha-256 of its body
 * @param {ReadonlyArray<{ key: string, status?: string | null }>} listed the index, every page
 * @param {ReadonlyMap<string, string>} ledger key to the sha-256 last uploaded under it
 * @returns {T[]}
 */
export function askUploadsNeeded(items, listed, ledger) {
  const held = new Set(
    listed.filter((item) => HELD.has(item.status ?? "")).map((item) => item.key),
  );
  return items.filter((item) => !held.has(item.key) || ledger.get(item.key) !== item.hash);
}

/**
 * Hex sha-256 of a body, the ledger's record of what was uploaded.
 *
 * @param {string} body
 * @returns {Promise<string>}
 */
export async function askBodyHash(body) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
