/**
 * Through the platform proxy because the CLI has no `list` verb. The remote flag lives only in a
 * throwaway config, so it cannot leak into the real one and point local development at production R2.
 */

import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { getPlatformProxy } from "wrangler";

/**
 * @param {string} bucket @param {boolean} remote
 */
async function bucketProxy(bucket, remote) {
  const dir = await mkdtemp(path.join(tmpdir(), "r2-list-"));
  const configPath = path.join(dir, "wrangler.json");
  await writeFile(
    configPath,
    JSON.stringify({
      name: "r2-list",
      // No compatibility flags: Node compatibility is on by default at this date.
      compatibility_date: "2026-09-01",
      r2_buckets: [{ binding: "BUCKET", bucket_name: bucket, ...(remote ? { remote: true } : {}) }],
    }),
    "utf8",
  );
  return getPlatformProxy({ configPath });
}

/**
 * The runtime can throw on teardown after a remote session, and that must not replace the error that
 * ended the work, nor fail work that finished. It is printed, never dropped.
 *
 * @param {{ dispose: () => Promise<void> }} proxy
 */
async function disposeProxy(proxy) {
  try {
    await proxy.dispose();
  } catch (error) {
    console.error(
      `  r2: proxy teardown failed (${error instanceof Error ? error.message : String(error)}); ` +
        `the listing or download itself is unaffected`,
    );
  }
}

/**
 * Size is verified per object, not just the count: a short read writes a plausible file that
 * restores to a corrupt image.
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
      // Without a cursor the same first page comes back forever.
      if (!cursor) throw new Error("R2 reported a truncated listing with no cursor");
    }
  } finally {
    await disposeProxy(proxy);
  }

  return { downloaded, bytes, mismatched };
}

/**
 * @param {object} options
 * @param {string} options.bucket
 * @param {string} [options.prefix]
 * @param {boolean} [options.remote]
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
      if (!cursor) throw new Error("R2 reported a truncated listing with no cursor");
    }
  } finally {
    // Only teardown is caught: a listing error must propagate so a deleting caller can tell "empty"
    // from "did not finish".
    await disposeProxy(proxy);
  }

  return objects;
}

/**
 * A cut-short listing looks identical to a complete one, and a prune acts on what is absent. A
 * listing missing a key known to exist is incomplete, so everything else it lacks is unproven too.
 *
 * @param {object} options
 * @param {string} options.bucket
 * @param {string} [options.prefix]
 * @param {boolean} [options.remote]
 * @param {Set<string>} options.expected
 * @param {string} options.label
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
