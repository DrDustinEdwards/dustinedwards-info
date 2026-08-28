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

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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
function assertThat(ok, label, detail) {
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


/**
 * Vars whose VALUE is deliberately not committed, name to reason.
 *
 * Self-policing in both directions: an entry naming a var neither file declares
 * fails below, and a var in here must be a placeholder in the example rather
 * than merely different from the real value.
 *
 * @type {Map<string, string>}
 */
const REDACTED_VARS = new Map([
  [
    "CLOUDFLARE_ACCOUNT_ID",
    "an account-scoped identifier. Not a credential, which is why it is a var " +
      "rather than a wrangler secret, and still covered by the portfolio rule " +
      "that account-scoped identifiers stay out of git",
  ],
]);

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
  assertThat(
    unreadable.length === 0,
    `every binding kind in ${label} can be read`,
    `${unreadable.join(", ")} is invisible to this comparison. ` +
      `Add a reader in scripts/lib/wrangler-surface.mjs.`,
  );
}

// An assertion that can pass by reading nothing is not an assertion.
assertThat(
  realSurface.size > 0,
  "the real config declares at least one binding",
  "surfaceOf() found none, so every comparison below would pass vacuously.",
);

/*
 * AND A FLOOR, not just a non-empty check, added by the 2026-08-24 floor sweep.
 *
 * `> 0` is the weakest form of this assertion and it was the only form here.
 * The failure it cannot see is the one that actually happens: `surfaceOf()`
 * stops recognising a binding TYPE, so nine of ten bindings parse and the tenth
 * silently drops out of both sides of the comparison. Two configs that both
 * omit the same binding compare equal, which is exactly the drift this gate
 * exists to catch, and `> 0` reports it as a clean run.
 *
 * MEASURED THROUGH THIS GATE 2026-08-24 by running it: 10. Floored one under,
 * because the binding set is small and hand-maintained: it moves when a binding
 * is added, in the same commit that adds it to both files.
 */
assertThat(
  realSurface.size >= 9,
  "the real config's binding surface parsed to its full size",
  `surfaceOf() found ${realSurface.size}, floor 9, measured 10 on 2026-08-24. A binding ` +
    `type it stopped recognising drops out of BOTH sides and compares equal.`,
);

for (const [key, settings] of realSurface) {
  assertThat(
    exampleSurface.has(key),
    `example declares ${key}`,
    "It is in wrangler.jsonc but not in the example, so a fresh clone would not get it.",
  );
  if (exampleSurface.has(key)) {
    assertThat(
      exampleSurface.get(key) === settings,
      `${key} settings match`,
      `real: ${settings || "(none)"} | example: ${exampleSurface.get(key) || "(none)"}`,
    );
  }
}

for (const key of exampleSurface.keys()) {
  assertThat(
    realSurface.has(key),
    `real config still declares ${key}`,
    "It is in the example but not in wrangler.jsonc, so the example describes a binding that no longer exists.",
  );
}

// Settings that change how the Worker runs and are not account-scoped.
for (const key of ["name", "main", "compatibility_date", "keep_vars", "upload_source_maps"]) {
  assertThat(
    JSON.stringify(real[key]) === JSON.stringify(example[key]),
    `${key} matches`,
    `real: ${JSON.stringify(real[key])} | example: ${JSON.stringify(example[key])}`,
  );
}
assertThat(
  JSON.stringify(real.compatibility_flags ?? []) ===
    JSON.stringify(example.compatibility_flags ?? []),
  "compatibility_flags match",
);

