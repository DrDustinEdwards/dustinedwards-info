/**
 * THE design-sync driver entrypoint for this repo: regenerate the derived inputs, then run the
 * staged driver.
 *
 *   npm run design:resync                 -- the whole chain
 *   npm run design:resync -- --remote x   -- flags pass through to resync.mjs
 *
 * ## WHY THIS WRAPPER EXISTS
 *
 * `.design-sync/config.json` declares `buildCmd`, and NOTHING EXECUTES IT. In the staged skill
 * that key appears only in `lib/common.mjs`'s list of known config names; the driver's build stage
 * spawns `package-build.mjs` directly and never spawns `cfg.buildCmd`. So the flattened stylesheet
 * the converter copies verbatim was regenerated only when a human remembered to.
 *
 * On 2026-09-21 one did not, and the driver went green against a ds-styles.css fourteen hours
 * older than its sheets: a superseded public-chrome.css compiled in, the light header drew its
 * wordmark white on paper at 1.06:1, and every grade downstream measured that CSS and passed it.
 * The fix cannot live in the driver itself, which is gitignored under `.ds-sync/` and re-copied
 * from the skill bundle on every sync, so a patch there is gone at the next skill version. It
 * lives here, where it is tracked, and `check:design-inputs` catches a run that went around it.
 *
 * ## WHAT IT DOES NOT DO
 *
 * It adds no stage, one step and ONE policy: the preview cards copied into the bundle, and the
 * upload scope applied to the driver's verdict (both below). The
 * four repo-shaped flags are the ones `.design-sync/NOTES.md` has always specified, and everything
 * else passes through untouched so the driver keeps owning its own CLI. A flag given on the command line WINS over the default
 * here, so `--out` elsewhere or an added `--remote` needs no change to this file.
 */

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { enforceVerdict } from "./lib/ds-upload-scope.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILD_INPUTS = ".design-sync/build-inputs.mjs";
const DRIVER = ".ds-sync/resync.mjs";
/** Where `.design-sync/build-cards.mjs` writes; stage 0 builds it. */
const CARDS = join(REPO, ".design-sync", ".cache", "cards");

/**
 * The repo's own answer to the driver's required flags. `--entry` is not optional here: there is
 * no `dist/`, and without it the converter looks for a `node_modules/dustinedwards-info` that does
 * not exist.
 */
const DEFAULTS = [
  ["--config", ".design-sync/config.json"],
  ["--node-modules", "./node_modules"],
  ["--entry", ".design-sync/ds-entry.tsx"],
  ["--out", "./ds-bundle"],
];

const passthrough = process.argv.slice(2);

/*
 * The staged driver is the one thing here that is not tracked. Saying so by name beats an esbuild
 * error twenty lines into a stage that was never going to run.
 */
if (!existsSync(join(REPO, DRIVER))) {
  console.error(
    `✗ ${DRIVER} is not staged. It is gitignored and copied from the /design-sync skill ` +
      `bundle; run the skill's staging step before the driver.`,
  );
  process.exit(2);
}

/**
 * Replace the bundle's `cards/` with the cards stage 0 built. Fails closed on an empty build: a
 * pane with no cards is the defect the cards exist to fix, so it must not upload quietly.
 *
 * @param {string} outDir
 * @returns {string[]} bundle-relative paths
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

/*
 * Stage 0. Fails closed: if the flatten cannot be rebuilt, the driver must not run against
 * whatever the previous one left on disk.
 */
run("regenerate the derived inputs", [join(REPO, BUILD_INPUTS)]);

const args = [join(REPO, DRIVER), ...passthrough];
for (const [flag, value] of DEFAULTS) {
  if (!passthrough.includes(flag)) args.push(flag, resolve(REPO, value));
}

/*
 * THE DRIVER'S STDOUT IS ITS VERDICT, and it is captured rather than inherited so the upload
 * scope is applied BEFORE anything downstream reads it: the skill uploads from this verdict, and a
 * verdict already printed cannot be taken back. A plan that writes or deletes outside what the
 * build owns comes back refused (ruling 137); see `lib/ds-upload-scope.mjs`.
 */
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
const outDir = resolve(REPO, args[outIndex + 1]);
let parsed;
try {
  parsed = JSON.parse(driver.stdout);
} catch {
  /* An unreadable verdict cannot be checked, so it cannot be uploaded from. */
  process.stdout.write(driver.stdout ?? "");
  console.error("✗ the driver's verdict is not JSON, so its upload plan cannot be checked.");
  process.exit(1);
}

/*
 * THE PREVIEW CARDS join the bundle here, after the driver, which knows nothing about them (see
 * `.design-sync/build-cards.mjs`). Their digest is in the README header, so a changed card flips
 * the docs partition (`upload.aux`); the verdict then names the cards beside it, because the
 * driver's partitions have no slot for them and an upload that follows the partitions alone would
 * leave them out. Copied before the scope check, so the check sees them as planned writes.
 */
const cardFiles = copyCards(outDir);
if (parsed?.upload?.aux) parsed.upload.cards = cardFiles;

const { verdict, violations } = enforceVerdict(parsed, outDir);
if (violations.length) {
  writeFileSync(join(outDir, ".resync-verdict.json"), JSON.stringify(verdict, null, 2) + "\n");
  process.stdout.write(JSON.stringify(verdict, null, 2) + "\n");
  console.error(`✗ upload plan refused, ${violations.length} path(s) outside the build's scope:`);
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
/* The verdict as amended above, so the skill reads the card list the driver could not write. */
process.stdout.write(JSON.stringify(verdict, null, 2) + "\n");
