/**
 * Listing an R2 bucket from a Node build script.
 *
 * ONE implementation, several callers, for the reason `diagram-audit.mjs` is one
 * implementation with two callers: a second copy of this would be a second place
 * for the paging to be got wrong.
 *
 * **Why a platform proxy and not the CLI.** `wrangler r2 object` has exactly
 * three verbs, `get`, `put` and `delete`. There is no `list`, so the one thing
 * a reconciler cannot do without is the one thing the CLI does not offer.
 * `getPlatformProxy` hands a Node script the same `env.MEDIA` the Worker gets,
 * over wrangler's existing OAuth, which is why nothing here needs a new API
 * token or an S3 access key.
 *
 * **`remote: true` goes on the BINDING and nowhere else.** It is what selects
 * the real bucket rather than local miniflare state; measured 2026-08-02, it is
 * the difference between reading 1 object and 13. The config carrying it is
 * built here and thrown away rather than tracked, so the flag cannot leak into
 * `wrangler.jsonc` and quietly point `npm run dev` at production R2.
 */

import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { getPlatformProxy } from "wrangler";

/**
 * Every object under a prefix, PAGED TO THE END.
 *
 * The paging is not a nicety. This repo has already shipped a listing that
 * ignored it: `items.list()` on the Ask index returned only the first page at
 * all four call sites, and a prune reported "removed 0" for a post whose items
 * were real but sat on a later page. A lister that cannot see an object reports
 * success either way, and that is the shape of this whole class of bug.
 *
 * @param {object} options
 * @param {string} options.bucket bucket name, e.g. "dustinedwards-media"
 * @param {string} [options.prefix] "" lists the whole bucket
 * @param {boolean} [options.remote] false reads local miniflare state
 * @returns {Promise<Array<{ key: string, size: number, uploaded: string, etag: string }>>}
 */
export async function listAllObjects({ bucket, prefix = "", remote = true }) {
  const dir = await mkdtemp(path.join(tmpdir(), "r2-list-"));
  const configPath = path.join(dir, "wrangler.json");
  await writeFile(
    configPath,
    JSON.stringify({
      name: "r2-list",
      compatibility_date: "2026-07-08",
      compatibility_flags: ["nodejs_compat"],
      r2_buckets: [{ binding: "BUCKET", bucket_name: bucket, ...(remote ? { remote: true } : {}) }],
    }),
    "utf8",
  );

  const proxy = await getPlatformProxy({ configPath });

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
    // workerd can throw on teardown after a remote session (measured: a WSARecv
    // failure on Windows). The listing is already in hand by then, so a dispose
    // that fails must not fail the caller.
    //
    // Note what this does NOT swallow: an error thrown by `list()` itself
    // propagates out of the try above and this function never returns. That
    // distinction is the whole safety property. A caller that deletes things
    // must be able to tell "the bucket holds nothing" from "the listing did not
    // finish", and a partial listing returned as if it were total is how a
    // prune deletes live objects.
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
 * **Why this is separate from `listAllObjects`.** On 2026-08-02 a prune run
 * printed `workerd/jsg/util.c++: WSARecv(): #64 The specified network name is no
 * longer available` in the middle of its output and carried on to report
 * "1 orphaned". It was correct that time. It would have looked EXACTLY THE SAME
 * if the listing had been cut short, and the difference between those two cases
 * is deleting one dead file or deleting eleven live ones.
 *
 * So a caller that is about to delete does not get a bare array. It states how
 * many objects it expects to still be there, and this refuses if the listing
 * cannot support that:
 *
 *   - an EMPTY listing is always a refusal. A bucket that genuinely holds
 *     nothing needs no prune, so there is no case where acting on zero is both
 *     correct and necessary.
 *   - a listing that does not contain every key the caller expects to keep means
 *     the listing is missing objects that certainly exist, so everything else it
 *     appears to be missing is unproven too.
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
