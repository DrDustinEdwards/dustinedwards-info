/**
 * Gate over the secret-handling boundary.
 *
 *   npm run check:secrets
 *
 * ## OBSERVATION BOUNDARY
 *
 * **THIS READS SOURCE TEXT, NOT THE BUNDLE.** It asserts that no file outside
 * the server boundary MENTIONS a secret. It cannot see what Vite actually
 * emits, so a secret read inside a legitimate `.server` module that a future
 * mis-split inlined into a client chunk is invisible here and would still ship.
 * Proving that needs the built assets, which is a different gate and a build
 * step; this one is the cheap half that catches the mistake anyone would
 * actually make, which is reading `env.GITHUB_TOKEN` somewhere convenient.
 *
 * It also says nothing about whether a secret is USED correctly once read. A
 * server module that reads a token and then puts it in a response body passes
 * here.
 *
 * Scans `app/` and `workers/`. Deliberately NOT `scripts/`: those are Node
 * programs that never reach a browser, and several legitimately read tokens
 * from `process.env` for operator round trips.
 *
 * ## Why this exists
 *
 * `OPERATOR_TOKEN` was omitted from `app/env.d.ts` while the other six secrets
 * were declared there, and nothing noticed. It was found by hand in the
 * 2026-08-07 rules audit, in a repo with eighteen gates. Hard rule 3 says
 * secrets are read only in `.server` modules and in loaders and actions, and
 * NOTHING ENFORCED IT: the rule was PROSE, and the audit's ranked backlog put
 * this second by cost, behind only the disk-versus-HEAD gap.
 *
 * The cost of the failure it guards is the highest on that list. A secret read
 * from a module the client bundle can reach does not fail loudly; it ships, and
 * the value is then readable by anyone who opens devtools.
 *
 * ## Two independent sources argue
 *
 * The SECRETS list below is transcribed from the ruling in
 * `dustinedwards/core.md`. What the code reads is parsed out of the tree. What
 * is DECLARED is parsed out of `app/env.d.ts`. Nothing here reads its
 * expectation from the file it is checking, so a secret added to the codebase
 * and not to the ruling, or declared and never listed, moves one side of a
 * comparison and fails.
 *
 * ## The boundary is by PATH, and strictly
 *
 * A file may read a secret if its name carries `.server.` or it lives under
 * `workers/`. **Loaders and actions are deliberately NOT carved out**, even
 * though hard rule 3's prose permits them, because no route in this repo reads
 * a secret directly: every one delegates to a `.server` module. Carving out
 * loaders would mean parsing block scope with a regex to permit something
 * nothing currently does, weakening the gate for no benefit. If a route ever
 * genuinely needs a secret in its loader, the honest move is an ALLOWLIST entry
 * naming the file and the reason, not a hole shaped like a language feature.
 *
 * FAILS CLOSED. An empty secret list, an unreadable `env.d.ts`, a scan that
 * examines no files, or a scan that finds no secret reads AT ALL are each a
 * failure: the last one means the matcher broke, and "0 violations" from a
 * broken matcher looks exactly like success.
 *
 * Pure: no network, no database, no build.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_TYPES = join(root, "app", "env.d.ts");

/**
 * The ratified secret list, transcribed from dustinedwards/core.md. NOT read
 * from the source.
 *
 * All seven are guarded, including the two that are arguably public. An OAuth
 * client id appears in the authorization URL a browser follows, and
 * `BETTER_AUTH_URL` is a public origin, so neither is a credential. They are
 * guarded anyway because both are read in exactly one `.server` module today,
 * so guarding them costs nothing, and because "arguably public" is the kind of
 * judgement that should be made in a diff rather than assumed by a gate.
 */
const SECRETS = [
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "ADMIN_EMAIL",
  "GITHUB_TOKEN",
  "OPERATOR_TOKEN",
];

