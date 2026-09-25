/**
 * Nothing that talks to a bucket may name one in a string literal: a stale literal aims a DELETE
 * at whatever still answers to it. Reads the real file; the example carries placeholder ids.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { parseJsonc } from "./wrangler-surface.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONFIG = join(root, "wrangler.jsonc");

/**
 * Through the one JSONC reader, not a second regex stripper that could disagree with it.
 *
 * @returns {any}
 */
export function readWranglerConfig() {
  return parseJsonc(CONFIG);
}

/**
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
 * Throws rather than returning undefined, so a typo cannot become `undefined` in a wrangler command.
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
