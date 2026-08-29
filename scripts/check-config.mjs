/**
 * Gate over the wrangler configs: every committed `.example` must declare the
 * same BINDING SURFACE as the real file beside it.
 *
 * TWO PAIRS SINCE 2026-08-29. The site (`wrangler.jsonc`) and the watchdog
 * Worker (`wrangler.watchdog.jsonc`). Both real files are gitignored and both
 * examples are tracked, for the same portfolio reason; the watchdog's redacted
 * value is an inbox address rather than an account-scoped id, which is why the
 * placeholder rule is per-entry rather than "a run of zeros" everywhere.
 *
 * OBSERVATION BOUNDARY: compares each pair to itself. It does not ask
 * Cloudflare whether any of these resources EXIST, so a binding naming a
 * deleted bucket passes, a service binding naming a Worker nobody deployed
 * passes, and it only knows the binding kinds `surfaceOf()` enumerates: a new
 * kind is invisible until added there. It also cannot tell whether a cron
 * TRIGGER is actually registered on the deployed Worker, only what the config
 * asks for; that half is proven live by the freshness assertion in
 * `check:browser`.
 *
 * Why this exists. The real config is gitignored portfolio-wide
 * (capsid/conventions.md, "Public-repo hygiene": secrets live in
 * `wrangler secret`, real wrangler.jsonc is gitignored, commit an example with
 * placeholder ids). The example is therefore the ONLY description of a Worker's
 * bindings that a fresh clone can see, and `scripts/bootstrap-config.mjs`
 * copies each into place on install.
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
 * settings (resource names, class names, compat date and flags, migrations,
 * cron triggers). WHAT IS NOT: the account-scoped resource identifiers,
 * `database_id` and the KV namespace `id`, which are exactly what the example is
 * meant to hold placeholders for. Comparing those would demand the example carry
 * real ids and defeat the convention this gate protects.
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

/**
 * Vars whose VALUE is deliberately not committed: name to reason and to what a
 * legal placeholder looks like.
 *
 * Self-policing in both directions: an entry naming a var no config declares
 * fails below, and a var in here must match its placeholder shape in the
 * example rather than merely differing from the real value.
 *
 * THE PLACEHOLDER SHAPE IS PER ENTRY, since the watchdog landed. It used to be
 * "a run of zeros", which is right for an id and impossible for an email
 * address. `example.com` is RFC 2606 reserved, so the watchdog's placeholder
 * cannot be a real inbox by construction, which is the same property a row of
 * zeros has for an id: not merely different from the real value, but incapable
 * of being anyone's.
 *
 * @type {Map<string, { why: string, placeholder: RegExp, shape: string }>}
 */
const REDACTED_VARS = new Map([
  [
    "CLOUDFLARE_ACCOUNT_ID",
    {
      why:
        "an account-scoped identifier. Not a credential, which is why it is a var " +
        "rather than a wrangler secret, and still covered by the portfolio rule " +
        "that account-scoped identifiers stay out of git",
      placeholder: /^0+$/,
      shape: "a run of zeros",
    },
  ],
  [
    "ALERT_EMAIL",
    {
      why:
        "a personal inbox. Not a credential, which is why it is a var rather than " +
        "a wrangler secret, and kept out of git anyway because this repo is meant " +
        "to be copied as a template and the address would be copied with it",
      placeholder: /@example\.com$/,
      shape: "an address on the RFC 2606 reserved example.com",
    },
  ],
]);

/**
 * Compares one real config against its tracked example.
 *
 * SHARED BY BOTH PAIRS rather than written twice. Two comparison routines
 * walking two configs is the mirror this gate's own docblock warns about: a
 * check tightened on one pair and forgotten on the other fails in the direction
 * that never reports, by comparing less and saying nothing.
 *
 * @param {{
 *   label: string,
 *   realPath: string,
 *   examplePath: string,
 *   floor: number,
 *   measured: number,
 *   settingKeys: string[],
 * }} pair
 * @returns {{ real: any, example: any, surface: Map<string, string> }}
 */
