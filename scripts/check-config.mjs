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

import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseJsonc,
  surfaceOf,
  unhandledBindingKinds,
} from "./lib/wrangler-surface.mjs";

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


const realSurface = surfaceOf(real);
const exampleSurface = surfaceOf(example);

// A binding KIND no reader understands is absent from BOTH surfaces, so the two
// agree by being equally blind and this gate passes. Found by planting
// `vectorize` in the example and watching check:stack pass; the same hole was
// here. Reported against both files, since either may carry it.
for (const [label, config] of [
  ["wrangler.jsonc", real],
  ["wrangler.jsonc.example", example],
]) {
  const unreadable = unhandledBindingKinds(config);
  assert(
    unreadable.length === 0,
    `every binding kind in ${label} can be read`,
    `${unreadable.join(", ")} is invisible to this comparison. ` +
      `Add a reader in scripts/lib/wrangler-surface.mjs.`,
  );
}

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
// PARITY IS NOT THE PROPERTY. The comparison above passes with the cache turned
// OFF in both files, which is the state `workers/app.ts` is written against:
// its `private, no-store` default exists precisely because a response with no
// Cache-Control is cached rather than skipped. Turning the block off in both
// places would be a silent, symmetric change to what the Worker's fail-closed
// default is defending. Asserted by VALUE, in both files, for that reason.
for (const [label, config] of [
  ["real", real],
  ["example", example],
]) {
  assert(
    config.cache?.enabled === true,
    `Workers Cache is enabled in the ${label} config`,
    `${label}.cache: ${JSON.stringify(config.cache ?? null)}. If this was turned off ` +
      `deliberately, the cache-control default in workers/app.ts and its assertions in ` +
      `check:headers are the other half of that decision.`,
  );
}

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
  exampleDbId !== (real.d1_databases?.[0]?.database_id ?? "\u0000"),
  "example's database_id is not the real one",
);
assert(
  exampleKvId !== (real.kv_namespaces?.[0]?.id ?? "\u0000"),
  "example's KV id is not the real one",
);

console.log(
  `  ${realSurface.size} binding(s) compared: ${[...realSurface.keys()].join(", ")}`,
);
console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}\n`);
process.exit(failures > 0 ? 1 : 0);
