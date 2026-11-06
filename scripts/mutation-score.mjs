#!/usr/bin/env node
// A mutation score for the pure app/lib modules: how many deliberate bugs the tests that import a module notice.
//
//   node scripts/mutation-score.mjs --list                    which modules, and which node:test files cover each
//   node scripts/mutation-score.mjs --module app/lib/x.mjs    one module
//   node scripts/mutation-score.mjs [--shard I/N] [--limit N] every module, or the I-th of N slices of them (CI: .github/workflows/mutation.yml)
//
// Slices are balanced by time, not by count: scripts/mutation-seconds.json holds each module's measured seconds on a CI
// runner, and the modules are dealt longest first to the slice with the least so far. One module (the registry catalog)
// takes most of an hour while forty take under a minute, so a slice of every Nth module ran anywhere from 15 to 96
// minutes. A module the file does not name counts as the median until it is measured; each slice's summary records the
// seconds every module took, so refreshing the file is copying those numbers in.
//
// Stryker's built-in command runner, one `node --test` command per mutant over the files that import the module. It says
// whether each mutant was killed, not which test killed it, so it is a score and not a kill matrix.
// Stryker is run through npx, pinned below, and is not a dependency of the site. Measured, not gated: this never fails on a
// low score, and it exits non-zero only when Stryker itself could not run.

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const STRYKER = "@stryker-mutator/core@10.0.0";
const root = process.cwd();
const outDir = join(root, "reports", "mutation");
const SECONDS = join(fileURLToPath(new URL(".", import.meta.url)), "mutation-seconds.json");

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
  // Sorted: readdir order is the filesystem's, and a slice must hold the same modules on every machine.
  const modules = ["lib", "kb"].flatMap((dir) => walk(join(root, "app", dir)).map(posix)).sort();
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
    // No type checker runs here, so there is nothing to disable, and the default rewrite prepends `// @ts-nocheck` to
    // every .mjs in the sandbox, generated modules included: test/registry-align.test.mjs compares
    // references.generated.mjs byte for byte with what the FASTA files generate, so the dry run failed on align.mjs and
    // reference.mjs and stopped their slices (the weekly runs of 2026-10-19 to 2026-11-02).
    disableTypeChecks: false,
  };
  const configFile = join(work, "stryker.config.json");
  writeFileSync(configFile, JSON.stringify(config));
  const started = Date.now();
  const run = spawnSync("npx", ["--yes", STRYKER, "run", configFile], { cwd: root, stdio: "inherit", shell: true });
  const seconds = Math.round((Date.now() - started) / 1000);
  if (run.status !== 0) return { file: module, failed: `Stryker exited ${run.status}`, seconds };
  // Stryker's own report, kept for devkit's code map (mutation.yml's code-map job), which places each mutant in its function.
  mkdirSync(join(outDir, "stryker"), { recursive: true });
  copyFileSync(reportFile, join(outDir, "stryker", `${module.replaceAll("/", "__")}.json`));
  return { ...score(JSON.parse(readFileSync(reportFile, "utf8")), module), seconds };
}

/**
 * The I-th of N slices, balanced by measured time: longest first, each to the slice with the least so far, ties to the
 * lower slice, so every machine deals the same slices from the same list.
 * @param {string[]} modules @param {number} index @param {number} count
 */
function slice(modules, index, count) {
  /** @type {Record<string, number>} */
  const measured = JSON.parse(readFileSync(SECONDS, "utf8"));
  const known = Object.values(measured).sort((a, b) => a - b);
  const median = known.length ? known[Math.floor(known.length / 2)] : 1;
  const cost = (/** @type {string} */ m) => measured[m] ?? median;
  const totals = Array.from({ length: count }, () => 0);
  /** @type {string[][]} */
  const slices = Array.from({ length: count }, () => []);
  for (const module of [...modules].sort((a, b) => cost(b) - cost(a) || a.localeCompare(b))) {
    const least = totals.indexOf(Math.min(...totals));
    totals[least] += cost(module);
    slices[least].push(module);
  }
  const mine = new Set(slices[index - 1]);
  console.log(`slice ${index} of ${count}: ${mine.size} modules, about ${Math.round(totals[index - 1] / 60)} min measured`);
  return modules.filter((module) => mine.has(module));
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
    const inSlice = new Set(only ? [only] : slice([...modules.keys()], shard[0], shard[1]));
    const chosen = [...modules].filter(([module]) => inSlice.has(module)).slice(0, limit);
    if (only && chosen.length === 0) throw new Error(`${only} is not a covered pure module; --list shows the ones that are`);
    mkdirSync(outDir, { recursive: true });
    // Every module runs even after one fails: stopping at the first lost the rest of the slice's scores.
    const results = chosen.map(([module, tests]) => mutate(module, tests));
    const rows = results.filter((row) => !("failed" in row));
    const failed = results.filter((row) => "failed" in row);
    writeFileSync(join(outDir, `summary-${shard[0]}-of-${shard[1]}.json`), `${JSON.stringify(rows, null, 2)}\n`);
    const lines = ["| module | score | killed | timeout | survived | no coverage | seconds |", "| --- | --- | --- | --- | --- | --- | --- |"];
    for (const row of results) {
      lines.push(
        "failed" in row
          ? `| ${row.file} | tool failed: ${row.failed} | | | | | ${row.seconds} |`
          : `| ${row.file} | ${row.score ?? "n/a"} | ${row.Killed} | ${row.Timeout} | ${row.Survived} | ${row.NoCoverage} | ${row.seconds} |`,
      );
    }
    console.log(lines.join("\n"));
    if (process.env.GITHUB_STEP_SUMMARY) writeFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`, { flag: "a" });
    if (failed.length > 0) {
      console.error(`Stryker failed on ${failed.map((row) => row.file).join(", ")}; this is the tool failing, not a low score`);
      process.exitCode = 1;
    }
  }
}
