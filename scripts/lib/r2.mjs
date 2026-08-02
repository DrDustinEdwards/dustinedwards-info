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
    try {
      await proxy.dispose();
    } catch {
      /* teardown only */
    }
  }

  return objects;
}
