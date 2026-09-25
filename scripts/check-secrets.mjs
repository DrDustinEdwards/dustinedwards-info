import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { REQUIRED_SECRETS } from "../app/lib/secrets.mjs";
import { interfaceMembers, parseSource, propertyReads } from "./lib/syntax.mjs";
import { assertFloor } from "./lib/floor.mjs";
import { readDevVar } from "./lib/dev-vars.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENV_TYPES = join(root, "app", "env.d.ts");

const SECRETS = REQUIRED_SECRETS;

/**
 * Empty, and correct: the mechanism exists so a permission is recorded rather than made by deleting
 * an assertion.
 *
 * @type {Record<string, string>}
 */
const CLIENT_ALLOWED = {};

/**
 * Bindings are not secrets: a client component referencing one gets `undefined`. `import.meta.env` is
 * a different namespace, and the matcher is anchored so it cannot confuse the two.
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

ok(
  "the ratified secret list is not empty",
  SECRETS.length > 0,
  "with no secrets named, every assertion below would pass by examining nothing",
);

if (!existsSync(ENV_TYPES)) {
  console.log("  FAIL  app/env.d.ts is missing; the declaration check cannot run.\n");
  process.exit(1);
}

// A secret nobody declared is a secret nobody reviewed. Read off the syntax tree: a regex stopped at
// the first line holding a closing brace, so a nested type in Env hid every member after it.
const envInterface = interfaceMembers(parseSource(ENV_TYPES, readFileSync(ENV_TYPES, "utf8")), "Env");
ok(
  "app/env.d.ts declares an Env interface",
  envInterface.found,
  "not found, so the declaration assertions below would examine nothing",
);
const declared = envInterface.members;

for (const name of SECRETS) {
  ok(
    `${name} is declared in app/env.d.ts`,
    declared.has(name),
    "the ruling names it as a secret and the Env type does not carry it, so every " +
      "reader widens it locally and nothing shows the set in one place",
  );
}

for (const name of declared) {
  ok(
    `${name} is a ratified secret`,
    SECRETS.includes(name),
    "app/env.d.ts declares it and the list in this file does not. Add it here in " +
      "the same commit, with its classification, or remove it there.",
  );
}

const SCAN_ROOTS = ["app", "workers"];

/** @param {string} dir @param {string[]} out */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js|jsx)$/.test(entry) && !entry.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

function isServerOnly(/** @type {string} */ path) {
  return path.startsWith("workers/") || /\.server\.(ts|tsx|mjs|js)$/.test(path);
}

/**
 * A floor per root: one root is about a hundred and fifty files and the other a handful, so a
 * total-only floor cannot see a whole root stop being scanned.
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
 * A read is any property read of a secret's name, off any receiver: `env.X`, `getEnv(c).X`,
 * `env["X"]` and `const { X } = env`. The old matcher required the receiver to be spelled `env`
 * and saw none of the others. Read off the syntax tree, so comments, strings and an object-literal
 * key naming a secret (a status field) are not reads.
 */
const SECRET_NAMES = new Set(SECRETS);

/** @type {Array<{ path: string, name: string }>} */
const violations = [];
let readsFound = 0;
let serverReads = 0;

for (const file of files) {
  const path = relative(root, file).split(sep).join("/");
  for (const { name } of propertyReads(parseSource(file, readFileSync(file, "utf8")), SECRET_NAMES)) {
    readsFound += 1;
    if (isServerOnly(path)) {
      serverReads += 1;
      continue;
    }
    if (CLIENT_ALLOWED[name]) continue;
    violations.push({ path, name });
  }
}

// A broken matcher finds zero reads and zero violations, indistinguishable from a clean repo.
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
 * Returns the problems, so the rules can be exercised on synthetic input.
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

// Self-test on every run: the allowlist is empty, so the loop above runs zero times and its rules
// could be inverted unnoticed.
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

// Asks git: reading the file back proves the line exists, not that it matches.
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

// The example is committed, so anything pasted into it is published; the placeholder is the tell.
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

// The `.dev.vars` credentials are read by Node programs, never by deployed code, and must never reach
// git. The shape scan runs everywhere; the exact-value scan only where the file exists.
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

  ok(
    ".dev.vars is ignored by git",
    gitIgnores(".dev.vars"),
    "`.dev.vars` is NOT gitignored, so the operator credentials in it are one " +
      "`git add` away from being published.",
  );

  // Loose on lengths: a guessed width misses a key of another vintage. No leading word boundary: `_` is
  // a word character, so a key glued to a `_` prefix would not fire. The lookbehind refuses a JSON
  // unicode escape, whose `u` is encoding, not text.
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

  /** @type {string[]} */
  const unreadable = [];
  for (const rel of scanned) {
    let text;
    try {
      // A binary file decodes to replacement characters rather than throwing; only a real read
      // failure lands here, and a file that could not be read was not scanned.
      text = readFileSync(join(root, rel), "utf8");
    } catch (error) {
      unreadable.push(`${rel} (${/** @type {NodeJS.ErrnoException} */ (error).code ?? error})`);
      continue;
    }
    if (UPTIMEROBOT_SHAPE.test(text)) shapeHits.push(rel);
    // Guarded on length, or an empty value matches every file and reports a plausible number, which
    // is the vacuity rule's empty needle.
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
    "every tracked file in scope was read",
    unreadable.length === 0,
    `${unreadable.join(", ")}. An unread file reported clean would be a credential scan that ` +
      `never looked.`,
  );

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

// Measured by running it, never summed; re-taken whenever a section or a secret lands.
const MINIMUM_CHECKS = 39;
const floorBreach = assertFloor("check:secrets", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) ok("this gate executed its assertions", false, floorBreach);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
