// Unmapped paths fall back to the whole offline tier: skipping a path it did not recognize would
// report a clean run over checks that never executed.
// Tests: only those whose imports reach a changed file. Types, the full suites and the
// browser test run in CI.

import { errorMessage } from "@dustinedwards/site-runtime/log";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

import { gateNames } from "./build-stack.mjs";
import { root, runGate } from "./lib/gate-run.mjs";
import { MAP, RELATED, gatesFor } from "./lib/changed-map.mjs";
import { CI_EXCLUDED, TIERS } from "./lib/gate-tiers.mjs";
import { isMain } from "./lib/is-main.mjs";

/**
 * Every source file `entry` reaches through relative and `~/` imports, itself included. A specifier
 * that resolves to nothing (a package, a `?url` asset, a stylesheet) is skipped: the walk only has to
 * find the repo files a test depends on.
 *
 * @param {string} entry
 * @param {string} appDir
 * @param {(path: string) => string | null} read
 * @returns {Set<string>}
 */
export function reachedModules(entry, appDir, read) {
  /** @type {Set<string>} */
  const seen = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const file = /** @type {string} */ (queue.pop());
    const resolved = resolveModule(file, read);
    if (!resolved || seen.has(resolved.path)) continue;
    seen.add(resolved.path);
    for (const m of resolved.source.matchAll(/(?:from\s*|import\s*\(?\s*)["']([^"'?]+)["']/g)) {
      const spec = m[1];
      if (spec.endsWith(".css")) continue;
      if (spec.startsWith("~/")) queue.push(join(appDir, spec.slice(2)));
      else if (spec.startsWith(".")) queue.push(join(dirname(resolved.path), spec));
    }
  }
  return seen;
}

/** @param {string} path @param {(path: string) => string | null} read */
function resolveModule(path, read) {
  const candidates = [
    path,
    `${path}.ts`,
    `${path}.tsx`,
    `${path}.mjs`,
    join(path, "index.ts"),
    join(path, "index.tsx"),
  ];
  for (const candidate of candidates) {
    const source = read(candidate);
    if (source !== null) return { path: candidate, source };
  }
  return null;
}

// A runner, a shared library or the stack builder is read by every gate, so it maps to the whole tier.
const TIER_WIDE = /^scripts\/(check-all|check-changed|build-stack)\.mjs$|^scripts\/lib\//;

/** @param {string[]} argv */
function parseArgs(argv) {
  const base = argv.includes("--base") ? argv[argv.indexOf("--base") + 1] : "origin/main";
  return { base, dry: argv.includes("--dry") };
}

/**
 * @typedef {(args: string[]) => { status: number | null, stdout?: string | null, stderr?: string | null, error?: Error }} GitRunner
 */

/** @type {GitRunner} */
const realGit = (args) => spawnSync("git", args, { cwd: root, encoding: "utf8" });

/**
 * Staged and unstaged too, because a gate verifies disk. A failed git call throws: read as an empty
 * list it would report "nothing changed" over a tree nobody looked at. The base probe is the one
 * call whose exit 1 is an answer (the ref does not exist here), not a failure.
 *
 * @param {string} base
 * @param {GitRunner} [git]
 * @returns {{files: string[], baseUsed: string | null}}
 */
export function changedFiles(base, git = realGit) {
  /** @param {string[]} args @returns {string} */
  const lines = (args) => {
    const r = git(args);
    if (r.error || r.status !== 0) {
      const why = r.error
        ? r.error.message
        : `exit ${r.status}: ${String(r.stderr ?? "")
            .trim()
            .slice(0, 300)}`;
      throw new Error(`git ${args.join(" ")} failed (${why})`);
    }
    return String(r.stdout ?? "");
  };

  const probe = git(["rev-parse", "--verify", "--quiet", base]);
  if (probe.error || (probe.status !== 0 && probe.status !== 1)) {
    const why = probe.error ? probe.error.message : `exit ${probe.status}`;
    throw new Error(`git rev-parse --verify ${base} failed (${why})`);
  }
  const known = probe.status === 0;

  const out = new Set();
  const add = (/** @type {string} */ text) => {
    for (const f of text.split("\n")) if (f.trim()) out.add(f.trim());
  };
  if (known) add(lines(["diff", "--name-only", `${base}...HEAD`]));
  add(lines(["diff", "--name-only"]));
  add(lines(["diff", "--name-only", "--cached"]));
  add(lines(["ls-files", "--others", "--exclude-standard"]));
  return { files: [...out].sort(), baseUsed: known ? base : null };
}