/**
 * Names permitted OUTSIDE the server boundary, each with the reason.
 *
 * EMPTY TODAY, and that is the correct state: no client-reachable file needs
 * any of the seven. The mechanism exists so that the day one does, the decision
 * is recorded here as a named exception with a justification, rather than made
 * by deleting an assertion.
 *
 * @type {Record<string, string>}
 */
const CLIENT_ALLOWED = {};

/**
 * Bindings, which are NOT secrets and are NOT guarded.
 *
 * A binding is an object the runtime injects, not a value: it cannot be
 * serialised into a client bundle, and a client component referencing one gets
 * `undefined` rather than a leak. They are listed only so this file records the
 * full env surface, which is what the enumerate-every-site rule asks for.
 *
 * DB, APP_KV, MEDIA, OG, ASSETS, IMAGES, AI_SEARCH, ASK_BUDGET.
 *
 * Note also `import.meta.env.MODE` and `import.meta.env.DEV`: a DIFFERENT
 * namespace, Vite build constants rather than Cloudflare env, inlined at build
 * time and public by design. The matcher below is anchored so it cannot confuse
 * the two.
 */

let checks = 0;
let failures = 0;

/** @param {string} label @param {boolean} condition @param {string} [detail] */
function ok(label, condition, detail = "") {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
  }
}

console.log("\ncheck:secrets\n");

/* ------------------------------------------------------- fail closed first */

ok(
  "the ratified secret list is not empty",
  SECRETS.length > 0,
  "with no secrets named, every assertion below would pass by examining nothing",
);

if (!existsSync(ENV_TYPES)) {
  console.log("  FAIL  app/env.d.ts is missing; the declaration check cannot run.\n");
  process.exit(1);
}

/* ---------------------------------------- 1. every secret is DECLARED ----- */

/*
 * THE DEFECT THIS GATE WAS WRITTEN FOR. `OPERATOR_TOKEN` was read by
 * `operator/auth.server.ts` and declared nowhere, so it was widened locally at
 * the call site and the shared `Env` type never knew about it. That is not a
 * leak on its own, but it is the tell: a secret nobody declared is a secret
 * nobody reviewed, and the declaration block is the one place the whole set is
 * visible at once.
 */
const types = readFileSync(ENV_TYPES, "utf8");
const declaredBlock = types.match(/interface\s+Env\s*\{([\s\S]*?)\n\s*\}/);
ok(
  "app/env.d.ts declares an Env interface",
  Boolean(declaredBlock),
  "not found, so the declaration assertions below would examine nothing",
);
const declared = new Set(
  [...(declaredBlock?.[1] ?? "").matchAll(/^\s*([A-Z][A-Z0-9_]+)\??\s*:/gm)].map((m) => m[1]),
);

for (const name of SECRETS) {
  ok(
    `${name} is declared in app/env.d.ts`,
    declared.has(name),
    "the ruling names it as a secret and the Env type does not carry it, so every " +
      "reader widens it locally and nothing shows the set in one place",
  );
}

// The other direction: a declared secret nobody ratified.
for (const name of declared) {
  ok(
    `${name} is a ratified secret`,
    SECRETS.includes(name),
    "app/env.d.ts declares it and the list in this file does not. Add it here in " +
      "the same commit, with its classification, or remove it there.",
  );
}

/* ------------------------------------------- 2. the boundary, by path ----- */

const SCAN_ROOTS = ["app", "workers"];

/*
 * NO SKIP_DIRS. There was a set naming node_modules, build, .react-router and
 * .wrangler, and the pre-audit sweep tested it by emptying it: the result was
 * IDENTICAL, because none of those four directories exists under app/ or
 * workers/ and none ever has. They live at the repo root, which this walk never
 * enters.
 *
 * Removed rather than kept as insurance, deliberately. An exclusion nothing
 * depends on is surface area that reads like protection, and this gate's whole
 * subject is the difference between the two. If a build artefact ever does land
 * inside a scan root, the per-root floors below will move and somebody will
 * look, which is a better outcome than a silent skip.
 */

