/**
 * Runner: run the gates that cover what this branch touched, and nothing else (ruling 129).
 *
 *   npm run check:changed            compares against origin/main
 *   npm run check:changed -- --base <ref>
 *   npm run check:changed -- --dry   print the mapping, run nothing
 *
 * BOUNDARY: it maps PATHS to gates, so it cannot know that editing one file broke a gate whose
 * subject is another file. That is what CI is for, and hard rule 16 already makes ship trust CI
 * rather than a local run. This is the pass before the push, not a replacement for the suite.
 *
 * UNMAPPED FALLS BACK TO THE WHOLE OFFLINE TIER, which is the one decision that keeps this honest:
 * a mapping that quietly skipped a path it did not recognise would report a clean run over checks
 * that never executed, which is hard rule 10's class of failure.
 */

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { gateNames } from "./build-stack.mjs";
import { CI_EXCLUDED, TIERS, runGate } from "./check-all.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * THE MAPPING. Each rule names the paths it owns and the gates that READ those paths. A gate
 * belongs on a rule when the gate would notice the edit, not when it merely runs nearby.
 *
 * @type {Array<{what: string, test: RegExp, gates: string[]}>}
 */
const MAP = [
  {
    what: "a stylesheet",
    test: /^app\/(app\.css|styles\/.+\.css)$/,
    gates: ["check:contrast", "check:design-sheets", "check:page-payload", "check:design-vocabulary"],
  },
  {
    what: "a route, component or other app source",
    test: /^app\/.+\.(ts|tsx)$/,
    gates: ["check:types", "check:invariants", "check:features", "check:microformats", "check:urls"],
  },
  {
    what: "the schema or a migration",
    test: /^(app\/db\/schema\.ts|drizzle\/.+)$/,
    gates: ["check:migrations", "check:invariants"],
  },
  {
    what: "a Worker entry",
    test: /^workers\/.+\.ts$/,
    gates: ["check:types", "check:headers", "check:policy", "check:secrets"],
  },
  {
    what: "a post or other content",
    test: /^content\/.+/,
    gates: ["check:content", "check:search", "check:charts", "check:diagrams", "check:llms"],
  },
  {
    what: "publication data",
    test: /^data\/.+/,
    gates: ["check:publications", "check:content"],
  },
  {
    what: "a served asset",
    test: /^public\/.+/,
    gates: ["check:urls", "check:page-payload"],
  },
  {
    what: "the design-sync inputs",
    test: /^\.design-sync\/.+/,
    gates: ["check:design-inputs", "check:design-sheets", "check:guidelines"],
  },
  {
    what: "the wrangler config example",
    test: /^wrangler\..*jsonc?(\.example)?$/,
    gates: ["check:config", "check:invariants"],
  },
  {
    what: "the package manifest",
    test: /^package(-lock)?\.json$/,
    gates: ["check:stack", "check:floors", "check:config"],
  },
  {
    what: "a hook or harness setting",
    test: /^\.claude\/.+\.json$/,
    gates: ["check:hook-matchers", "check:hook-scope", "check:hook-syntax"],
  },
  {
    what: "a skill or a tracked document",
    test: /^(\.claude\/skills\/.+\.md|[A-Z]+\.md|docs\/.+\.md)$/,
    gates: ["check:invariants"],
  },
  {
    what: "a test",
    test: /^test\/.+/,
    gates: ["check:tests"],
  },
];

/**
 * A gate's own script is its own subject. Written as a rule rather than a MAP row because the gate
 * name comes OUT of the path: `scripts/check-foo.mjs` is what `check:foo` reads first.
 *
 * @param {string} file
 * @returns {string[] | null}
 */
function ownGate(file) {
  const m = /^scripts\/check-([a-z0-9-]+)\.mjs$/.exec(file);
  return m ? [`check:${m[1]}`] : null;
}

/**
 * THE TIER'S OWN MACHINERY. A runner, a shared library or the stack builder is read by every gate,
 * so the honest mapping is the whole offline tier. Named here rather than left to fall through the
 * unmapped branch: the two take the same action, and only this one can say WHY.
 */
const TIER_WIDE = /^scripts\/(check-all|check-changed|build-stack)\.mjs$|^scripts\/lib\//;

/** @param {string[]} argv */
function parseArgs(argv) {
  const base = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "origin/main";
  return { base, dry: argv.includes("--dry") };
}

/**
 * Every path this branch touches: committed against the base, plus staged and unstaged, because a
 * gate verifies DISK and the working tree is what is about to be pushed.
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

/*
 * THE MAPPING IS CHECKED AGAINST package.json BEFORE IT IS USED. A row naming a gate that no
 * longer exists would silently contribute nothing, and the run would look narrower than it is.
 */
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

/** @type {Map<string, string[]>} gate -> the paths that asked for it */
const wanted = new Map();
/** @type {string[]} */
const unmapped = [];

for (const file of files) {
  const own = ownGate(file);
  const rules = MAP.filter((r) => r.test.test(file));
  const gates = [...(own ?? []), ...rules.flatMap((r) => r.gates)].filter((g) => declared.has(g));
  if (gates.length === 0) {
    unmapped.push(file);
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

/*
 * OFFLINE GATES RUN HERE, CI_EXCLUDED ONES INCLUDED. An excluded gate is the opposite of one that
 * can be left to CI: it is excluded BECAUSE CI cannot run it (check:page-payload reads a client
 * build the CI job never makes), so a local run is the only run it ever gets.
 *
 * What is left behind is the network and report tiers, which need a deployed database or bucket.
 */
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
    /* The gate's own words, not a summary of them: a failure is read, not counted. */
    console.log(`       ${result.reason}`);
    console.log(result.output ?? "");
  }
}

console.log(`\n${selected.length} gate(s) run, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
