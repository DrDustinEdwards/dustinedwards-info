/**
 * Listing an R2 bucket from a Node build script, through the platform proxy because the CLI has
 * no `list` verb.
 *
 * BOUNDARY: the remote flag goes on the BINDING and nowhere else, and the config carrying it is
 * built here and thrown away, so it cannot leak into the real config and point local development
 * at production R2.
 */

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { getPlatformProxy } from "wrangler";

/**
 * Build the throwaway config that binds ONE bucket, and hand back a proxy. Lifted out when a
 * second caller arrived: a hand-rolled copy is how the remote flag or the discard discipline would
 * quietly stop being true.
 *
 * @param {string} bucket @param {boolean} remote
 */
async function bucketProxy(bucket, remote) {
  const dir = await mkdtemp(path.join(tmpdir(), "r2-list-"));
  const configPath = path.join(dir, "wrangler.json");
  await writeFile(
    configPath,
    JSON.stringify({
      name: "r2-list",
      // Matched to wrangler.jsonc.example, and no flags for its reason: Node
      // compatibility is on by default at this date.
      compatibility_date: "2026-09-01",
      r2_buckets: [{ binding: "BUCKET", bucket_name: bucket, ...(remote ? { remote: true } : {}) }],
    }),
    "utf8",
  );
  return getPlatformProxy({ configPath });
}

/**
 * Pull every object in a bucket to disk. THE ONLY COPY OUTSIDE THE ACCOUNT, the same-account
 * mirror doing nothing for account loss. **THE SIZE IS VERIFIED PER OBJECT, not just the count**:
 * a short read writes a file that exists, has a plausible name, and restores to a corrupt image.
 * Keys may carry a separator, so the structure is recreated rather than flattened.
 *
 * @param {object} options
 * @param {string} options.bucket
 * @param {string} options.destDir
 * @param {boolean} [options.remote]
 * @returns {Promise<{ downloaded: number, bytes: number, mismatched: string[] }>}
 */
export async function downloadAllObjects({ bucket, destDir, remote = true }) {
  const proxy = await bucketProxy(bucket, remote);
  let downloaded = 0;
  let bytes = 0;
  /** @type {string[]} */
  const mismatched = [];

  try {
    const handle = /** @type {any} */ (proxy.env).BUCKET;
    /** @type {string | undefined} */
    let cursor;
    for (;;) {
      const page = await handle.list({ limit: 1000, ...(cursor ? { cursor } : {}) });
      for (const listed of page.objects) {
        const object = await handle.get(listed.key);
        if (!object) {
          // Listed and then gone. Reported rather than skipped: a backup that
          // silently omits an object it just saw is the failure being guarded.
          mismatched.push(`${listed.key} (listed but could not be read)`);
          continue;
        }
        const buffer = Buffer.from(await object.arrayBuffer());
        const out = path.join(destDir, listed.key);
        await mkdir(path.dirname(out), { recursive: true });
        await writeFile(out, buffer);
        if (buffer.length !== listed.size) {
          mismatched.push(`${listed.key} (wrote ${buffer.length}, R2 reported ${listed.size})`);
        }
        downloaded += 1;
        bytes += buffer.length;
      }
      if (!page.truncated) break;
      cursor = page.cursor;
    }
  } finally {
    await proxy.dispose();
  }

  return { downloaded, bytes, mismatched };
}

/**
 * Every object under a prefix, PAGED TO THE END. Not a nicety: this repo has already shipped a
 * listing that ignored it, and a prune reported removing nothing for items on a later page.
 *
 * @param {object} options
 * @param {string} options.bucket bucket name
 * @param {string} [options.prefix] "" lists the whole bucket
 * @param {boolean} [options.remote] false reads local state
 * @returns {Promise<Array<{ key: string, size: number, uploaded: string, etag: string }>>}
 */
export async function listAllObjects({ bucket, prefix = "", remote = true }) {
  const proxy = await bucketProxy(bucket, remote);

  /** @type {Array<{ key: string, size: number, uploaded: string, etag: string }>} */
  const objects = [];
  try {
    const handle = /** @type {any} */ (proxy.env).BUCKET;
    /** @type {string | undefined} */
    let cursor;
    for (;;) {
      const page = await handle.list({
        ...(prefix ? { prefix } : {}),
        limit: 1000,
        ...(cursor ? { cursor } : {}),
      });
      for (const object of page.objects) {
        objects.push({
          key: object.key,
          size: object.size,
          uploaded:
            object.uploaded instanceof Date
              ? object.uploaded.toISOString()
              : String(object.uploaded ?? ""),
          etag: String(object.etag ?? ""),
        });
      }
      if (!page.truncated) break;
      cursor = page.cursor;
      // A truncated page with no cursor would spin forever. Refuse rather than
      // hand back a partial listing that every caller would treat as total.
      if (!cursor) throw new Error("R2 reported a truncated listing with no cursor");
    }
  } finally {
    // The runtime can throw on teardown after a remote session, and the listing is already in hand.
    // Note what this does NOT swallow: an error from the listing itself propagates, which is the whole
    // safety property, a caller that deletes having to tell "the bucket holds nothing" from "the
    // listing did not finish".
    try {
      await proxy.dispose();
    } catch {
      /* teardown only */
    }
  }

  return objects;
}

/**
 * A listing a destructive caller may act on, or a refusal.
 *
 * **Why this is separate.** A prune once printed a transport error mid-output and carried on to
 * report one orphan. It was correct that time and would have looked EXACTLY THE SAME if the
 * listing had been cut short, and the difference is deleting one dead file or every live one. So
 * a caller states how many objects it expects to still be there:
 *
 *   - an EMPTY listing is always a refusal: a bucket that holds nothing needs no prune.
 *   - a listing missing a key the caller expects is demonstrably missing objects that certainly
 *     exist, so everything else it appears to be missing is unproven too.
 *
 * @param {object} options
 * @param {string} options.bucket
 * @param {string} [options.prefix]
 * @param {boolean} [options.remote]
 * @param {Set<string>} options.expected keys the caller knows must be present
 * @param {string} options.label for the message
 */
export async function listForPrune({ bucket, prefix = "", remote = true, expected, label }) {
  const objects = await listAllObjects({ bucket, prefix, remote });
  const keys = new Set(objects.map((o) => o.key));

  const missing = [...expected].filter((key) => !keys.has(key));

  console.log(
    `  ${label}: listed ${objects.length} object(s) under "${prefix}", ` +
      `expected at least ${expected.size} to be present, ${missing.length} of those missing`,
  );

  if (objects.length === 0) {
    throw new Error(
      `refusing to prune ${bucket}: the listing came back EMPTY. A prune computes what to ` +
        `delete from what is absent, so an empty listing means "delete everything". If the ` +
        `bucket is genuinely empty there is nothing to prune.`,
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `refusing to prune ${bucket}: ${missing.length} object(s) the corpus still references ` +
        `are absent from the listing, so the listing is incomplete and everything it appears ` +
        `to be missing is unproven. Missing: ${missing.slice(0, 5).join(", ")}` +
        `${missing.length > 5 ? ` and ${missing.length - 5} more` : ""}. ` +
        `Re-run; if it persists, the objects really are gone and need regenerating first.`,
    );
  }

  return objects;
}