function main() {
  const { base, dry } = parseArgs(process.argv.slice(2));
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const declared = new Set(gateNames(pkg));

  // A row naming a gate that no longer exists would silently contribute nothing.
  const named = new Set(MAP.flatMap((r) => r.gates).filter((g) => g !== RELATED));
  const unknown = [...named].filter((g) => !declared.has(g));
  if (unknown.length) {
    console.error(
      `check:changed maps to gate(s) package.json does not declare: ${unknown.join(", ")}`,
    );
    process.exit(2);
  }

  /** @type {{files: string[], baseUsed: string | null}} */
  let changed;
  try {
    changed = changedFiles(base);
  } catch (error) {
    console.error(
      `check:changed could not list what changed, so it cannot say what to check: ` +
        `${errorMessage(error)}`,
    );
    process.exit(2);
  }
  const { files, baseUsed } = changed;

  /** @param {string} why */
  function offlineTier(why) {
    console.log(`\n  ${why}\n`);
    if (dry) process.exit(0);
    const r = spawnSync("npm run check", { cwd: root, stdio: "inherit", shell: true });
    process.exit(r.status === 0 ? 0 : 1);
  }

  console.log("check:changed");
  console.log(`  ${files.length} changed path(s) against ${baseUsed ?? "HEAD"}\n`);

  // Without the base, committed changes on this branch are invisible, so a mapped subset would be a guess.
  if (!baseUsed) {
    offlineTier(
      `base ${base} is not a known ref here, so the branch's committed changes cannot be listed ` +
        "and the whole offline tier runs.",
    );
  }

  if (files.length === 0) {
    console.log(
      "  nothing changed against the base, in the index, the working tree or untracked files.",
    );
    console.log("  0 gates run, because there is nothing to check.");
    process.exit(0);
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
  /** @type {string[]} */
  const argued = [];

  for (const file of files) {
    const { own, rules, gates } = gatesFor(file, declared);
    if (gates.length === 0) {
      /* A row with no gates is a path argued safe to skip; only a path no row names is unmapped. */
      if (!own && rules.length > 0 && rules.every((r) => r.gates.length === 0)) {
        console.log(`  ${file}\n    ${rules.map((r) => r.what).join(", ")} -> nothing to run`);
        argued.push(file);
      } else {
        unmapped.push(file);
      }
      continue;
    }
    const what = own ? "its own gate" : rules.map((r) => r.what).join(", ");
    console.log(`  ${file}\n    ${what} -> ${gates.join(", ")}`);
    for (const g of gates) wanted.set(g, [...(wanted.get(g) ?? []), file]);
  }

  if (unmapped.length) {
    console.log(`\n  ${unmapped.length} path(s) map to no gate:\n    ${unmapped.join("\n    ")}`);
    offlineTier(
      "a path nobody mapped is a path nobody has argued is safe to skip, so the offline tier runs.",
    );
  }

  // CI-excluded gates run here too: they are excluded because CI cannot run them, so a local run is
  // the only run they get.
  const gateKeys = [...wanted.keys()].filter((g) => g !== RELATED);
  const selected = gateKeys.filter((g) => TIERS[g] === "offline").sort();
  const deferred = gateKeys.filter((g) => TIERS[g] !== "offline").sort();
  const onlyHere = selected.filter((g) => CI_EXCLUDED[g]);

  /** @param {string} path */
  const readSource = (path) => {
    try {
      return readFileSync(path, "utf8");
    } catch (error) {
      const code = /** @type {NodeJS.ErrnoException} */ (error).code;
      if (code === "ENOENT" || code === "EISDIR") return null;
      throw error;
    }
  };

  /** A node test is related when its import walk reaches a changed file, itself included. */
  function relatedNodeTests() {
    const changedPaths = new Set(files.map((f) => join(root, f)));
    return readdirSync(join(root, "test"), { recursive: true })
      .map(String)
      .filter((f) => f.endsWith(".test.mjs"))
      .map((f) => join(root, "test", f))
      .filter((t) =>
        [...reachedModules(t, join(root, "app"), readSource)].some((v) => changedPaths.has(v)),
      )
      .sort();
  }

  // vitest follows its own module graph from these; deleted paths would be an error, not a match.
  const workerSources = wanted.has(RELATED)
    ? files.filter((f) => /^(app|workers|test\/worker)\//.test(f) && existsSync(join(root, f)))
    : [];
  const nodeTests = wanted.has(RELATED) ? relatedNodeTests() : [];

  const ran = selected.length + (nodeTests.length ? 1 : 0) + (workerSources.length ? 1 : 0);
  if (ran === 0) {
    if (wanted.size === 0) {
      console.log(
        `\n  0 gates run: all ${argued.length} changed path(s) are ones no gate or test reads, ` +
          "so this run checked nothing, by design.",
      );
      process.exit(0);
    }
    // Mapped to something, yet nothing local would run: a green line over that would check nothing.
    offlineTier(
      `the changed paths map to ${[...wanted.keys()].join(", ")}, but nothing of that runs here ` +
        "(no related test was found, or the gates need a deployed resource), so the offline tier runs.",
    );
  }

  console.log(`\n  running ${selected.length} gate(s): ${selected.join(", ")}`);
  if (wanted.has(RELATED)) {
    console.log(
      `  related tests: ${nodeTests.length} node test file(s)` +
        (workerSources.length
          ? `, and worker tests related to ${workerSources.length} file(s)`
          : ""),
    );
    for (const t of nodeTests) console.log(`    ${t.slice(root.length + 1).replace(/\\/g, "/")}`);
  }
  if (onlyHere.length)
    console.log(`  CI cannot run these, so this is their only run: ${onlyHere.join(", ")}`);
  if (deferred.length)
    console.log(`  needs a deployed resource, not run here: ${deferred.join(", ")}`);
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

  /** @param {string} label @param {string} command @param {string[]} args */
  function runTests(label, command, args) {
    const started = Date.now();
    const r = spawnSync(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    const ok = r.status === 0;
    console.log(
      `  ${ok ? "ok  " : "FAIL"} ${label} (${Math.round((Date.now() - started) / 1000)}s)`,
    );
    if (!ok) failed += 1;
  }

  if (nodeTests.length) runTests("related node tests", "node", ["--test", ...nodeTests]);
  if (workerSources.length) {
    runTests("related worker tests", "npx", [
      "vitest",
      "related",
      "--run",
      "--passWithNoTests",
      ...workerSources,
    ]);
  }

  console.log(`\n${ran} gate(s) and test run(s), ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

/* Main guard, so a test can import the map and the file lister without running a check. */
if (isMain(import.meta.url)) main();