/*
 * PLAIN VARS, BOTH DIRECTIONS, keys and values.
 *
 * `surfaceOf()` carries BINDINGS, and a var is not a binding, so before this
 * block the `vars` object was compared by nothing at all: a var added to
 * wrangler.jsonc and forgotten in the example would reach the running Worker
 * and be absent from every clone, which is the exact drift this gate exists to
 * catch for everything else. Found 2026-08-14 while adding the first var.
 *
 * VALUES are compared, not just names, and that is deliberate. A var is by
 * definition not a credential (a credential goes in `wrangler secret`), so the
 * example can usually carry the real value and there is nothing to redact.
 *
 * THAT PARAGRAPH ENDED "a var whose value legitimately differs per clone would
 * be a new decision, and it should arrive as a change to this assertion with the
 * reason attached rather than as a silent divergence." This is that change,
 *2026-08-28, and the reason is below.
 *
 * NOT-A-CREDENTIAL AND NOT-COMMITTABLE ARE TWO DIFFERENT QUESTIONS, and the old
 * paragraph collapsed them. `CLOUDFLARE_ACCOUNT_ID` is an identifier: it grants
 * nothing on its own, which is why it is a var and not a secret. It is also
 * ACCOUNT-SCOPED, and the portfolio rule keeps account-scoped identifiers out of
 * git, which the `database_id` and the KV `id` in the same file already follow.
 * One value in a file being real while its neighbours are placeholders is a
 * convention somebody has to remember rather than a rule.
 *
 * So a var may be REDACTED, by name, with its reason, and the redaction is
 * checked in both directions: the example must carry a placeholder AND must not
 * carry the real value. The map polices itself, so an entry naming a var that no
 * longer exists fails here rather than quietly exempting nothing.
 */
{
  const realVars = /** @type {Record<string, unknown>} */ (real.vars ?? {});
  const exampleVars = /** @type {Record<string, unknown>} */ (example.vars ?? {});
  for (const key of Object.keys(realVars)) {
    assertThat(
      Object.hasOwn(exampleVars, key),
      `example declares the var ${key}`,
      "It is in wrangler.jsonc and not in the example, so a fresh clone runs without it.",
    );
    if (!Object.hasOwn(exampleVars, key)) continue;
    const why = REDACTED_VARS.get(key);
    if (why) {
      assertThat(
        JSON.stringify(realVars[key]) !== JSON.stringify(exampleVars[key]),
        `redacted var ${key} is NOT the real value in the example`,
        `the example carries the real value. ${why}`,
      );
      assertThat(
        /^0+$/.test(String(exampleVars[key] ?? "")),
        `redacted var ${key} is a placeholder in the example`,
        `example carries ${JSON.stringify(exampleVars[key])}, which is neither the ` +
          `real value nor a run of zeros. A third value is a third thing to keep true.`,
      );
      continue;
    }
    assertThat(
      JSON.stringify(realVars[key]) === JSON.stringify(exampleVars[key]),
      `var ${key} matches`,
      `real: ${JSON.stringify(realVars[key])} | example: ${JSON.stringify(exampleVars[key])}`,
    );
  }
  for (const key of Object.keys(exampleVars)) {
    assertThat(
      Object.hasOwn(realVars, key),
      `real config still declares the var ${key}`,
      "It is in the example but not in wrangler.jsonc, so the example describes a var that no longer exists.",
    );
  }
}
assertThat(
  JSON.stringify(real.migrations ?? []) === JSON.stringify(example.migrations ?? []),
  "durable object migrations match",
  "A class listed in one and not the other means a clone's DO migration state diverges.",
);
// Workers Cache is not a binding, so surfaceOf() cannot carry it, but it is
// exactly the kind of setting this gate exists for: a clone that built without
// it would re-decode and re-encode every thumbnail and never say so.
assertThat(
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
  assertThat(
    config.cache?.enabled === true,
    `Workers Cache is enabled in the ${label} config`,
    `${label}.cache: ${JSON.stringify(config.cache ?? null)}. If this was turned off ` +
      `deliberately, the cache-control default in workers/app.ts and its assertions in ` +
      `check:headers are the other half of that decision.`,
  );
}

// Observability, on the cache block's reasoning and for a sharper reason.
//
// `observability` is not a binding, so surfaceOf() cannot carry it, and nothing
// compared it until now. It stopped being a debugging preference on 2026-08-14:
// an invocation log is enriched with the request context, which measurably
// included `request.headers.cookie` and `cf-connecting-ip`, so leaving those
// records on persists full reader IPs and session cookies for 7 days. There is
// no field-level redaction, so `invocation_logs: false` IS the mechanism.
//
// Parity is not the property here either. Both files could be flipped back
// together and stay consistent, so the VALUE is asserted in each, and `enabled`
// is asserted true alongside it: turning observability off wholesale would also
// satisfy an invocation_logs check while silently ending error visibility.
assertThat(
  JSON.stringify(real.observability ?? null) === JSON.stringify(example.observability ?? null),
  "observability block matches",
  `real: ${JSON.stringify(real.observability ?? null)} | ` +
    `example: ${JSON.stringify(example.observability ?? null)}`,
);
for (const [label, config] of [
  ["real", real],
  ["example", example],
]) {
  assertThat(
    config.observability?.enabled === true,
    `observability is enabled in the ${label} config`,
    `${label}.observability: ${JSON.stringify(config.observability ?? null)}. Our own console ` +
      `output and thrown errors ride on this; only the invocation record is meant to be off.`,
  );
  assertThat(
    config.observability?.logs?.invocation_logs === false,
    `invocation logs are off in the ${label} config`,
    `${label}.observability: ${JSON.stringify(config.observability ?? null)}. Turning these on ` +
      `persists request.headers.cookie and cf-connecting-ip for 7 days, and no setting redacts ` +
      `them. If that is wanted, it needs a ruling, not a config edit.`,
  );
}