function comparePair({ label, realPath, examplePath, floor, measured, settingKeys }) {
  for (const [what, path] of [
    [label, realPath],
    [`${label}.example`, examplePath],
  ]) {
    if (!existsSync(path)) {
      console.log(`\n  FAIL  ${what} is missing, so the pair cannot be compared.`);
      process.exit(1);
    }
  }

  let real;
  let example;
  try {
    real = parseJsonc(realPath);
    example = parseJsonc(examplePath);
  } catch (error) {
    // Narrowed rather than asserted: under checkJs a catch binding is `unknown`.
    // Same trap bootstrap-config.mjs hit when scripts/ joined the typecheck.
    const detail = error instanceof Error ? error.message : String(error);
    console.log(`\n  FAIL  a ${label} file did not parse: ${detail}`);
    process.exit(1);
  }

  const realSurface = surfaceOf(real);
  const exampleSurface = surfaceOf(example);

  // A binding KIND no reader understands is absent from BOTH surfaces, so the
  // two agree by being equally blind and this gate passes. Found by planting
  // `vectorize` in the example and watching check:stack pass; the same hole was
  // here. Reported against both files, since either may carry it.
  for (const [what, config] of [
    [label, real],
    [`${label}.example`, example],
  ]) {
    const unreadable = unhandledBindingKinds(config);
    assertThat(
      unreadable.length === 0,
      `every binding kind in ${what} can be read`,
      `${unreadable.join(", ")} is invisible to this comparison. ` +
        `Add a reader in scripts/lib/wrangler-surface.mjs.`,
    );
  }

  // An assertion that can pass by reading nothing is not an assertion.
  assertThat(
    realSurface.size > 0,
    `${label} declares at least one binding`,
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
   * MEASURED THROUGH THIS GATE'S OWN PIPELINE by running it, per pair. Floored
   * just under, because each binding set is small and hand-maintained: it moves
   * when a binding is added, in the same commit that adds it to both files.
   */
  assertThat(
    realSurface.size >= floor,
    `${label}'s binding surface parsed to its full size`,
    `surfaceOf() found ${realSurface.size}, floor ${floor}, measured ${measured}. A binding ` +
      `type it stopped recognising drops out of BOTH sides and compares equal.`,
  );

  for (const [key, settings] of realSurface) {
    assertThat(
      exampleSurface.has(key),
      `${label}.example declares ${key}`,
      `It is in ${label} but not in the example, so a fresh clone would not get it.`,
    );
    if (exampleSurface.has(key)) {
      assertThat(
        exampleSurface.get(key) === settings,
        `${label} ${key} settings match`,
        `real: ${settings || "(none)"} | example: ${exampleSurface.get(key) || "(none)"}`,
      );
    }
  }

  for (const key of exampleSurface.keys()) {
    assertThat(
      realSurface.has(key),
      `${label} still declares ${key}`,
      "It is in the example but not in the real config, so the example describes a binding that no longer exists.",
    );
  }

  // Settings that change how the Worker runs and are not account-scoped.
  for (const key of settingKeys) {
    assertThat(
      JSON.stringify(real[key]) === JSON.stringify(example[key]),
      `${label} ${key} matches`,
      `real: ${JSON.stringify(real[key])} | example: ${JSON.stringify(example[key])}`,
    );
  }
  assertThat(
    JSON.stringify(real.compatibility_flags ?? []) ===
      JSON.stringify(example.compatibility_flags ?? []),
    `${label} compatibility_flags match`,
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
   * NOT-A-CREDENTIAL AND NOT-COMMITTABLE ARE TWO DIFFERENT QUESTIONS, and an
   * earlier version of this paragraph collapsed them. `CLOUDFLARE_ACCOUNT_ID` is
   * an identifier: it grants nothing on its own, which is why it is a var and not
   * a secret. It is also ACCOUNT-SCOPED, and the portfolio rule keeps
   * account-scoped identifiers out of git. `ALERT_EMAIL` is the second instance
   * of the same distinction wearing different clothes: an inbox address grants
   * nothing either, and belongs out of git for a different reason, that this repo
   * gets copied.
   *
   * So a var may be REDACTED, by name, with its reason, and the redaction is
   * checked in both directions: the example must carry a placeholder of the
   * declared SHAPE and must not carry the real value.
   */
  {
    const realVars = /** @type {Record<string, unknown>} */ (real.vars ?? {});
    const exampleVars = /** @type {Record<string, unknown>} */ (example.vars ?? {});
    for (const key of Object.keys(realVars)) {
      assertThat(
        Object.hasOwn(exampleVars, key),
        `${label}.example declares the var ${key}`,
        `It is in ${label} and not in the example, so a fresh clone runs without it.`,
      );
      if (!Object.hasOwn(exampleVars, key)) continue;
      const redaction = REDACTED_VARS.get(key);
      if (redaction) {
        assertThat(
          JSON.stringify(realVars[key]) !== JSON.stringify(exampleVars[key]),
          `${label} redacted var ${key} is NOT the real value in the example`,
          `the example carries the real value. ${redaction.why}`,
        );
        assertThat(
          redaction.placeholder.test(String(exampleVars[key] ?? "")),
          `${label} redacted var ${key} is a placeholder in the example`,
          `example carries ${JSON.stringify(exampleVars[key])}, which is neither the ` +
            `real value nor ${redaction.shape}. A third value is a third thing to keep true.`,
        );
        continue;
      }
      assertThat(
        JSON.stringify(realVars[key]) === JSON.stringify(exampleVars[key]),
        `${label} var ${key} matches`,
        `real: ${JSON.stringify(realVars[key])} | example: ${JSON.stringify(exampleVars[key])}`,
      );
    }
    for (const key of Object.keys(exampleVars)) {
      assertThat(
        Object.hasOwn(realVars, key),
        `${label} still declares the var ${key}`,
        "It is in the example but not in the real config, so the example describes a var that no longer exists.",
      );
    }
  }

  // Observability. Not a binding, so surfaceOf() cannot carry it, and nothing
  // compared it until 2026-08-14. It stopped being a debugging preference then:
  // an invocation log is enriched with the request context, which measurably
  // included `request.headers.cookie` and `cf-connecting-ip`, so leaving those
  // records on persists full reader IPs and session cookies for 7 days. There is
  // no field-level redaction, so `invocation_logs: false` IS the mechanism.
  //
  // Parity is not the property. Both files could be flipped back together and
  // stay consistent, so the VALUE is asserted in each, and `enabled` is asserted
  // true alongside it: turning observability off wholesale would also satisfy an
  // invocation_logs check while silently ending error visibility.
  assertThat(
    JSON.stringify(real.observability ?? null) === JSON.stringify(example.observability ?? null),
    `${label} observability block matches`,
    `real: ${JSON.stringify(real.observability ?? null)} | ` +
      `example: ${JSON.stringify(example.observability ?? null)}`,
  );
  for (const [what, config] of [
    [`${label} real`, real],
    [`${label} example`, example],
  ]) {
    assertThat(
      config.observability?.enabled === true,
      `observability is enabled in the ${what} config`,
      `${what}.observability: ${JSON.stringify(config.observability ?? null)}. Our own console ` +
        `output and thrown errors ride on this; only the invocation record is meant to be off.`,
    );
    assertThat(
      config.observability?.logs?.invocation_logs === false,
      `invocation logs are off in the ${what} config`,
      `${what}.observability: ${JSON.stringify(config.observability ?? null)}. Turning these on ` +
        `persists request.headers.cookie and cf-connecting-ip for 7 days, and no setting redacts ` +
        `them. If that is wanted, it needs a ruling, not a config edit.`,
    );
  }

  return { real, example, surface: realSurface };
}

/* ======================================================== the site Worker */

const site = comparePair({
  label: "wrangler.jsonc",
  realPath: join(root, "wrangler.jsonc"),
  examplePath: join(root, "wrangler.jsonc.example"),
  floor: 9,
  measured: 10,
  settingKeys: ["name", "main", "compatibility_date", "keep_vars", "upload_source_maps"],
});

assertThat(
  JSON.stringify(site.real.migrations ?? []) === JSON.stringify(site.example.migrations ?? []),
  "durable object migrations match",
  "A class listed in one and not the other means a clone's DO migration state diverges.",
);
// Workers Cache is not a binding, so surfaceOf() cannot carry it, but it is
// exactly the kind of setting this gate exists for: a clone that built without
// it would re-decode and re-encode every thumbnail and never say so.
assertThat(
  JSON.stringify(site.real.cache ?? null) === JSON.stringify(site.example.cache ?? null),
  "cache block matches",
  `real: ${JSON.stringify(site.real.cache ?? null)} | example: ${JSON.stringify(site.example.cache ?? null)}`,
);
// PARITY IS NOT THE PROPERTY. The comparison above passes with the cache turned
// OFF in both files, which is the state `workers/app.ts` is written against:
// its `private, no-store` default exists precisely because a response with no
// Cache-Control is cached rather than skipped. Turning the block off in both
// places would be a silent, symmetric change to what the Worker's fail-closed
// default is defending. Asserted by VALUE, in both files, for that reason.
for (const [label, config] of [
  ["real", site.real],
  ["example", site.example],
]) {
  assertThat(
    config.cache?.enabled === true,
    `Workers Cache is enabled in the ${label} config`,
    `${label}.cache: ${JSON.stringify(config.cache ?? null)}. If this was turned off ` +
      `deliberately, the cache-control default in workers/app.ts and its assertions in ` +
      `check:headers are the other half of that decision.`,
  );
}

// The example must NOT carry real ids: it is committed, and the convention is
// that account-scoped identifiers stay out of git.
const exampleDbId = site.example.d1_databases?.[0]?.database_id ?? "";
const exampleKvId = site.example.kv_namespaces?.[0]?.id ?? "";
// SIMPLIFIED 2026-08-29, behaviour preserving. The original was a disjunction
// whose first arm stripped the dashes, prepended an "x" when the string was
// empty, and then tested a pattern the second arm already covered; both arms
// rejected the empty string and every real id, so this is the same predicate
// written once. The length check makes the empty case explicit rather than
// incidental.
assertThat(
  /^[0-]+$/.test(exampleDbId) && exampleDbId.length > 0,
  "example's database_id is still a placeholder",
  `Found ${exampleDbId ? JSON.stringify(exampleDbId) : "nothing"}.`,
);
assertThat(
  /^0+$/.test(exampleKvId),
  "example's KV id is still a placeholder",
  `Found ${exampleKvId ? "a non-placeholder value" : "nothing"}.`,
);
assertThat(
  exampleDbId !== (site.real.d1_databases?.[0]?.database_id ?? " "),
  "example's database_id is not the real one",
);
assertThat(
  exampleKvId !== (site.real.kv_namespaces?.[0]?.id ?? " "),
  "example's KV id is not the real one",
);

/* ==================================================== the watchdog Worker */

/*
 * ADDED 2026-08-29. The watchdog is a second Worker with its own config, its
 * own cron and its own redacted var, and before this it was described by
 * nothing: a binding added to it and forgotten in the example would have been
 * invisible in exactly the way the `images` binding was in August.
 *
 * `main` is compared like the site's. `workers_dev` is compared AND asserted
 * false in both, on the cache block's reasoning: parity is not the property,
 * because both files could be flipped together. This Worker exports `scheduled`
 * and nothing else, so a public route would answer errors to anyone who found
 * it and would be a second way in to a Worker holding the operator token.
 */
const watchdog = comparePair({
  label: "wrangler.watchdog.jsonc",
  realPath: join(root, "wrangler.watchdog.jsonc"),
  examplePath: join(root, "wrangler.watchdog.jsonc.example"),
  floor: 2,
  measured: 2,
  settingKeys: ["name", "main", "compatibility_date", "workers_dev"],
});

for (const [label, config] of [
  ["real", watchdog.real],
  ["example", watchdog.example],
]) {
  assertThat(
    config.workers_dev === false,
    `the watchdog has no workers.dev route in the ${label} config`,
    `${label}.workers_dev: ${JSON.stringify(config.workers_dev ?? null)}. This Worker exports ` +
      `only \`scheduled\`, so a public route is a surface with no purpose on a Worker that ` +
      `holds the operator token.`,
  );
  assertThat(
    config.main === "./workers/watchdog.ts",
    `the watchdog config points at the watchdog entry in the ${label} config`,
    `${label}.main: ${JSON.stringify(config.main ?? null)}.`,
  );
}

/*
 * THE CRON, AND THIS CONFIG IS NOW ITS ONE OWNER.
 *
 * `HEALTH_POLL_INTERVAL_SECONDS` in app/lib/health/snapshot.mjs decides when
 * the home page calls its health verdict stale. Until 2026-08-29 that number
 * was bound to `.github/workflows/health.yml`'s cron by `check:invariants`
 * section 25. The watchdog now sets the pace and health.yml is the hourly
 * second opinion, so section 25 parses THIS file instead. The binding lives
 * there; what lives here is that the trigger exists, that there is exactly
 * ONE of it, and that it means fifteen minutes.
 *
 * EXACTLY ONE, because section 25 compares one schedule against one constant
 * and cannot arbitrate between two. Asserted in both files: a cron in the real
 * config and none in the example describes a Worker a clone would deploy
 * without a schedule, which is a watchdog that never fires and says nothing.
 */
for (const [label, config] of [
  ["real", watchdog.real],
  ["example", watchdog.example],
]) {
  const crons = config.triggers?.crons ?? [];
  assertThat(
    Array.isArray(crons) && crons.length === 1,
    `the watchdog declares exactly one cron in the ${label} config`,
    `found ${Array.isArray(crons) ? crons.length : "no array"}: ` +
      `${JSON.stringify(crons)}. A watchdog with no trigger never fires and reports nothing; ` +
      `two triggers is a schedule check:invariants section 25 cannot arbitrate.`,
  );
  assertThat(
    crons[0] === "*/15 * * * *",
    `the watchdog's cron is every 15 minutes in the ${label} config`,
    `found ${JSON.stringify(crons[0] ?? null)}. This is the poll interval the home page's ` +
      `health tile is measured against; check:invariants section 25 parses it and fails if it ` +
      `stops meaning ${15 * 60} seconds.`,
  );
}
assertThat(
  JSON.stringify(watchdog.real.triggers ?? null) ===
    JSON.stringify(watchdog.example.triggers ?? null),
  "the watchdog's triggers block matches",
  `real: ${JSON.stringify(watchdog.real.triggers ?? null)} | ` +
    `example: ${JSON.stringify(watchdog.example.triggers ?? null)}`,
);

/* ================================================ both, against the tree */

for (const [name, redaction] of REDACTED_VARS) {
  assertThat(
    [site.real, watchdog.real].some((config) =>
      Object.hasOwn(/** @type {Record<string, unknown>} */ (config.vars ?? {}), name),
    ),
    `redaction entry ${name} names a var some real config still declares`,
    `REDACTED_VARS exempts a var that no longer exists, so it exempts nothing (${redaction.why})`,
  );
}

/*
 * THE REAL REDACTED VALUES APPEAR IN NO TRACKED FILE.
 *
 * The placeholder assertions above each police ONE field in ONE file. They say
 * nothing about the same digits being written into a script, which is where the
 * account id actually was: `scripts/ae-probe.mjs` carried it as a const, and the
 * example carried it as a var, and both were committed while the database id
 * beside them was a row of zeros.
 *
 * The needles are READ OUT OF THE REAL CONFIGS, never typed here. A gate that
 * restated the digits it is hunting would be the next committed copy. The
 * watchdog's alert address joined the hunt in the same commit that introduced
 * it, so it can never become the thing this paragraph describes.
 *
 * Scoped to `git ls-files`, which is the definition of "committed" that
 * matters: the real configs are gitignored and are expected to contain them.
 */
{
  /** @type {Array<[string, string]>} what it is, and the value to hunt for */
  const secretsInConfig = /** @type {Array<[string, string]>} */ ([
    ["account id", String(/** @type {any} */ (site.real.vars ?? {}).CLOUDFLARE_ACCOUNT_ID ?? "")],
    ["D1 database_id", String(site.real.d1_databases?.[0]?.database_id ?? "")],
    ["KV namespace id", String(site.real.kv_namespaces?.[0]?.id ?? "")],
    ["watchdog ALERT_EMAIL", String(/** @type {any} */ (watchdog.real.vars ?? {}).ALERT_EMAIL ?? "")],
  ].filter(([, value]) => value.length >= 16));

  /*
   * SCOPE, ASSERTED, on both halves. An empty needle list finds nothing because
   * it looked for nothing, and a short one would match noise; the length filter
   * above is why the floor is on the COUNT rather than on the values.
   */
  assertThat(
    secretsInConfig.length === 4,
    `four redacted values were read out of the real configs`,
    `found ${secretsInConfig.length}. A real config's shape changed, so this scan ` +
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
      continue; // A binary or deleted path. Neither can carry the value as text.
    }
    for (const [what, value] of secretsInConfig) {
      if (text.includes(value)) leaks.push(`${rel} (${what})`);
    }
  }

  assertThat(
    leaks.length === 0,
    "no redacted value from a real config appears in a tracked file",
    `${leaks.join(", ")}. The real value is in git. Replace it with a placeholder ` +
      `and read it off the environment or the config at runtime.`,
  );
}

console.log(
  `  ${site.surface.size} site binding(s): ${[...site.surface.keys()].join(", ")}`,
);
console.log(
  `  ${watchdog.surface.size} watchdog binding(s): ${[...watchdog.surface.keys()].join(", ")}`,
);
/*
 * EXECUTED-COUNT FLOOR.
 *
 * This gate is the only thing binding the tracked examples to the configs that
 * actually run, and both real files are gitignored. If a parse returned an
 * empty surface, every comparison for that pair would iterate nothing and
 * report the two files in perfect agreement.
 *
 * RE-MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-29 by RUNNING it, and
 * NEVER SUMMED: the number below was read off the run, not computed from 61
 * plus an estimate of the watchdog's contribution: the first guess written here
 * was 92 and the run said 95. It was 61 on 2026-08-28 with one pair, and 55 on
 * 2026-08-14. Floored roughly 8 percent under: the count
 * steps by two or three per binding and per var, so a single added binding
 * moves it visibly and a deleted one should be a deliberate diff.
 */
const MINIMUM_CHECKS = 87;
if (checks < MINIMUM_CHECKS) {
  assertThat(
    false,
    "this gate executed its assertions",
    `only ${checks} ran, expected at least ${MINIMUM_CHECKS}. A block was SKIPPED ` +
      `rather than failing. Measured: 95.`,
  );
}

console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}\n`);
process.exit(failures > 0 ? 1 : 0);
