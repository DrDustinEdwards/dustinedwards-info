/**
 * Reads resource names out of the real wrangler config.
 *
 * **Nothing that talks to a bucket may name one in a string literal.** That was latent while the
 * card builder only ever PUT objects and became live when the prune landed, because a stale
 * literal would then aim a DELETE at whatever bucket still answered to that name. Deriving it
 * makes a rename a rename everywhere, and a bucket that no longer exists an immediate error.
 *
 * This reads the REAL file, because the example carries placeholder ids and a build script needs
 * the truth; `check:config` is what keeps the two describing the same binding surface.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONFIG = join(root, "wrangler.jsonc");

/**
 * JSONC to JSON. Comments only; this config has no trailing commas.
 *
 * @returns {any}
 */
/*
 * WEAK ON PURPOSE, this being JSONC on its way to JSON.parse: the shared strong stripper's
 * line-comment rule eats a protocol-relative url and takes the rest of the line with it. Weak is
 * SUFFICIENT, because JSON.parse throws on any comment this fails to remove.
 */
export function readWranglerConfig() {
  const raw = readFileSync(CONFIG, "utf8");
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

/**
 * Every R2 bucket name the Worker binds, keyed by binding name.
 *
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
 * The D1 database NAME for a binding, or a named failure. DERIVED, not restated: another script
 * carries the same value as a literal, which is the mirror shape this repo keeps paying for.
 *
 * @param {string} binding
 */
export function databaseFor(binding) {
  const config = readWranglerConfig();
  /** @type {Record<string, string>} */
  const names = {};
  for (const db of config.d1_databases ?? []) {
    if (db.binding && db.database_name) names[db.binding] = db.database_name;
  }
  const name = names[binding];
  if (!name) {
    throw new Error(
      `wrangler.jsonc declares no D1 binding "${binding}". Found: ${Object.keys(names).join(", ") || "none"}`,
    );
  }
  return name;
}

/**
 * One bucket by binding name, or a named failure. Throws rather than returning undefined, so a
 * typo cannot become `undefined` interpolated into a wrangler command line.
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
