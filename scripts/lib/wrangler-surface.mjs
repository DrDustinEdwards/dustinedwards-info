/**
 * The Worker's binding surface, derived from a wrangler config.
 *
 * ONE enumerator, imported by everything that needs to know what this Worker
 * binds. It was inline in `check-config.mjs` and moved here when `build:stack`
 * became a second reader: two functions walking the same config would be the
 * exact mirror `check:invariants` exists to prevent, and a binding kind added to
 * one and not the other fails silently in the direction that matters, by
 * reporting a smaller surface rather than an error.
 *
 * `assets.directory` is deliberately not part of the surface: the Cloudflare
 * Vite plugin supplies it from the client build output, so only the binding is
 * ours to declare.
 *
 * Queue CONSUMERS are keyed by queue name rather than by a binding name, because
 * a consumer has no binding: it is a subscription, not a handle.
 */

import { readFileSync } from "node:fs";

/**
 * JSONC to JSON. Comments only; these configs have no trailing commas.
 * @param {string} path
 * @returns {any}
 */
export function parseJsonc(path) {
  const raw = readFileSync(path, "utf8");
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

/**
 * How each binding kind is read, keyed by the config key that declares it.
 *
 * ONE table, so `surfaceOf` and `unhandledBindingKinds` cannot disagree about
 * what is handled: the first iterates it, the second treats its keys as the
 * allowed set. A kind added to one and not the other is not expressible.
 *
 * The settings string per kind deliberately omits account-scoped IDENTIFIERS
 * (`database_id`, the KV `id`), because the tracked example carries placeholders
 * for those and comparing them would fail on every clone. Everything else is
 * compared, so a bucket renamed in one file and not the other is caught.
 *
 * @type {Record<string, (config: any, out: Map<string, string>) => void>}
 */
const READERS = {
  d1_databases: (config, out) => {
    for (const db of config.d1_databases ?? []) {
      out.set(
        `d1:${db.binding}`,
        `database_name=${db.database_name} migrations_dir=${db.migrations_dir}`,
      );
    }
  },
  kv_namespaces: (config, out) => {
    for (const kv of config.kv_namespaces ?? []) out.set(`kv:${kv.binding}`, "");
  },
  r2_buckets: (config, out) => {
    for (const r2 of config.r2_buckets ?? []) {
      out.set(`r2:${r2.binding}`, `bucket_name=${r2.bucket_name}`);
    }
  },
  ai_search: (config, out) => {
    for (const ai of config.ai_search ?? []) {
      out.set(`ai_search:${ai.binding}`, `instance_name=${ai.instance_name}`);
    }
  },
  durable_objects: (config, out) => {
    for (const dobj of config.durable_objects?.bindings ?? []) {
      out.set(`durable_object:${dobj.name}`, `class_name=${dobj.class_name}`);
    }
  },
  images: (config, out) => {
    if (config.images?.binding) out.set(`images:${config.images.binding}`, "");
  },
  assets: (config, out) => {
    if (config.assets?.binding) out.set(`assets:${config.assets.binding}`, "");
  },
  queues: (config, out) => {
    for (const q of config.queues?.consumers ?? []) {
      out.set(
        `queue_consumer:${q.queue}`,
        `max_retries=${q.max_retries} dead_letter_queue=${q.dead_letter_queue} ` +
          `max_batch_size=${q.max_batch_size} max_batch_timeout=${q.max_batch_timeout}`,
      );
    }
    for (const q of config.queues?.producers ?? []) {
      out.set(`queue_producer:${q.binding}`, `queue=${q.queue}`);
    }
  },
};

/**
 * Every binding the config declares, as `KIND:NAME`, mapped to the settings
 * that are not account-scoped identifiers.
 *
 * @param {any} config
 * @returns {Map<string, string>}
 */
export function surfaceOf(config) {
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const read of Object.values(READERS)) read(config, out);
  return out;
}

/**
 * Config keys that DECLARE BINDINGS and that `surfaceOf` cannot read.
 *
 * **This exists because the absence of it was a live hole, found by planting the
 * exact thing it now catches.** `vectorize` was added to the tracked example and
 * both `check:config` and `check:stack` passed, because a kind no reader knows
 * about produces no rows on either side of every comparison. A gate that
 * compares two blind spots agrees with itself.
 *
 * Detection is STRUCTURAL rather than a list of Cloudflare's products, so a
 * binding type that does not exist yet is still caught. A wrangler binding
 * declaration is one of exactly three shapes:
 *
 *   an object with a `binding`                     assets, images, browser
 *   an array of objects carrying `binding`         d1, kv, r2, vectorize, ai
 *   an object with a `bindings` array              durable_objects, workflows
 *
 * `queues` matches none of these, which is correct: a consumer is a
 * subscription rather than a handle and has no `binding` at all. It is handled
 * explicitly above and so is never reported here.
 *
 * @param {any} config
 * @returns {string[]}
 */
export function unhandledBindingKinds(config) {
  const declaresBinding = (/** @type {any} */ value) => {
    if (!value || typeof value !== "object") return false;
    if (Array.isArray(value)) {
      return value.some((v) => v && typeof v === "object" && "binding" in v);
    }
    if ("binding" in value) return true;
    return (
      Array.isArray(value.bindings) &&
      value.bindings.some(
        (/** @type {any} */ v) =>
          v && typeof v === "object" && ("binding" in v || "name" in v),
      )
    );
  };

  return Object.keys(config)
    .filter((key) => !(key in READERS))
    .filter((key) => declaresBinding(config[key]))
    .sort();
}
