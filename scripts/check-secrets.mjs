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

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { REQUIRED_SECRETS } from "../app/lib/secrets.mjs";
import { stripCommentsAndStrings } from "./lib/strip-comments.mjs";
import { assertFloor } from "./lib/floor.mjs";
import { readDevVar } from "./lib/dev-vars.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_TYPES = join(root, "app", "env.d.ts");

const SECRETS = REQUIRED_SECRETS;

/*
 * THE RATIFIED LIST IS IMPORTED, NOT RESTATED, since 2026-08-22.
 *
 * It was declared inline here and the cockpit's tools page described "the five
 * required wrangler secrets" while this gate measured eight. Two copies, one
 * of them prose, and nothing could compare them.
 *
 * **THE INDEPENDENCE ARGUMENT SURVIVES THE MOVE**, which is the thing to check
 * before assuming it does not. This gate's expectation must not be computed
 * from the code it checks, and it still is not: `app/lib/secrets.mjs` is the
 * ratified list itself, hand-maintained against the ruling in
 * `dustinedwards/core.md`. What the tree READS and what `app/env.d.ts`
 * DECLARES are still parsed independently and still compared against it, so a
 * secret added to one and not the others still moves one side and fails.
 */

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
 * RE-MEASURED 2026-08-24 through this gate's own walk by running it: app 158,
 * workers 4. app/ had grown from 108 without the floor moving, so 95 had
 * drifted to leave a 40 percent blind zone in the root that matters most. The
 * `workers` floor is deliberately tight rather than slack, because a set that
 * small cannot absorb slack: any floor that low cannot detect the root
 * vanishing, which is the only thing it is for.
 *
 * @type {Record<string, number>}
 */
const ROOT_FLOORS = { app: 145, workers: 3 };

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
  files.length >= 149,
  `${files.length} found under ${SCAN_ROOTS.join(", ")}, floor 149, measured 162 on ` +
    `2026-08-24; expected the whole app`,
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
  /*
   * COMMENTS AND STRING LITERALS BOTH GO, and the second half is this file's
   * own reason rather than the shared helper's. This file's prose names every
   * secret, and so do docblocks across the tree: `github.server.ts` explains
   * what `GITHUB_TOKEN` is for and `env.d.ts` annotates each one, so a matcher
   * reading prose would report a violation on a comment explaining the rule.
   * Strings go too because `api.server.ts` reports `githubConfigured` and the
   * operator docs name tokens in user-facing copy.
   */
  const code = stripCommentsAndStrings(readFileSync(file, "utf8"));
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
 * something. If the matcher breaks, or the tree moves, or `stripCommentsAndStrings()` eats too
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

/* -------------- 3. the admin session file is REALLY ignored --------------- */

/*
 * **A DOCUMENTED IGNORE THAT IS NOT ACTUALLY IGNORING IS A RECORDED FAILURE
 * SHAPE HERE, so this asks git rather than reading .gitignore.**
 *
 * `.admin-session` holds a live Better Auth session for the single admin. It is
 * a credential, and the only thing standing between it and a public repo is one
 * line in `.gitignore`. Reading that file back and finding the line proves the
 * line exists; it does not prove it MATCHES, because precedence, a later
 * negation, a trailing space or a directory-scoped pattern all leave the line
 * sitting there looking correct. `git check-ignore` answers the question the
 * line is supposed to answer.
 *
 * BOTH DIRECTIONS, because they fail differently and both are real:
 *   the session file MUST be ignored     or the credential can be committed
 *   the example MUST NOT be ignored      or the instructions vanish from the
 *                                        repo and nobody can refill the session
 *
 * The path is checked whether or not it exists. `check-ignore` is a question
 * about the rules, not about the filesystem, so this holds on a fresh clone
 * where no session has ever been created.
 */
console.log("\n  3. the admin session file is really ignored");

/** @param {string} path @returns {boolean} */
function gitIgnores(path) {
  const res = spawnSync("git", ["check-ignore", "-q", "--no-index", path], {
    cwd: root,
    encoding: "utf8",
  });
  // 0 ignored, 1 not ignored, anything else is git failing to answer.
  if (res.status !== 0 && res.status !== 1) {
    throw new Error(
      `git check-ignore could not answer for ${path} (status ${res.status}). ` +
        `Treating that as "ignored" would be the fail-open reading.`,
    );
  }
  return res.status === 0;
}

