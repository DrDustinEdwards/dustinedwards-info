/**
 * Gate: the design sync's DERIVED INPUTS on disk are the outputs of the sheets on disk.
 *
 *   npm run check:design-inputs
 *
 * ## THE DEFECT THIS REPLAYS
 *
 * `cfg.buildCmd` names `.design-sync/build-inputs.mjs` and nothing executes it: in the staged
 * skill that key appears only in `lib/common.mjs`'s list of known config names, so neither the
 * converter nor the driver ever spawns it. Regenerating the flattened stylesheet was therefore a
 * step a human had to remember. On 2026-09-21 one was not: a driver run went green against a
 * ds-styles.css fourteen hours older than its sheets, compiling a superseded public-chrome.css
 * whose `.site-header-brand` takes `--on-chrome`, and the light header shipped its wordmark white
 * on paper at 1.06:1. Every downstream grade measured the wrong CSS and reported it clean.
 *
 * `scripts/ds-resync.mjs` closes the forget path by regenerating first. This gate closes the
 * bypass path: a driver invoked directly still leaves the staleness on disk, and here it fails.
 *
 * BOUNDARY: content hashes only, never mtimes. A gate in this repo has already failed as stale on
 * a clean tree because a reverted file kept a new mtime; a revert restores a hash exactly. The
 * recipe is `scripts/lib/design-sheets.mjs`'s and is not restated here (hard rule 17), which is
 * what makes the writer and this reader agree byte for byte.
 *
 * ## WHY ABSENT INPUTS SKIP RATHER THAN FAIL
 *
 * The outputs are gitignored and only a sync needs them, so a checkout that has never synced has
 * nothing to be stale. Failing there would block `ship` on an artifact the site does not deploy.
 * What is refused is the half state: an output present with no stamp, or a stamp with no output.
 * The skip prints as a skip and counts no checks, because a pass count is not coverage
 * (hard rule 10).
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFloor } from "./lib/floor.mjs";
import { fileSha, readSheets, sheetsSha, textSha } from "./lib/design-sheets.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const BUILDER = ".design-sync/build-inputs.mjs";
const CSS = ".design-sync/ds-styles.css";
const STAMP = ".design-sync/.cache/inputs-stamp.json";
/** The other two outputs of the same run. Present-or-absent only; their content has one owner. */
const SIDECARS = [".design-sync/tsconfig.paths.json", ".design-sync/readme-header.md"];

const REGENERATE = "npm run design:inputs (or npm run design:resync, which runs it first)";

/**
 * Below this the gate has stopped reading rather than found a clean tree: a search over an empty
 * scope reports what a clean sweep reports (hard rule 10).
 */
const MINIMUM_CHECKS = 6;

let checks = 0;
/** @type {string[]} */
const failures = [];

/** @param {string} label @param {boolean} pass @param {string} detail */
function ok(label, pass, detail) {
  checks += 1;
  if (pass) {
    console.log(`  ok    ${label}`);
    return;
  }
  console.log(`  FAIL  ${label}`);
  failures.push(`${label}: ${detail}`);
}

/** @param {string} rel */
const abs = (rel) => join(REPO, rel);

