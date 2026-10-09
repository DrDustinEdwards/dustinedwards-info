#!/usr/bin/env node
// A mutation score for the pure app/lib modules: how many deliberate bugs the tests that import a module notice.
//
//   node scripts/mutation-score.mjs --list                    which modules, and which node:test files cover each
//   node scripts/mutation-score.mjs --module app/lib/x.mjs    one module
//   node scripts/mutation-score.mjs [--shard I/N] [--limit N] every module, or the I-th of N slices of them (CI: .github/workflows/mutation.yml)
//
// Stryker's built-in command runner, one `node --test` command per mutant over the files that import the module. It says
// whether each mutant was killed, not which test killed it, so it is a score and not a kill matrix (baseline.md, option a).
// Stryker is run through npx, pinned below, and is not a dependency of the site. Measured, not gated: this never fails on a
// low score, and it exits non-zero only when Stryker itself could not run.

import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";

const STRYKER = "@stryker-mutator/core@10.0.0";
const root = process.cwd();
const outDir = join(root, "reports", "mutation");

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "node_modules" ? [] : walk(path);
    return [path];
  });
}
const posix = (/** @type {string} */ path) => relative(root, path).replaceAll("\\", "/");

/**
 * Every app/lib and app/kb module a node:test file imports and that needs no Workers runtime, with the files that import it.
 * A module that imports `cloudflare:` cannot run under `node --test`, so it is not mutated here.
 * @returns {Map<string, string[]>}
 */
function discover() {
  const tests = walk(join(root, "test"))
    .filter((file) => file.endsWith(".test.mjs"))
    .map((file) => ({ file: posix(file), source: readFileSync(file, "utf8") }));
  const map = new Map();
  const modules = ["lib", "kb"].flatMap((dir) => walk(join(root, "app", dir)).map(posix));
  for (const file of modules.filter((f) => f.endsWith(".mjs") && !f.endsWith(".generated.mjs"))) {
    if (/from\s+["']cloudflare:/.test(readFileSync(join(root, file), "utf8"))) continue;
    const rel = file.slice("app/".length);
    const importer = new RegExp(`from\\s+["'](?:(?:\\.\\./)+app/|~/)${rel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`);
    const covering = tests.filter((test) => importer.test(test.source)).map((test) => test.file);
    if (covering.length > 0) map.set(file, covering);
  }
  return map;
}

/** Killed over everything that could have been killed; a mutant nothing covered counts against the tests. */
function score(/** @type {any} */ report, /** @type {string} */ file) {
  const counts = { Killed: 0, Timeout: 0, Survived: 0, NoCoverage: 0, Other: 0 };
  for (const mutant of Object.values(report.files).flatMap((entry) => /** @type {any} */ (entry).mutants)) {
    const status = /** @type {keyof typeof counts} */ (mutant.status in counts ? mutant.status : "Other");
    counts[status] += 1;
  }
  const detected = counts.Killed + counts.Timeout;
  const total = detected + counts.Survived + counts.NoCoverage;
  return { file, ...counts, score: total === 0 ? null : Math.round((detected / total) * 1000) / 10 };
}

/** @param {string} module @param {string[]} testFiles */
function mutate(module, testFiles) {
  const work = mkdtempSync(join(tmpdir(), "mutation-"));
  const reportFile = join(work, "report.json");
  const config = {
    mutate: [module],
    testRunner: "command",
    commandRunner: { command: `node --test ${testFiles.join(" ")}` },
    coverageAnalysis: "off",
    reporters: ["json", "clear-text"],
    jsonReporter: { fileName: reportFile },
    timeoutMS: 60000,
    concurrency: 2,
    tempDirName: join(work, "sandbox"),
    cleanTempDir: true,
    // The repo's tsconfig needs the typescript JS API, which TypeScript 7 does not have; a name that is not a file skips the rewrite.
    tsconfigFile: "none.tsconfig.json",
  };
  const configFile = join(work, "stryker.config.json");
  writeFileSync(configFile, JSON.stringify(config));
  const run = spawnSync("npx", ["--yes", STRYKER, "run", configFile], { cwd: root, stdio: "inherit", shell: true });
  if (run.status !== 0) throw new Error(`Stryker failed on ${module} (exit ${run.status}); this is the tool failing, not a low score`);
  return score(JSON.parse(readFileSync(reportFile, "utf8")), module);
}

const argv = process.argv.slice(2);
{
  const modules = discover();
  if (argv.includes("--list")) {
    for (const [module, tests] of modules) console.log(`${module}\t${tests.join(" ")}`);
    console.log(`${modules.size} modules`);
  } else {
    const only = argv.indexOf("--module") >= 0 ? argv[argv.indexOf("--module") + 1] : null;
    const limit = argv.indexOf("--limit") >= 0 ? Number(argv[argv.indexOf("--limit") + 1]) : Infinity;
    const shard = argv.indexOf("--shard") >= 0 ? argv[argv.indexOf("--shard") + 1].split("/").map(Number) : [1, 1];
    if (shard.length !== 2 || !(shard[0] >= 1 && shard[0] <= shard[1])) throw new Error("--shard is I/N with 1 <= I <= N");
    const chosen = [...modules]
      .filter(([module]) => !only || module === only)
      .filter((_, index) => index % shard[1] === shard[0] - 1)
      .slice(0, limit);
    if (only && chosen.length === 0) throw new Error(`${only} is not a covered pure module; --list shows the ones that are`);
    mkdirSync(outDir, { recursive: true });
    const rows = chosen.map(([module, tests]) => mutate(module, tests));
    writeFileSync(join(outDir, `summary-${shard[0]}-of-${shard[1]}.json`), `${JSON.stringify(rows, null, 2)}\n`);
    const lines = ["| module | score | killed | timeout | survived | no coverage |", "| --- | --- | --- | --- | --- | --- |"];
    for (const row of rows) lines.push(`| ${row.file} | ${row.score ?? "n/a"} | ${row.Killed} | ${row.Timeout} | ${row.Survived} | ${row.NoCoverage} |`);
    console.log(lines.join("\n"));
    if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, { flag: "a" });
  }
}