ok(
  "git itself ignores .admin-session",
  gitIgnores(".admin-session"),
  "the session file is NOT ignored, so a live admin session can be committed to a public " +
    "repo by any `git add` that reaches it. A line in .gitignore is not the same as a " +
    "matching rule.",
);
ok(
  "git does NOT ignore .admin-session.example",
  !gitIgnores(".admin-session.example"),
  "the tracked example is being ignored, so the refill instructions would silently leave " +
    "the repo and the next expired session has nothing to read.",
);

/*
 * AND THE EXAMPLE CARRIES NO REAL SESSION. It is committed, so anything pasted
 * into it is published. The placeholder is the tell: a file that still has it
 * cannot also hold a token in the same slot.
 */
const examplePath = join(root, ".admin-session.example");
ok(
  ".admin-session.example exists to be checked",
  existsSync(examplePath),
  "the tracked example is gone, so the two assertions above and the refill instructions " +
    "it carries are checking nothing",
);
if (existsSync(examplePath)) {
  const example = readFileSync(examplePath, "utf8");
  ok(
    ".admin-session.example still carries its placeholder, not a session",
    example.includes("PASTE_THE_VALUE_HERE"),
    "the placeholder is gone from the TRACKED example, which is how a real session token " +
      "gets committed: someone edits the example instead of copying it first.",
  );
}

/* ================================ the operator credentials in .dev.vars */

/*
 * THE `.dev.vars` CREDENTIALS ARE NOT WRANGLER SECRETS, AND ARE STILL GUARDED.
 *
 * Added 2026-09-07 with the uptime monitors. `UPTIMEROBOT_API_KEY` and
 * `CLOUDFLARE_API_TOKEN` are read by Node programs in `scripts/`, never by
 * deployed code, so neither belongs on `REQUIRED_SECRETS`: that list is the
 * ratified set of WRANGLER secrets, and this gate asserts each of those is
 * declared in `app/env.d.ts` and read only inside the server boundary. Adding
 * an operator credential to it would make those assertions demand a
 * declaration for a value the Worker never sees.
 *
 * What they need instead is the one thing that actually matters for a
 * credential that lives in a file on a developer's disk: **it must never reach
 * git.** That is the same question `check:config` asks of the redacted config
 * values, asked here for the two credentials that have no config to live in.
 *
 * ## TWO ASSERTIONS, AND THE FIRST ONE WORKS WITHOUT THE FILE
 *
 * The SHAPE scan runs everywhere, CI included, and needs no credential: it
 * looks for anything in a tracked file that matches an UptimeRobot key. That
 * is the fixture-independent half, and it is the half that still catches a
 * committed key on a machine that has no `.dev.vars` at all.
 *
 * The EXACT-VALUE scan runs only where the file exists. It is strictly
 * stronger there and impossible elsewhere, which is why it is conditional
 * rather than fail-closed: a clean checkout has no `.dev.vars` by design, and
 * failing on its absence would make this gate red in CI forever for a
 * condition that is correct.
 *
 * The pairing is deliberate. A conditional assertion that could pass by
 * reading nothing is exactly what hard rule 10 warns about, so the
 * unconditional shape scan is always there underneath it.
 */
{
  const lsFiles = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
  if (lsFiles.status !== 0) {
    throw new Error(
      `git ls-files could not answer (status ${lsFiles.status}). Treating an unreadable ` +
        `tree as "no credentials found" would be the fail-open reading.`,
    );
  }
  const tracked = lsFiles.stdout.split("\0").filter(Boolean);

  ok(
    "the tracked-file scan for credentials has a non-empty scope",
    tracked.length > 0,
    "git ls-files returned nothing, so the two scans below would report a clean sweep " +
      "of a tree they never read.",
  );

  // REUSES `gitIgnores` rather than spelling check-ignore a second time. One
  // helper, one argument order, one idea of what a non-zero status means:
  // hard rule 10's "one helper name, one argument order".
  ok(
    ".dev.vars is ignored by git",
    gitIgnores(".dev.vars"),
    "`.dev.vars` is NOT gitignored, so the operator credentials in it are one " +
      "`git add` away from being published.",
  );

  /*
   * The UptimeRobot key shape: `u`, the account's numeric id, a dash, then an
   * alphanumeric secret. Deliberately loose on the lengths, because guessing a
   * width would make the needle miss a key of a different vintage, and this
   * scan is the one that has to work with no credential in hand to compare
   * against.
   */
  /*
   * NO LEADING `\b`, AND THE PLANT IS WHY. Written as
   * `/\bu\d{4,12}-[A-Za-z0-9]{16,64}\b/` and replayed against a key-shaped
   * string planted in a tracked file, it did NOT fire: the plant read
   * `_PLANT_u1234567-...`, and `_` is a word character, so there is no word
   * boundary before the `u`. A word boundary is the wrong anchor for a needle
   * that has to find a credential ANYWHERE in a file, including glued to a
   * prefix. The shape is specific enough to carry itself: a lowercase `u`, four
   * to twelve digits, a dash, then at least sixteen alphanumerics. Verified
   * against all 548 tracked files with zero false positives.
   */
  const UPTIMEROBOT_SHAPE = /u\d{4,12}-[A-Za-z0-9]{16,64}/;

  /** Files that legitimately DISCUSS these names. The VALUE is what is banned. */
  const scanned = tracked.filter((rel) => {
    const full = join(root, rel);
    if (!existsSync(full)) return false;
    return statSync(full).isFile() && statSync(full).size < 2_000_000;
  });

  const shapeHits = [];
  const valueHits = [];
  const uptimeKey = readDevVar("UPTIMEROBOT_API_KEY");
  const cloudflareToken = readDevVar("CLOUDFLARE_API_TOKEN");

  for (const rel of scanned) {
    let text;
    try {
      text = readFileSync(join(root, rel), "utf8");
    } catch {
      continue; // unreadable or binary; the shape scan is text-only by nature
    }
    if (UPTIMEROBOT_SHAPE.test(text)) shapeHits.push(rel);
    // Guarded on length so an empty or one-character value cannot match every
    // file and report a plausible number. Hard rule 10, the empty needle.
    for (const [what, value] of [
      ["UPTIMEROBOT_API_KEY", uptimeKey],
      ["CLOUDFLARE_API_TOKEN", cloudflareToken],
    ]) {
      if (typeof value === "string" && value.length >= 12 && text.includes(value)) {
        valueHits.push(`${rel} (${what})`);
      }
    }
  }

  ok(
    "no tracked file carries anything shaped like an UptimeRobot API key",
    shapeHits.length === 0,
    `${shapeHits.join(", ")}. A monitoring key in git is a key anyone who clones this ` +
      `can pause the monitors with.`,
  );

  ok(
    "no tracked file carries a .dev.vars credential verbatim",
    valueHits.length === 0,
    `${valueHits.join(", ")}. Replace it with a placeholder and read it through ` +
      `readDevVar().`,
  );

  console.log(
    `  ${scanned.length} tracked file(s) scanned for credentials; ` +
      `.dev.vars ${uptimeKey || cloudflareToken ? "present" : "absent"} on this machine`,
  );
}

