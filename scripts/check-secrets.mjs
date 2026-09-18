/**
 * Gate over the secret-handling boundary hard rule 3 states.
 *
 *   npm run check:secrets
 *
 * BOUNDARY: IT READS SOURCE TEXT, NOT THE BUNDLE, so a secret read inside a legitimate `.server`
 * module that a mis-split inlined into a client chunk is invisible here, and it says nothing
 * about whether a secret is USED correctly once read. The boundary is BY PATH, and strictly:
 * loaders and actions are not carved out even though hard rule 3's prose permits it.
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
 * THE RATIFIED LIST IS IMPORTED, NOT RESTATED: it was inline here while a page described a
 * different count. **THE INDEPENDENCE ARGUMENT SURVIVES THE MOVE**: what the tree READS and what
 * the declaration file DECLARES are still parsed independently.
 */

/**
 * Names permitted OUTSIDE the server boundary, each with its reason. EMPTY TODAY, and correct:
 * the mechanism exists so the decision is recorded rather than made by deleting an assertion.
 *
 * @type {Record<string, string>}
 */
const CLIENT_ALLOWED = {};

/**
 * Bindings, which are NOT secrets and NOT guarded: a binding is an object the runtime injects,
 * so a client component referencing one gets `undefined`. Listed only to record the env surface.
 * `import.meta.env` is a DIFFERENT namespace, and the matcher is anchored so it cannot confuse
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

/* fail closed first */

ok(
  "the ratified secret list is not empty",
  SECRETS.length > 0,
  "with no secrets named, every assertion below would pass by examining nothing",
);

if (!existsSync(ENV_TYPES)) {
  console.log("  FAIL  app/env.d.ts is missing; the declaration check cannot run.\n");
  process.exit(1);
}

/* 1. every secret is DECLARED */

/*
 * THE DEFECT THIS GATE WAS WRITTEN FOR: a secret read at a call site and declared nowhere. Not a
 * leak on its own, it is the tell, because a secret nobody declared is a secret nobody reviewed.
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

/* 2. the boundary, by path */

const SCAN_ROOTS = ["app", "workers"];

/*
 * NO SKIP_DIRS: emptying the set produced an IDENTICAL result, none of its directories existing
 * under the scan roots. An exclusion nothing depends on is surface area that reads like
 * protection, which is this gate's own subject.
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
 * A floor PER ROOT, not one on the total: one root is a hundred and fifty files and the other a
 * handful, so a total-only floor cannot tell that an entire root stopped being scanned. The small
 * one is the outermost layer of the boundary, and its floor is tight because it cannot absorb
 * slack.
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
   * COMMENTS AND STRING LITERALS BOTH GO: this file's prose names every secret, and strings go
   * because status fields and operator copy name tokens too.
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
 * ANTI-VACUITY, and it is what makes the one below mean something: a broken matcher finds zero
 * reads and reports zero violations, indistinguishable from a clean repo. Hard rule 10.
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
 * SELF-TEST on EVERY execution regardless of the allowlist: the map is empty, which is CORRECT,
 * so the loop above iterates zero times and its rules could be inverted unnoticed. Hard rule 10.
 * NOT a fixture entry in the real allowlist, which would put a fake permission in the structure
 * that grants them; the rules live in a function the real loop and the self-test both call.
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

/* 3. the admin session file is REALLY ignored */

/*
 * **A DOCUMENTED IGNORE THAT IS NOT ACTUALLY IGNORING IS A RECORDED FAILURE SHAPE HERE**, so
 * this asks git: reading the file back proves the line exists, not that it MATCHES. BOTH
 * DIRECTIONS, because they fail differently, and the path is checked whether or not it exists.
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

/* the operator credentials in .dev.vars */

/*
 * THE `.dev.vars` CREDENTIALS ARE NOT WRANGLER SECRETS, AND ARE STILL GUARDED: read by Node
 * programs and never by deployed code, so listing one would demand a declaration for a value the
 * Worker never sees. **It must never reach git.** TWO ASSERTIONS, AND THE FIRST WORKS WITHOUT THE
 * FILE: the SHAPE scan runs everywhere, the EXACT-VALUE scan only where the file exists. The
 * pairing is deliberate, a conditional assertion that could pass by reading nothing being exactly
 * what hard rule 10 warns about.
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

  // REUSES `gitIgnores` rather than spelling check-ignore twice: one helper, one argument order,
  // which is hard rule 10's ninth discipline.
  ok(
    ".dev.vars is ignored by git",
    gitIgnores(".dev.vars"),
    "`.dev.vars` is NOT gitignored, so the operator credentials in it are one " +
      "`git add` away from being published.",
  );

  /*
   * The key shape, deliberately loose on the lengths: a guessed width misses a key of another
   * vintage, and this scan has to work with no credential in hand.
   */
  /*
   * NO LEADING `\b`, AND THE PLANT IS WHY: a key glued to a prefix ending in `_` did NOT fire,
   * `_` being a word character. A word boundary is the wrong anchor for a needle that has to find a
   * credential ANYWHERE in a file.
   */
  /*
   * A `\uXXXX` JSON ESCAPE IS NOT A `u` IN THE TEXT: a committed JSON file of extracted PDF text
   * holds escaped control characters followed by something long and alphanumeric, so the needle was
   * reading a file's ENCODING. The lookbehind refuses exactly that, and both directions are plants.
   */
  const UPTIMEROBOT_SHAPE = /(?<!\\)u\d{4,12}-[A-Za-z0-9]{16,64}/;

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
    // Guarded on length, or an empty value matches every file and reports a plausible number, which
    // is hard rule 10's empty needle.
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
 * EXECUTED-COUNT FLOOR. The per-root scans floor what was READ; this floors what was ASSERTED,
 * and a scope check cannot see an assertion block that stopped running over a full scope.
 * MEASURED BY RUNNING IT, never summed.
 */
/* Re-taken by running the gate whenever a section or a secret lands. */
/*
 * The step is the one the comment above predicts, and the arithmetic answer would have been
 * wrong in the direction that matters.
 */
const MINIMUM_CHECKS = 39;
const floorBreach = assertFloor("check:secrets", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
