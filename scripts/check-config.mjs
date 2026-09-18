/**
 * Gate over the wrangler configs: every committed `.example` declares the same BINDING SURFACE as
 * the real file beside it. Two pairs, the site and the watchdog; the real files are gitignored,
 * so the example is the only description a fresh clone can see.
 *
 * BOUNDARY: it compares each pair to itself, asks Cloudflare nothing, and knows only the kinds
 * `surfaceOf()` enumerates. WHAT IS COMPARED: names, kinds, non-identifying settings; NOT the
 * account-scoped identifiers. FAILS CLOSED: a missing or unparseable file is a failure.
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
import { assertFloor } from "./lib/floor.mjs";
import { readDevVar } from "./lib/dev-vars.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * DECLARED HERE rather than beside the floor that reads it: the `--remote` block runs first and
 * a `const` further down is in the temporal dead zone.
 */
const wantsRemote = process.argv.includes("--remote");

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
 * Vars whose VALUE is deliberately not committed, name to reason to a legal placeholder.
 * Self-policing both ways, and per entry, because "a run of zeros" is right for an id and
 * impossible for an address; `example.com` cannot be a real inbox by construction.
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
 * SHARED BY BOTH PAIRS: two routines walking two configs is the mirror this gate's own subject
 * warns about, and one tightened on a single pair fails in the direction that never reports.
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

  // A binding KIND no reader understands is absent from BOTH surfaces, so the two agree by being
  // equally blind. Reported against both files, since either may carry it.
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
   * AND A FLOOR, not just non-empty: what `> 0` cannot see is `surfaceOf()` ceasing to recognise a
   * TYPE, so both sides drop it and compare equal.
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
   * PLAIN VARS, BOTH DIRECTIONS, keys and values: `surfaceOf()` carries bindings and a var is not
   * one, so a var added to the real config reaches the Worker and is absent from every clone.
   * NOT-A-CREDENTIAL AND NOT-COMMITTABLE ARE DIFFERENT QUESTIONS, so a var may be REDACTED by
   * name, with its reason, checked both ways against the declared placeholder SHAPE.
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

  // Observability, which `surfaceOf()` cannot carry. Invocation logs were measured to include the
  // request's cookie header and connecting IP with no field-level redaction, so `invocation_logs:
  // false` IS the mechanism. Parity is not the property, so the VALUE is asserted in each.
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

/* the site Worker */

const site = comparePair({
  label: "wrangler.jsonc",
  realPath: join(root, "wrangler.jsonc"),
  examplePath: join(root, "wrangler.jsonc.example"),
  floor: 9,
  measured: 10,
  settingKeys: ["name", "main", "compatibility_date", "keep_vars", "upload_source_maps", "observability"],
});

assertThat(
  JSON.stringify(site.real.migrations ?? []) === JSON.stringify(site.example.migrations ?? []),
  "durable object migrations match",
  "A class listed in one and not the other means a clone's DO migration state diverges.",
);
// Workers Cache is not a binding, but a clone built without it would re-encode every thumbnail.
assertThat(
  JSON.stringify(site.real.cache ?? null) === JSON.stringify(site.example.cache ?? null),
  "cache block matches",
  `real: ${JSON.stringify(site.real.cache ?? null)} | example: ${JSON.stringify(site.example.cache ?? null)}`,
);
// PARITY IS NOT THE PROPERTY: the comparison above passes with the cache OFF in both, which is
// not the state `workers/app.ts` is written against. Asserted by VALUE, in both files.
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
// The length check makes the empty case explicit rather than incidental.
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
/*
 * THE SENTINEL IS A WORD, NOT A NUL: a NUL makes git render the file BINARY and ripgrep skip it,
 * so every later change here would ride in unreviewed.
 */
assertThat(
  exampleDbId !== (site.real.d1_databases?.[0]?.database_id ?? "(absent)"),
  "example's database_id is not the real one",
);
assertThat(
  exampleKvId !== (site.real.kv_namespaces?.[0]?.id ?? "(absent)"),
  "example's KV id is not the real one",
);

/* the watchdog Worker */

/*
 * The watchdog is a second Worker with its own config, cron and redacted var. `workers_dev` is
 * false in both: it exports `scheduled` only, so a public route is a second way in to a Worker
 * holding the operator token.
 */
