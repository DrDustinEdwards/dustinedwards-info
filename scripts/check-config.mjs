/**
 * Gate: the committed wrangler.jsonc.example must declare the same BINDING
 * SURFACE as the real wrangler.jsonc.
 *
 * OBSERVATION BOUNDARY: compares the two wrangler files to each other. It does
 * not ask Cloudflare whether any of these resources EXIST, so a binding naming
 * a deleted bucket passes, and it only knows the binding kinds surfaceOf()
 * enumerates: a new kind is invisible until added there.
 *
 * Why this exists. The real config is gitignored portfolio-wide
 * (capsid/conventions.md, "Public-repo hygiene": secrets live in
 * `wrangler secret`, real wrangler.jsonc is gitignored, commit an example with
 * placeholder ids). The example is therefore the ONLY description of this
 * Worker's bindings that a fresh clone can see, and `scripts/bootstrap-config.mjs`
 * copies it into place on install.
 *
 * That mechanism has one failure mode and it happened: on 2026-08-02 an
 * `images` binding was added to the real config and not mirrored into the
 * example, so a clone would have built a site whose media thumbnails silently
 * degraded to full-resolution originals. Nothing compared the two files, so the
 * drift was invisible until someone went looking.
 *
 * This is the house rule for exactly that shape, from conventions.md: "Where
 * code hardcodes a list that mirrors schema or filesystem state, add a test that
 * derives the expected list from the source of truth and fails in both
 * directions: missing entries and orphaned ones."
 *
 * WHAT IS COMPARED: binding names, their kinds, and the non-identifying
 * settings (resource names, class names, compat date and flags, migrations).
 * WHAT IS NOT: the two account-scoped resource identifiers, `database_id` and
 * the KV namespace `id`, which are exactly what the example is meant to hold
 * placeholders for. Comparing those would demand the example carry real ids and
 * defeat the convention this gate protects.
 *
 * FAILS CLOSED. A missing or unparseable file is a failure, never a skip: a
 * gate that passes when it cannot read its inputs is the class of silent pass
 * conventions.md was written about.
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const REAL = join(root, "wrangler.jsonc");
const EXAMPLE = join(root, "wrangler.jsonc.example");

let failures = 0;
let checks = 0;

/**
 * @param {boolean} ok
 * @param {string} label
 * @param {string} [detail]
 */
function assert(ok, label, detail) {
  checks += 1;
  if (ok) return;
  failures += 1;
  console.log(`\n  FAIL  ${label}`);
  if (detail) console.log(`        ${detail}`);
}

/**
 * JSONC to JSON. Comments only; this config has no trailing commas.
 * @param {string} path
 * @returns {any}
 */
function parseJsonc(path) {
  const raw = readFileSync(path, "utf8");
  const stripped = raw
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(stripped);
}

console.log("\ncheck:config\n");

for (const [label, path] of [
  ["wrangler.jsonc", REAL],
  ["wrangler.jsonc.example", EXAMPLE],
]) {
  if (!existsSync(path)) {
    console.log(`\n  FAIL  ${label} is missing, so the two cannot be compared.`);
    process.exit(1);
  }
}

let real;
let example;
try {
  real = parseJsonc(REAL);
  example = parseJsonc(EXAMPLE);
} catch (error) {
  // Narrowed rather than asserted: under checkJs a catch binding is `unknown`.
  // Same trap bootstrap-config.mjs hit when scripts/ joined the typecheck.
  const detail = error instanceof Error ? error.message : String(error);
  console.log(`\n  FAIL  a config file did not parse: ${detail}`);
  process.exit(1);
}

/**
 * Every binding the config declares, as `KIND:NAME`, plus the settings that are
 * not account-scoped identifiers.
 * @param {any} config
 * @returns {Map<string, string>}
 */
