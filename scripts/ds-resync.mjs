// `.design-sync/config.json` declares `buildCmd` and nothing executes it, so this wrapper rebuilds the
// flattened stylesheet. The driver is gitignored and re-copied every sync, so a fix there is lost.

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { enforceVerdict } from "./lib/ds-upload-scope.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_INPUTS = ".design-sync/build-inputs.mjs";
const DRIVER = ".ds-sync/resync.mjs";
const CARDS = join(REPO, ".design-sync", ".cache", "cards");

// `--entry` is required: there is no `dist/`, and without it the converter looks for a
// `node_modules/dustinedwards-info` that does not exist.
const DEFAULTS = [
  ["--config", ".design-sync/config.json"],
  ["--node-modules", "./node_modules"],
  ["--entry", ".design-sync/ds-entry.tsx"],
  ["--out", "./ds-bundle"],
];

const passthrough = process.argv.slice(2);
// The scope check reads --out as a separate argument. `--out=x` would leave the default --out appended
// too, and the check would read a directory the driver did not write.
if (passthrough.some((a) => a.startsWith("--out="))) {
  console.error("✗ pass --out as two arguments (--out <dir>), not --out=<dir>.");
  process.exit(2);
}

if (!existsSync(join(REPO, DRIVER))) {
  console.error(
    `✗ ${DRIVER} is not staged. It is gitignored and copied from the /design-sync skill ` +
      `bundle; run the skill's staging step before the driver.`,
  );
  process.exit(2);
}

/**
 * Fails closed on an empty build: a pane with no cards is the defect the cards exist to fix.
 *
 * @param {string} outDir
 * @returns {string[]}
 */
function copyCards(outDir) {
  if (!existsSync(CARDS)) {
    console.error(`✗ ${CARDS} is missing; stage 0 did not build the preview cards.`);
    process.exit(1);
  }
  const dest = join(outDir, "cards");
  rmSync(dest, { recursive: true, force: true });
  cpSync(CARDS, dest, { recursive: true });
  const files = readdirSync(dest, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith(".html"))
    .map((e) => relative(outDir, join(e.parentPath, e.name)).split(sep).join("/"))
    .sort();
  if (files.length === 0) {
    console.error("✗ no preview cards were built, so the pane would show none.");
    process.exit(1);
  }
  console.error(`cards: ${files.length} copied to ${dest}`);
  return files;
}

/** @param {string} label @param {string[]} args */
function run(label, args) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(process.execPath, args, { cwd: REPO, stdio: "inherit" });
  if (r.error) {
    console.error(`✗ ${label} could not start: ${r.error.message}`);
    process.exit(2);
  }
  /* A signal death leaves status null, which is not 0 and must not read as one. */
  if (r.status !== 0) {
    console.error(
      `✗ ${label} exited ${r.status ?? `on signal ${r.signal}`}. Stopping before the next ` +
        `stage: the whole point of this wrapper is that a later stage never reads a stale input.`,
    );
    process.exit(r.status ?? 1);
  }
}

// Fails closed: the driver must not run against whatever the previous flatten left on disk.
run("regenerate the derived inputs", [join(REPO, BUILD_INPUTS)]);

const args = [join(REPO, DRIVER), ...passthrough];
for (const [flag, value] of DEFAULTS) {
  if (!passthrough.includes(flag)) args.push(flag, resolve(REPO, value));
}

// Captured rather than inherited so the upload scope is applied before anything reads the verdict:
// a verdict already printed cannot be taken back.
console.log("\n=== driver: build -> diff -> validate -> capture ===");
const driver = spawnSync(process.execPath, args, {
  cwd: REPO,
  stdio: ["inherit", "pipe", "inherit"],
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
if (driver.error) {
  console.error(`✗ driver could not start: ${driver.error.message}`);
  process.exit(2);
}
if (driver.status !== 0) {
  process.stdout.write(driver.stdout ?? "");
  console.error(`✗ driver exited ${driver.status ?? `on signal ${driver.signal}`}.`);
  process.exit(driver.status ?? 1);
}

const outIndex = args.indexOf("--out");
if (outIndex === -1 || !args[outIndex + 1]) {
  console.error("✗ no --out directory reached the driver, so its upload plan cannot be checked.");
  process.exit(2);
}
const outDir = resolve(REPO, args[outIndex + 1]);
let parsed;
try {
  parsed = JSON.parse(driver.stdout);
} catch (error) {
  process.stdout.write(driver.stdout ?? "");
  console.error(
    `✗ the driver's verdict is not JSON (${error instanceof Error ? error.message : String(error)}), ` +
      "so its upload plan cannot be checked.",
  );
  process.exit(1);
}

// The driver's partitions have no slot for the cards, so the verdict names them here. Copied before
// the scope check, so it sees them as planned writes.
const cardFiles = copyCards(outDir);
if (parsed?.upload?.aux) parsed.upload.cards = cardFiles;

const { verdict, violations } = enforceVerdict(parsed, outDir);
if (violations.length) {
  writeFileSync(join(outDir, ".resync-verdict.json"), JSON.stringify(verdict, null, 2) + "\n");
  process.stdout.write(JSON.stringify(verdict, null, 2) + "\n");
  console.error(`✗ upload plan refused, ${violations.length} problem(s) with the build's scope:`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
process.stdout.write(JSON.stringify(verdict, null, 2) + "\n");
