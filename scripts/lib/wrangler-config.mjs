/**
 * Reads resource names out of the real wrangler config.
 *
 * **Nothing that talks to a bucket may name one in a string literal.** That was
 * already a latent hazard while `build:og` only ever PUT objects; it became a
 * live one when the prune landed, because a stale literal would then aim a
 * DELETE at whatever bucket happened to still answer to that name. Deriving it
 * means renaming a bucket in the config is a rename everywhere, and a bucket
 * that no longer exists is an immediate error rather than a silent no-op.
 *
 * `wrangler.jsonc` is gitignored and `wrangler.jsonc.example` is tracked, per
 * the portfolio's public-repo hygiene rule. This reads the REAL file, because
 * the example carries placeholder ids and a build script needs the truth;
 * `check:config` is what keeps the two describing the same binding surface.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONFIG = join(root, "wrangler.jsonc");

/**
 * JSONC to JSON. Comments only; this config has no trailing commas. Same
 * stripping `check-config.mjs` does, and for the same reason.
 * @returns {any}
 */
export function readWranglerConfig() {
  const raw = readFileSync(CONFIG, "utf8");
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

/**
 * Every R2 bucket name the Worker binds, keyed by binding name.
 * @returns {Record<string, string>}
 */
export function bucketNames() {
  const config = readWranglerConfig();
  /** @type {Record<string, string>} */
  const out = {};
  for (const bucket of config.r2_buckets ?? []) {
    if (bucket.binding && bucket.bucket_name) out[bucket.binding] = bucket.bucket_name;
  }
  if (Object.keys(out).length === 0) {
    throw new Error(`no r2_buckets found in ${CONFIG}, which cannot be right`);
  }
  return out;
}

/**
 * One bucket by binding name, or a named failure.
 *
 * Throws rather than returning undefined, so a typo cannot become `undefined`
 * interpolated into a wrangler command line.
 *
 * @param {string} binding
 */
export function bucketFor(binding) {
  const names = bucketNames();
  const name = names[binding];
  if (!name) {
    throw new Error(
      `wrangler.jsonc declares no R2 binding "${binding}". Found: ${Object.keys(names).join(", ")}`,
    );
  }
  return name;
}