function surfaceOf(config) {
  /** @type {Map<string, string>} */
  const out = new Map();
  for (const db of config.d1_databases ?? []) {
    out.set(`d1:${db.binding}`, `database_name=${db.database_name} migrations_dir=${db.migrations_dir}`);
  }
  for (const kv of config.kv_namespaces ?? []) out.set(`kv:${kv.binding}`, "");
  for (const r2 of config.r2_buckets ?? []) {
    out.set(`r2:${r2.binding}`, `bucket_name=${r2.bucket_name}`);
  }
  for (const ai of config.ai_search ?? []) {
    out.set(`ai_search:${ai.binding}`, `instance_name=${ai.instance_name}`);
  }
  for (const dobj of config.durable_objects?.bindings ?? []) {
    out.set(`durable_object:${dobj.name}`, `class_name=${dobj.class_name}`);
  }
  if (config.images?.binding) out.set(`images:${config.images.binding}`, "");
  // `assets.directory` is deliberately absent from both files: the Cloudflare
  // Vite plugin supplies it from the client build output. Only the binding is
  // ours to declare, so only the binding is compared.
  if (config.assets?.binding) out.set(`assets:${config.assets.binding}`, "");
  // Queue consumers are keyed by queue name rather than by a binding name,
  // because a consumer HAS no binding: it is a subscription, not a handle. The
  // retry count and the dead-letter queue are compared with it, since a clone
  // that consumed the same queue without a DLQ would silently drop every message
  // that failed three times.
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
  return out;
}

const realSurface = surfaceOf(real);
const exampleSurface = surfaceOf(example);

// An assertion that can pass by reading nothing is not an assertion.
assert(
  realSurface.size > 0,
  "the real config declares at least one binding",
  "surfaceOf() found none, so every comparison below would pass vacuously.",
);

for (const [key, settings] of realSurface) {
  assert(
    exampleSurface.has(key),
    `example declares ${key}`,
    "It is in wrangler.jsonc but not in the example, so a fresh clone would not get it.",
  );
  if (exampleSurface.has(key)) {
    assert(
      exampleSurface.get(key) === settings,
      `${key} settings match`,
      `real: ${settings || "(none)"} | example: ${exampleSurface.get(key) || "(none)"}`,
    );
  }
}

for (const key of exampleSurface.keys()) {
  assert(
    realSurface.has(key),
    `real config still declares ${key}`,
    "It is in the example but not in wrangler.jsonc, so the example describes a binding that no longer exists.",
  );
}

// Settings that change how the Worker runs and are not account-scoped.
for (const key of ["name", "main", "compatibility_date", "keep_vars", "upload_source_maps"]) {
  assert(
    JSON.stringify(real[key]) === JSON.stringify(example[key]),
    `${key} matches`,
    `real: ${JSON.stringify(real[key])} | example: ${JSON.stringify(example[key])}`,
  );
}
assert(
  JSON.stringify(real.compatibility_flags ?? []) ===
    JSON.stringify(example.compatibility_flags ?? []),
  "compatibility_flags match",
);
assert(
  JSON.stringify(real.migrations ?? []) === JSON.stringify(example.migrations ?? []),
  "durable object migrations match",
  "A class listed in one and not the other means a clone's DO migration state diverges.",
);
// Workers Cache is not a binding, so surfaceOf() cannot carry it, but it is
// exactly the kind of setting this gate exists for: a clone that built without
// it would re-decode and re-encode every thumbnail and never say so.
assert(
  JSON.stringify(real.cache ?? null) === JSON.stringify(example.cache ?? null),
  "cache block matches",
  `real: ${JSON.stringify(real.cache ?? null)} | example: ${JSON.stringify(example.cache ?? null)}`,
);

// The example must NOT carry real ids: it is committed, and the convention is
// that account-scoped identifiers stay out of git.
const exampleDbId = example.d1_databases?.[0]?.database_id ?? "";
const exampleKvId = example.kv_namespaces?.[0]?.id ?? "";
assert(
  /^0+(-0+)*$/.test(exampleDbId.replace(/-/g, "").replace(/^/, exampleDbId ? "" : "x")) ||
    /^[0-]+$/.test(exampleDbId),
  "example's database_id is still a placeholder",
  `Found ${exampleDbId ? "a non-placeholder value" : "nothing"}.`,
);
assert(
  /^0+$/.test(exampleKvId),
  "example's KV id is still a placeholder",
  `Found ${exampleKvId ? "a non-placeholder value" : "nothing"}.`,
);
assert(
  exampleDbId !== (real.d1_databases?.[0]?.database_id ?? " "),
  "example's database_id is not the real one",
);
assert(
  exampleKvId !== (real.kv_namespaces?.[0]?.id ?? " "),
  "example's KV id is not the real one",
);

console.log(
  `  ${realSurface.size} binding(s) compared: ${[...realSurface.keys()].join(", ")}`,
);
console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}\n`);
process.exit(failures > 0 ? 1 : 0);