const watchdog = comparePair({
  label: "wrangler.watchdog.jsonc",
  realPath: join(root, "wrangler.watchdog.jsonc"),
  examplePath: join(root, "wrangler.watchdog.jsonc.example"),
  floor: 2,
  measured: 2,
  settingKeys: ["name", "main", "compatibility_date", "workers_dev", "observability"],
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
 * THE CRON, AND THIS CONFIG IS ITS ONE OWNER: the trigger exists, there is EXACTLY ONE, and it
 * means fifteen minutes. Exactly one, because `check:invariants` section 25 compares one schedule
 * against one constant. In both files, or a clone deploys a Worker with no schedule.
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

/*
 * THE SITE'S CRON SET IS DECLARED, AND DECLARING IT EMPTY IS THE POINT: absent is not empty, so
 * with no `triggers` key wrangler leaves whatever is registered, and an hourly trigger sat on a
 * Worker exporting no `scheduled()`. ASSERTED AS PRESENT-AND-ARRAY, since two files that both
 * omit the key agree perfectly.
 */
for (const [label, config] of [
  ["real", site.real],
  ["example", site.example],
]) {
  assertThat(
    Array.isArray(config.triggers?.crons),
    `the site declares a triggers.crons array in the ${label} config`,
    `found ${JSON.stringify(config.triggers ?? null)}. An ABSENT triggers key does not ` +
      `mean "no crons": wrangler leaves already-registered triggers alone, so the key ` +
      `has to be present and empty for this config to own the cron set.`,
  );
}
assertThat(
  JSON.stringify(site.real.triggers ?? null) === JSON.stringify(site.example.triggers ?? null),
  "the site's triggers block matches",
  `real: ${JSON.stringify(site.real.triggers ?? null)} | ` +
    `example: ${JSON.stringify(site.example.triggers ?? null)}`,
);

/* both, against the tree */

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
 * THE REAL REDACTED VALUES APPEAR IN NO TRACKED FILE: the placeholder assertions police one
 * field in one file and say nothing about the same digits in a script, which is where the account
 * id was. The needles are READ OUT OF THE REAL CONFIGS and scoped to `git ls-files`.
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
   * SCOPE, ASSERTED on both halves: an empty needle list finds nothing because it looked for
   * nothing, and a short one matches noise, which is why the floor is on the COUNT.
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

/* the traces ruling */

/*
 * TRACES STAY OFF ON BOTH WORKERS, asserted as the RULING: a fetch span carries the full path,
 * and this site puts a capability in one. EXPLICITLY-FALSE, not merely falsy: absent is off by
 * nobody having decided, so a config that DROPPED the key would pass a truthiness check.
 */
for (const [label, config] of [
  ["site real", site.real],
  ["site example", site.example],
  ["watchdog real", watchdog.real],
  ["watchdog example", watchdog.example],
]) {
  const traces = config.observability?.traces;
  assertThat(
    traces !== undefined && traces !== null,
    `${label} declares observability.traces explicitly`,
    `found ${JSON.stringify(traces ?? null)}. An ABSENT traces key is off by nobody ` +
      `deciding; the ruling wants off by somebody deciding, so the key has to be there.`,
  );
  assertThat(
    traces?.enabled === false,
    `${label} has traces disabled`,
    `found enabled=${JSON.stringify(traces?.enabled)}. Turning traces on ships ` +
      `url.full, and this site puts a preview capability in a URL path. If this is ` +
      `deliberate, the redaction has to be solved first.`,
  );
}

/* --remote: the live schedules */

/*
 * THE ONE ASSERTION THIS GATE COULD NOT MAKE. check:browser proves the WATCHDOG's cron fires and
 * says nothing about a cron registered on the SITE Worker that should not exist. One was. So the
 * platform's schedules are compared IN BOTH DIRECTIONS. Behind `--remote` rather than a new gate,
 * this one being tiered offline, and FAILING CLOSED ON A MISSING CREDENTIAL, since `--remote` was
 * asked for and a quiet pass reports the same green as "I did not look".
 */
if (wantsRemote) {
  const token = readDevVar("CLOUDFLARE_API_TOKEN");
  const account = site.real.vars?.CLOUDFLARE_ACCOUNT_ID;

  assertThat(
    Boolean(token),
    "CLOUDFLARE_API_TOKEN is readable from .dev.vars",
    "Absent, so the live schedules cannot be read and --remote proves nothing. It needs " +
      "only Account / Workers Scripts / Read. It is an operator credential for this " +
      "machine rather than a wrangler secret, because no deployed code reads it; put it " +
      "in .dev.vars, which is gitignored.",
  );
  assertThat(
    typeof account === "string" && !/^0+$/.test(account),
    "the real config carries a usable CLOUDFLARE_ACCOUNT_ID",
    `found ${JSON.stringify(account ?? null)}. The example's placeholder cannot address ` +
      `an account.`,
  );

  if (token && typeof account === "string" && !/^0+$/.test(account)) {
    for (const [worker, config] of [
      ["dustinedwards", site.real],
      ["dustinedwards-watchdog", watchdog.real],
    ]) {
      const declared = [...(config.triggers?.crons ?? [])].sort();
      let live = null;
      try {
        const res = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${worker}/schedules`,
          { headers: { authorization: `Bearer ${token}` } },
        );
        const body = await res.json();
        if (!res.ok || body?.success !== true) {
          // The API echoes error CODES, never the credential, so this is safe to print.
          assertThat(
            false,
            `the schedules API answered for ${worker}`,
            `HTTP ${res.status}: ${JSON.stringify(body?.errors ?? body).slice(0, 300)}`,
          );
          continue;
        }
        live = (body.result?.schedules ?? [])
          .map((/** @type {{ cron: string }} */ s) => s.cron)
          .sort();
      } catch (error) {
        assertThat(
          false,
          `the schedules API answered for ${worker}`,
          error instanceof Error ? error.message : String(error),
        );
        continue;
      }

      /* BOTH DIRECTIONS, NAMED SEPARATELY: one comparison of two sorted arrays says only "they differ". */
      const stray = live.filter((/** @type {string} */ c) => !declared.includes(c));
      const missing = declared.filter((/** @type {string} */ c) => !live.includes(c));

      assertThat(
        stray.length === 0,
        `${worker} has no cron trigger that the config does not declare`,
        `registered on the platform and absent from wrangler config: ` +
          `${JSON.stringify(stray)}. A trigger nothing declares survives every deploy and ` +
          `fires forever. Remove it, or declare it.`,
      );
      assertThat(
        missing.length === 0,
        `${worker} has every cron trigger the config declares`,
        `declared in wrangler config and NOT registered: ${JSON.stringify(missing)}. ` +
          `The Worker will never fire on that schedule.`,
      );
      console.log(`  ${worker}: ${live.length} live cron(s) ${JSON.stringify(live)}`);
    }
  }
}

console.log(
  `  ${site.surface.size} site binding(s): ${[...site.surface.keys()].join(", ")}`,
);
console.log(
  `  ${watchdog.surface.size} watchdog binding(s): ${[...watchdog.surface.keys()].join(", ")}`,
);
/*
 * EXECUTED-COUNT FLOOR. If a parse returned an empty surface, every comparison for that pair
 * would iterate nothing and report perfect agreement. RE-MEASURED BY RUNNING IT, never summed.
 */
/*
 * The floor tracks the OFFLINE count deliberately: `--remote` adds assertions, and a floor set
 * from the remote count breaches on every offline run, which is the tier ship uses.
 */
/*
 * NAMED PER BRANCH: one name for both judges whichever branch ran last against the other's floor,
 * which is what happened here, passing standalone and failing inside `check:all`.
 */
const MINIMUM_CHECKS = wantsRemote ? 119 : 113;
const floorBreach = assertFloor(
  "check:config",
  wantsRemote ? "checks-remote" : "checks-offline",
  checks,
  MINIMUM_CHECKS,
);
if (floorBreach) assertThat(false, "this gate executed its assertions", floorBreach);

console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}\n`);
/*
 * `exitCode` RATHER THAN `process.exit()`, `--remote` having made this gate do network I/O: it
 * tears the process down while sockets close and exits 127 under a clean table. It is a RACE,
 * which is worse than a consistent failure because `check-all.mjs` reads exit codes.
 */
process.exitCode = failures > 0 ? 1 : 0;
