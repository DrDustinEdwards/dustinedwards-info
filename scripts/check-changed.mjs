// Unmapped paths fall back to the whole offline tier: skipping a path it did not recognize would
// report a clean run over checks that never executed.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { gateNames } from "./build-stack.mjs";
import { CI_EXCLUDED, TIERS, runGate } from "./check-all.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * A gate belongs on a rule when it would notice the edit, not when it merely runs nearby.
 *
 * @type {Array<{what: string, test: RegExp, gates: string[]}>}
 */
const MAP = [
  {
    what: "a stylesheet",
    test: /^app\/(app\.css|styles\/.+\.css)$/,
    gates: ["check:contrast", "check:page-payload"],
  },
  {
    what: "a route, component or other app source",
    test: /^app\/.+\.(ts|tsx|mjs)$/,
    gates: ["check:types", "check:tests", "check:features", "check:machine-readable", "check:urls"],
  },
  {
    what: "the schema or a migration",
    test: /^(app\/db\/schema\.ts|drizzle\/.+)$/,
    gates: ["check:migrations", "check:tests"],
  },
  {
    what: "a Worker entry",
    test: /^workers\/.+\.ts$/,
    gates: ["check:types", "check:worker", "check:headers", "check:policy", "check:secrets"],
  },
  {
    what: "a post or other content",
    test: /^content\/.+/,
    gates: ["check:content", "check:diagrams", "check:machine-readable", "check:features"],
  },
  {
    what: "publication data",
    test: /^data\/.+/,
    gates: ["check:machine-readable", "check:content"],
  },
  {
    what: "a served asset",
    test: /^public\/.+/,
    gates: ["check:urls", "check:page-payload", "check:fonts"],
  },
  {
    what: "the wrangler config example",
    test: /^wrangler\..*jsonc?(\.example)?$/,
    gates: ["check:types", "check:secrets"],
  },
  {
    what: "a test",
    test: /^test\/.+/,
    gates: ["check:tests"],
  },
  {
    /* No gate reads these, so a change here runs nothing rather than falling through to the whole tier. */
    what: "a document, skill or hook, which no gate reads",
    test: /^(\.claude\/.+|[A-Za-z-]+\.md|docs\/.+\.md|\.design-sync\/.+)$/,
    gates: [],
  },
];

/**
 * A rule rather than a map row because the gate name comes out of the path.
 *
 * @param {string} file
 * @returns {string[] | null}
 */
function ownGate(file) {
  const m = /^scripts\/check-([a-z0-9-]+)\.mjs$/.exec(file);
  return m ? [`check:${m[1]}`] : null;
}

// A runner, a shared library or the stack builder is read by every gate, so it maps to the whole tier.
const TIER_WIDE = /^scripts\/(check-all|check-changed|build-stack)\.mjs$|^scripts\/lib\//;

/** @param {string[]} argv */
function parseArgs(argv) {
  const base = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "origin/main";
  return { base, dry: argv.includes("--dry") };
}

/**
 * Staged and unstaged too, because a gate verifies disk.
 *
 * @param {string} base
 * @returns {{files: string[], baseUsed: string | null}}
 */
function changedFiles(base) {
  /** @param {string[]} args */
  const git = (args) => {
    const r = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    return r.status === 0 ? (r.stdout ?? "") : null;
  };

  const known = git(["rev-parse", "--verify", "--quiet", base]) !== null;
  const out = new Set();
  if (known) {
    for (const f of (git(["diff", "--name-only", `${base}...HEAD`]) ?? "").split("\n")) {
      if (f.trim()) out.add(f.trim());
    }
  }
  for (const args of [["diff", "--name-only"], ["diff", "--name-only", "--cached"]]) {
    for (const f of (git(args) ?? "").split("\n")) if (f.trim()) out.add(f.trim());
  }
  return { files: [...out].sort(), baseUsed: known ? base : null };
}