// The example must NOT carry real ids: it is committed, and the convention is
// that account-scoped identifiers stay out of git.
const exampleDbId = example.d1_databases?.[0]?.database_id ?? "";
const exampleKvId = example.kv_namespaces?.[0]?.id ?? "";
assertThat(
  /^0+(-0+)*$/.test(exampleDbId.replace(/-/g, "").replace(/^/, exampleDbId ? "" : "x")) ||
    /^[0-]+$/.test(exampleDbId),
  "example's database_id is still a placeholder",
  `Found ${exampleDbId ? "a non-placeholder value" : "nothing"}.`,
);
assertThat(
  /^0+$/.test(exampleKvId),
  "example's KV id is still a placeholder",
  `Found ${exampleKvId ? "a non-placeholder value" : "nothing"}.`,
);
assertThat(
  exampleDbId !== (real.d1_databases?.[0]?.database_id ?? "\u0000"),
  "example's database_id is not the real one",
);
assertThat(
  exampleKvId !== (real.kv_namespaces?.[0]?.id ?? "\u0000"),
  "example's KV id is not the real one",
);

for (const [name, why] of REDACTED_VARS) {
  assertThat(
    Object.hasOwn(/** @type {Record<string, unknown>} */ (real.vars ?? {}), name),
    `redaction entry ${name} names a var the real config still declares`,
    `REDACTED_VARS exempts a var that no longer exists, so it exempts nothing (${why})`,
  );
}

/*
 * THE REAL ACCOUNT-SCOPED IDENTIFIERS APPEAR IN NO TRACKED FILE.
 *
 * The three placeholder assertions above each police ONE field in ONE file.
 * They say nothing about the same digits being written into a script, which is
 * where the account id actually was: `scripts/ae-probe.mjs` carried it as a
 * const, and the example carried it as a var, and both were committed while the
 * database id beside them was a row of zeros.
 *
 * The needles are READ OUT OF THE REAL CONFIG, never typed here. A gate that
 * restated the digits it is hunting would be the fourth committed copy.
 *
 * Scoped to `git ls-files`, which is the definition of "committed" that
 * matters: the real config is gitignored and is expected to contain them.
 */
{
  /** @type {Array<[string, string]>} what it is, and the value to hunt for */
  const secretsInConfig = /** @type {Array<[string, string]>} */ ([
    ["account id", String(/** @type {any} */ (real.vars ?? {}).CLOUDFLARE_ACCOUNT_ID ?? "")],
    ["D1 database_id", String(real.d1_databases?.[0]?.database_id ?? "")],
    ["KV namespace id", String(real.kv_namespaces?.[0]?.id ?? "")],
  ].filter(([, value]) => value.length >= 16));

  /*
   * SCOPE, ASSERTED, on both halves. An empty needle list finds nothing because
   * it looked for nothing, and a short one would match noise; the length filter
   * above is why the floor is on the COUNT rather than on the values.
   */
  assertThat(
    secretsInConfig.length === 3,
    `three account-scoped identifiers were read out of the real config`,
    `found ${secretsInConfig.length}. The real config's shape changed, so this scan ` +
      `is hunting for fewer things than it thinks.`,
  );

  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);

  assertThat(
    tracked.length >= 200,
    `the tracked file list is populated (${tracked.length} file(s))`,
    "git ls-files returned almost nothing, so the scan below reads no files and " +
      "reports a clean result for a repository it never opened.",
  );

  /** @type {string[]} */
  const leaks = [];
  for (const rel of tracked) {
    let text;
    try {
      text = readFileSync(join(root, rel), "utf8");
    } catch {
      continue; // A binary or deleted path. Neither can carry the digits as text.
    }
    for (const [what, value] of secretsInConfig) {
      if (text.includes(value)) leaks.push(`${rel} (${what})`);
    }
  }

  assertThat(
    leaks.length === 0,
    "no account-scoped identifier from the real config appears in a tracked file",
    `${leaks.join(", ")}. The real value is in git. Replace it with a placeholder ` +
      `and read it off the environment or the config at runtime.`,
  );
}

console.log(
  `  ${realSurface.size} binding(s) compared: ${[...realSurface.keys()].join(", ")}`,
);
/*
 * EXECUTED-COUNT FLOOR.
 *
 * This gate is the only thing binding the tracked example to the config that
 * actually runs, and the real file is gitignored. If either parse returned an
 * empty surface, every comparison below would iterate nothing and report the
 * two files in perfect agreement.
 *
 * RE-MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-28 by RUNNING it:
 * 61, after the redaction assertions and the tracked-tree scan landed. It was
 * 55 on 2026-08-14. Never summed. Floored at 56, roughly 8 percent under: the
 * count steps by two or three per binding and per var, so a single added
 * binding moves it visibly and a deleted one should be a deliberate diff.
 */
const MINIMUM_CHECKS = 56;
if (checks < MINIMUM_CHECKS) {
  assertThat(
    false,
    "this gate executed its assertions",
    `only ${checks} ran, expected at least ${MINIMUM_CHECKS}. A block was SKIPPED ` +
      `rather than failing. Measured: 55.`,
  );
}

console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}\n`);
process.exit(failures > 0 ? 1 : 0);