/** @param {string} dir @param {string[]} out */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js|jsx)$/.test(entry) && !entry.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

/**
 * Comments and string literals are stripped before anything is matched.
 *
 * This file's own prose names every secret, and so do several docblocks in the
 * tree: `github.server.ts` explains what `GITHUB_TOKEN` is for, and
 * `env.d.ts` annotates each one. A matcher that read prose would report a
 * violation on a comment explaining the rule. That trap has been hit by
 * check:logo, check:contrast, check:features, check:headers and check:urls, so
 * it is the default failure here rather than an edge case.
 *
 * String literals go too: `api.server.ts` reports `githubConfigured` and the
 * operator docs mention token names in user-facing copy.
 *
 * @param {string} source
 */
function stripped(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

/** A file that may read a secret. */
function isServerOnly(/** @type {string} */ path) {
  return path.startsWith("workers/") || /\.server\.(ts|tsx|mjs|js)$/.test(path);
}

/**
 * A floor PER ROOT, not one on the total.
 *
 * The pre-audit sweep dropped `workers` from SCAN_ROOTS and this gate reported
 * 23 checks and 0 failures: `app/` alone is 108 files, so a total-only floor of
 * 50 could not tell that an entire root had stopped being scanned. `workers/`
 * is three files, and it is the Worker entry, the queue consumer and the
 * Durable Object: the outermost layer of the server boundary this gate exists
 * to police.
 *
 * MEASURED THIS SESSION through this gate's own walk: app 108, workers 3. The
 * `workers` floor is deliberately tight rather than slack, because three files
 * cannot absorb slack: any floor below 3 cannot detect the root vanishing,
 * which is the only thing it is for.
 *
 * @type {Record<string, number>}
 */
const ROOT_FLOORS = { app: 95, workers: 3 };

/** @type {string[]} */
const files = [];
for (const r of SCAN_ROOTS) {
  const here = existsSync(join(root, r)) ? walk(join(root, r)) : [];
  files.push(...here);
  const floor = ROOT_FLOORS[r];
  ok(
    `the scan examined ${r}/ at all, and to depth`,
    floor !== undefined && here.length >= floor,
    floor === undefined
      ? `${r}/ has no floor in ROOT_FLOORS. Add one measured through this walk, or the ` +
        `root can empty out unnoticed.`
      : `${here.length} file(s) under ${r}/, expected at least ${floor}. Either the walk ` +
        `stopped matching this tree, or the root was dropped from SCAN_ROOTS.`,
  );
}

// The other direction: a floor naming a root nobody scans guards nothing.
for (const r of Object.keys(ROOT_FLOORS)) {
  ok(
    `ROOT_FLOORS entry ${r} still names a scanned root`,
    SCAN_ROOTS.includes(r),
    `${r} has a floor but is not in SCAN_ROOTS, so the floor guards nothing.`,
  );
}

ok(
  "the scan examined a plausible number of files overall",
  files.length >= 100,
  `${files.length} found under ${SCAN_ROOTS.join(", ")}; expected the whole app`,
);

/**
 * Anchored on `env.` so `import.meta.env.MODE` cannot match a secret name, and
 * so a local variable that merely shares a name is not a false positive.
 */
const pattern = new RegExp(`\\benv\\.(${SECRETS.join("|")})\\b`, "g");

/** @type {Array<{ path: string, name: string }>} */
const violations = [];
let readsFound = 0;
let serverReads = 0;

for (const file of files) {
  const path = relative(root, file).split(sep).join("/");
  const code = stripped(readFileSync(file, "utf8"));
  for (const match of code.matchAll(pattern)) {
    readsFound += 1;
    const name = match[1];
    if (isServerOnly(path)) {
      serverReads += 1;
      continue;
    }
    if (CLIENT_ALLOWED[name]) continue;
    violations.push({ path, name });
  }
}

/*
 * ANTI-VACUITY, and this is the assertion that makes the one below mean
 * something. If the matcher breaks, or the tree moves, or `stripped()` eats too
 * much, the scan finds zero reads and reports zero violations, which is
 * indistinguishable from a clean repo. Hard rule 10.
 */
ok(
  "the scan actually found secret reads to classify",
  readsFound > 0 && serverReads > 0,
  `${readsFound} read(s) found, ${serverReads} inside the server boundary. Zero means ` +
    `the matcher is broken, not that the repo is clean.`,
);

ok(
  "no secret is read outside a .server module or workers/",
  violations.length === 0,
  violations.map((v) => `${v.path} reads env.${v.name}`).join("\n        "),
);

/**
 * What makes one allowlist entry acceptable. Returns the problems, so the same
 * rules can be exercised on synthetic input without touching the real list.
 *
 * @param {string} name @param {unknown} reason
 * @returns {string[]} empty when the entry is acceptable
 */
function validateAllowlistEntry(name, reason) {
  const problems = [];
  if (!SECRETS.includes(name)) problems.push("names something the secret list does not");
  if (typeof reason !== "string" || reason.length <= 20) {
    problems.push("carries no stated reason, so it is permission nobody can review");
  }
  return problems;
}

// Every allowlist entry must still be real, or it is permission nobody audits.
for (const [name, reason] of Object.entries(CLIENT_ALLOWED)) {
  const problems = validateAllowlistEntry(name, reason);
  ok(`allowlisted ${name} is acceptable`, problems.length === 0, problems.join("; "));
}

/*
 * SELF-TEST, and it runs on EVERY execution regardless of the allowlist.
 *
 * THE PROBLEM IT SOLVES. `CLIENT_ALLOWED` is empty, and empty is the CORRECT
 * state: no client-reachable file needs any of the seven secrets. But an empty
 * map means the loop above iterates zero times, so its rules have never been
 * executed and could be inverted, deleted or simply wrong without any run
 * noticing. "0 failures" from a loop that never ran is indistinguishable from
 * "0 failures" from a loop that checked something. Hard rule 10.
 *
 * The fix is NOT a fixture entry in the real allowlist. That would put a fake
 * permission in the structure that grants permissions, where the next reader
 * has to work out that it is a test and not a decision, and where deleting it
 * to "clean up" silently removes the coverage. Ruled 2026-08-10.
 *
 * Instead the rules live in a function, and the function is fed synthetic input
 * here. The real loop and the self-test call the SAME code, so the assertions
 * below are evidence about the rules the loop actually applies.
 */
const badEntry = validateAllowlistEntry("NOT_A_RATIFIED_SECRET", "short");
ok(
  "self-test: an unratified name with a stub reason reports BOTH problems",
  badEntry.length === 2,
  `reported ${badEntry.length}: ${JSON.stringify(badEntry)}. The allowlist rules are ` +
    `not being applied, and the loop above is empty, so nothing else would notice.`,
);
ok(
  "self-test: the unratified NAME is one of the reported problems",
  badEntry.some((p) => p.includes("secret list")),
  JSON.stringify(badEntry),
);
ok(
  "self-test: the stub REASON is one of the reported problems",
  badEntry.some((p) => p.includes("stated reason")),
  JSON.stringify(badEntry),
);
ok(
  "self-test: a ratified name with an adequate reason reports NO problems",
  validateAllowlistEntry(
    SECRETS[0],
    "a genuine justification long enough to be worth reading by a reviewer",
  ).length === 0,
  "the validator rejects an entry it should accept, so a real exception could never be added",
);

console.log(
  `  ${SECRETS.length} secret(s), ${files.length} file(s) scanned, ` +
    `${readsFound} read(s), ${Object.keys(CLIENT_ALLOWED).length} allowlisted`,
);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