const { base, dry } = parseArgs(process.argv.slice(2));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const declared = new Set(gateNames(pkg));

// A row naming a gate that no longer exists would silently contribute nothing.
const named = new Set(MAP.flatMap((r) => r.gates));
const unknown = [...named].filter((g) => !declared.has(g));
if (unknown.length) {
  console.error(`check:changed maps to gate(s) package.json does not declare: ${unknown.join(", ")}`);
  process.exit(2);
}

const { files, baseUsed } = changedFiles(base);

console.log("check:changed");
if (!baseUsed) console.log(`  base ${base} is not a known ref here, so only the working tree counts`);
console.log(`  ${files.length} changed path(s) against ${baseUsed ?? "HEAD"}\n`);

if (files.length === 0) {
  console.log("  nothing changed, so there is nothing to check.");
  process.exit(0);
}

/** @param {string} why */
function offlineTier(why) {
  console.log(`\n  ${why}\n`);
  if (dry) process.exit(0);
  const r = spawnSync("npm run check", { cwd: root, stdio: "inherit", shell: true });
  process.exit(r.status === 0 ? 0 : 1);
}

const tierWide = files.filter((f) => TIER_WIDE.test(f));
if (tierWide.length) {
  console.log(`  ${tierWide.join("\n  ")}`);
  offlineTier(
    "the tier's own machinery changed, and every gate reads it, so the whole offline tier runs.",
  );
}

/** @type {Map<string, string[]>} */
const wanted = new Map();
/** @type {string[]} */
const unmapped = [];

for (const file of files) {
  const own = ownGate(file);
  const rules = MAP.filter((r) => r.test.test(file));
  const gates = [...(own ?? []), ...rules.flatMap((r) => r.gates)].filter((g) => declared.has(g));
  if (gates.length === 0) {
    /* A row with no gates is a path argued safe to skip; only a path no row names is unmapped. */
    if (!own && rules.length > 0 && rules.every((r) => r.gates.length === 0)) {
      console.log(`  ${file}\n    ${rules.map((r) => r.what).join(", ")} -> nothing to run`);
    } else {
      unmapped.push(file);
    }
    continue;
  }
  const what = own ? "its own gate" : rules.map((r) => r.what).join(", ");
  console.log(`  ${file}\n    ${what} -> ${[...new Set(gates)].join(", ")}`);
  for (const g of new Set(gates)) wanted.set(g, [...(wanted.get(g) ?? []), file]);
}

if (unmapped.length) {
  console.log(`\n  ${unmapped.length} path(s) map to no gate:\n    ${unmapped.join("\n    ")}`);
  offlineTier(
    "a path nobody mapped is a path nobody has argued is safe to skip, so the offline tier runs.",
  );
}

// CI-excluded gates run here too: they are excluded because CI cannot run them, so a local run is
// the only run they get.
const selected = [...wanted.keys()].filter((g) => TIERS[g] === "offline").sort();
const deferred = [...wanted.keys()].filter((g) => TIERS[g] !== "offline").sort();
const onlyHere = selected.filter((g) => CI_EXCLUDED[g]);

console.log(`\n  running ${selected.length} gate(s): ${selected.join(", ")}`);
if (onlyHere.length) console.log(`  CI cannot run these, so this is their only run: ${onlyHere.join(", ")}`);
if (deferred.length) console.log(`  needs a deployed resource, not run here: ${deferred.join(", ")}`);
console.log("");

if (dry) process.exit(0);

let failed = 0;
for (const name of selected) {
  const result = runGate(name, []);
  const mark = result.ok ? "ok  " : "FAIL";
  console.log(`  ${mark} ${name} (${Math.round(result.ms / 1000)}s)`);
  if (!result.ok) {
    failed += 1;
    console.log(`       ${result.reason}`);
    console.log(result.output ?? "");
  }
}

console.log(`\n${selected.length} gate(s) run, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