function main() {
  const hasCss = existsSync(abs(CSS));
  const hasStamp = existsSync(abs(STAMP));

  /*
   * Neither half on disk: this checkout has never run the generator. Nothing to verify, and
   * saying so is not the same as saying it passed.
   */
  if (!hasCss && !hasStamp) {
    console.log(`  skip  no generated design-sync inputs on disk (${CSS} absent)`);
    return;
  }

  /*
   * A half state is a refusal, not a skip. Both directions: an output with no stamp predates the
   * stamp or was written by hand, and a stamp with no output describes something that is gone.
   */
  if (hasCss !== hasStamp) {
    const present = hasCss ? CSS : STAMP;
    const missing = hasCss ? STAMP : CSS;
    ok(
      "the generated inputs and their stamp are both present",
      false,
      `${present} exists and ${missing} does not, so the outputs cannot be shown to match the ` +
        `sheets. Run ${REGENERATE}.`,
    );
    return;
  }

  /** @type {Record<string, unknown>} */
  let raw;
  try {
    raw = JSON.parse(readFileSync(abs(STAMP), "utf8"));
  } catch (error) {
    ok(
      "the stamp parses",
      false,
      `${STAMP}: ${error instanceof Error ? error.message : String(error)}. Run ${REGENERATE}.`,
    );
    return;
  }

  /*
   * Narrowed field by field rather than trusted: a stamp from an older generator would otherwise
   * compare undefined against a hash and read as drift with a misleading reason, or two
   * undefineds would read as a match.
   */
  const builder = typeof raw.builder === "string" ? raw.builder : null;
  const stampedSheetsSha = typeof raw.sheetsSha === "string" ? raw.sheetsSha : null;
  const stampedCssSha = typeof raw.cssSha === "string" ? raw.cssSha : null;
  const stamped =
    Array.isArray(raw.sheets) && raw.sheets.every((s) => typeof s === "string")
      ? /** @type {string[]} */ (raw.sheets)
      : null;
  const generatedAt = typeof raw.generatedAt === "string" ? raw.generatedAt : "(no timestamp)";

  /** @type {string[]} */
  const missingFields = [];
  if (builder === null) missingFields.push("builder");
  if (stamped === null) missingFields.push("sheets");
  if (stampedSheetsSha === null) missingFields.push("sheetsSha");
  if (stampedCssSha === null) missingFields.push("cssSha");
  if (builder === null || stamped === null || stampedSheetsSha === null || stampedCssSha === null) {
    ok(
      "the stamp carries every field this gate compares",
      false,
      `${STAMP} is missing or has a non-string ${missingFields.join(", ")}. It was written by an ` +
        `older generator; run ${REGENERATE}.`,
    );
    return;
  }

  ok(
    "build-inputs.mjs is unchanged since it wrote these outputs",
    builder === fileSha(abs(BUILDER)),
    `${BUILDER} has been edited since the outputs were generated, so SHEETS, the url() rewrite ` +
      `or the comment strip may have moved without the outputs following. Run ${REGENERATE}.`,
  );

  const current = readSheets(REPO);
  const added = current.filter((s) => !stamped.includes(s));
  const dropped = stamped.filter((s) => !current.includes(s));
  const listMoved = added.length > 0 || dropped.length > 0;
  ok(
    "SHEETS is the same list, in the same order, as the one compiled",
    !listMoved && current.join(">") === stamped.join(">"),
    [
      added.length > 0 ? `added to SHEETS since: ${added.join(", ")}` : "",
      dropped.length > 0 ? `no longer in SHEETS: ${dropped.join(", ")}` : "",
      !listMoved ? "the list is reordered, and that list IS the cascade" : "",
    ]
      .filter(Boolean)
      .join("; ") + `. Run ${REGENERATE}.`,
  );

  /*
   * Scoped to the STAMPED list rather than the current one: when the list itself moved, the check
   * above is the one that should name it, and hashing files the outputs never saw would report a
   * second failure for one cause.
   */
  const goneSheets = stamped.filter((s) => !existsSync(abs(s)));
  ok(
    "every stamped sheet is still on disk",
    goneSheets.length === 0,
    `${goneSheets.join(", ")} was compiled into ${CSS} and is gone. Run ${REGENERATE}.`,
  );
  ok(
    "the stylesheets are unchanged since they were flattened",
    goneSheets.length === 0 && stampedSheetsSha === sheetsSha(REPO, stamped),
    goneSheets.length > 0
      ? "not measured: a stamped sheet is missing, named above."
      : `at least one of the ${stamped.length} sheets has changed since ${CSS} was generated, so ` +
        `the converter would copy a superseded flatten and every grade downstream would measure ` +
        `it. Run ${REGENERATE}.`,
  );

  ok(
    `${CSS} is the file that stamp was written for`,
    stampedCssSha === textSha(readFileSync(abs(CSS), "utf8")),
    `${CSS} has changed since the stamp was written. It is generated and gitignored: edit the ` +
      `sheets, never the flatten. Run ${REGENERATE}.`,
  );

  const missingSidecars = SIDECARS.filter((s) => !existsSync(abs(s)));
  ok(
    "the run's other outputs are present",
    missingSidecars.length === 0,
    `${missingSidecars.join(", ")} missing. The same command writes all three, so one absent ` +
      `means the run did not finish. Run ${REGENERATE}.`,
  );

  console.log(`\n  ${stamped.length} sheets bound, stamped ${generatedAt}`);

  const breach = assertFloor("check:design-inputs", "checks", checks, MINIMUM_CHECKS);
  if (breach) ok("this gate executed its assertions", false, breach);
}

try {
  main();
  if (failures.length > 0) {
    console.error(`\n${failures.length} FAILED of ${checks} checks:\n`);
    for (const f of failures) console.error(`  ${f}`);
    process.exitCode = 1;
  } else if (checks === 0) {
    /* Not "0 checks, 0 failures": a verdict that reads like a pass when nothing was measured is
     * the vacuity hard rule 10 names. */
    console.log("\nSKIPPED: the generator has not run in this checkout, so nothing can be stale");
  } else {
    console.log(`\n${checks} checks, 0 failures`);
  }
} catch (error) {
  console.error(
    `\ncheck:design-inputs could not run: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