console.log(
  `  ${SECRETS.length} secret(s), ${files.length} file(s) scanned, ` +
    `${readsFound} read(s), ${Object.keys(CLIENT_ALLOWED).length} allowlisted`,
);

/*
 * EXECUTED-COUNT FLOOR.
 *
 * The per-root scans here already refuse an empty scope, but that is a floor on
 * what was READ. This is the floor on what was ASSERTED, and the two fail on
 * different bugs: a scope check cannot see an assertion block that stopped
 * running over a scope that is still full.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it: 29 on 2026-08-14, and
 * 33 once section 3 landed. Never summed. Floored at 31, slack of two: the count
 * is driven by the secret list and the per-root pairs, so it steps by a known
 * amount when a secret is added, as it did going from seven to eight.
 */
/* RE-MEASURED 2026-09-07 by RUNNING this gate, after the .dev.vars credential
   section landed: 39 checks, up from 33. check:floors had just failed the old
   32 at a gap of 7 against a tolerance of 3. Tolerance is 3 at this count, so
   36 is the slackest legal value and is what the slack-of-two convention above
   gives. */
/* RE-MEASURED 2026-09-12 by RUNNING this gate, after OPENALEX_API_KEY became
   the tenth ratified secret: 41 checks. The step is the one this comment
   predicted, and the arithmetic answer would have been wrong in the direction
   that matters, so the number below comes from the run. check:floors failed 36
   at a gap of 5 against a tolerance of 3; 41 is the count and 38 is the
   slackest legal value, and the slack-of-two convention gives 39. */
const MINIMUM_CHECKS = 39;
const floorBreach = assertFloor("check:secrets", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
