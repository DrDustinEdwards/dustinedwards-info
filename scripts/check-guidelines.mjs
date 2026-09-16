/**
 * Gate: the Capsid documents handed to the design agent are not stale, and the
 * guidelines the glob ships actually exist.
 *
 * ## THE DEFECT THIS IS FOR, ruling 109
 *
 * `guidelinesGlob` now ships an export of three Capsid documents. An export is
 * a copy, and a copy has no way of knowing its source moved. Without an
 * instrument, the canvas would be handed a ruling that was reversed a week ago
 * and nothing anywhere would say so; the design agent would be confidently
 * working from a superseded rule, which is the exact failure the whole wiring
 * arc exists to close.
 *
 * Every exported file carries the `updated_at` it was taken at. This compares
 * that stamp to Capsid's CURRENT value. Hard rule 18's shape: the export is
 * derived, the repair is re-running the derivation, and the gate sees the
 * DRIFT rather than trying to police how the copy got there.
 *
 * ## NETWORK TIER, AND IT CANNOT BE OTHERWISE
 *
 * The current `updated_at` lives in Capsid. There is no disk to read, so a
 * clean checkout cannot run this and `--ci` does not, the same reason
 * `check:volumes` and `check:uptime` are tiered here.
 *
 * ## THE CREDENTIAL FAILS CLOSED, on check:volumes' precedent
 *
 * `CAPSID_TOKEN` from the environment or the gitignored `.dev.vars`. Absent,
 * this FAILS rather than skipping: a gate that silently does not run is the
 * thing the runner exists to prevent, and an unchecked export is not an export
 * known to be current.
 *
 * ## WHY IT ALSO CHECKS THE GLOB
 *
 * A stamp check over an empty directory passes, because every export it found
 * was in step and it found none. That is the zero-scope vacuity class (hard
 * rule 10), so the glob's own targets are asserted present first, and the
 * expected document list comes from `lib/capsid.mjs` rather than from whatever
 * happens to be on disk.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { assertFloor } from "./lib/floor.mjs";
import { readDevVar } from "./lib/dev-vars.mjs";
import { callTool, NAMESPACE, EXPORTED_DOCS, parseStamp } from "./lib/capsid.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = join(REPO, ".design-sync/config.json");
const CAPSID_DIR = join(REPO, ".design-sync/guidelines/capsid");

/** One per document, plus the config, glob and scope assertions. */
const MINIMUM_CHECKS = 8;

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

async function main() {
  console.log("check:guidelines\n");

  const cfg = JSON.parse(readFileSync(CONFIG, "utf8"));
  const globs = cfg.guidelinesGlob;

  ok(
    "guidelinesGlob is an explicit non-empty list",
    Array.isArray(globs) && globs.length > 0,
    `guidelinesGlob is ${JSON.stringify(globs)}. An empty array is not "unused": the ` +
      `skill tests \`cfg.guidelinesGlob == null\` for its defaults, so [] is a switch ` +
      `turned OFF and ships nothing at all. Ruling 109.`,
  );

  // Every literal (wildcard-free) glob entry must resolve to a file that exists,
  // and every wildcard entry to a directory with something in it. A glob that
  // matches nothing ships nothing and says nothing.
  for (const glob of Array.isArray(globs) ? globs : []) {
    if (glob.includes("*")) {
      const dir = join(REPO, glob.slice(0, glob.lastIndexOf("/")));
      const populated = existsSync(dir) && readdirSync(dir).some((f) => f.endsWith(".md"));
      ok(
        `glob ${glob} matches at least one file`,
        populated,
        `nothing at ${dir}. Run the build step that generates it; a glob matching ` +
          `nothing ships nothing, and reports the same as a clean one.`,
      );
    } else {
      ok(
        `glob ${glob} exists`,
        existsSync(join(REPO, glob)),
        `no file at ${glob}, so the skill will warn and skip it.`,
      );
    }
  }

  const token = process.env.CAPSID_TOKEN || readDevVar("CAPSID_TOKEN");
  ok(
    "CAPSID_TOKEN is readable",
    Boolean(token),
    "Absent from the environment and from .dev.vars, so the exports cannot be " +
      "compared against their sources and this gate would prove nothing. It is a " +
      "machine-local operator credential, not a wrangler secret.",
  );
  if (!token) return;

  ok(
    "the capsid export directory exists",
    existsSync(CAPSID_DIR),
    `${CAPSID_DIR} is missing. Run \`node scripts/build-capsid-guidelines.mjs\`. ` +
      `Checking stamps over an empty directory passes by finding nothing.`,
  );
  if (!existsSync(CAPSID_DIR)) return;

  for (const wanted of EXPORTED_DOCS) {
    const name = wanted.path.replace(/[^A-Za-z0-9._-]/g, "-");
    const file = join(CAPSID_DIR, name);
    if (!existsSync(file)) {
      ok(`${wanted.path} is exported`, false, `no ${name} in the export directory; re-run the build step.`);
      continue;
    }

    const stamp = parseStamp(readFileSync(file, "utf8"));
    if (!stamp) {
      ok(`${wanted.path} carries a source stamp`, false, `${name} has no capsid-source stamp, so it cannot be checked.`);
      continue;
    }

    const live = await callTool(token, "read", { namespace: NAMESPACE, path: wanted.path });
    const current = live?.updated_at ?? "";
    ok(
      `${wanted.path} export is current`,
      Boolean(current) && stamp.updated_at === current,
      `the export was taken at ${stamp.updated_at} and Capsid now says ${current || "(no updated_at)"}. ` +
        `The design agent is holding a superseded copy. Re-run ` +
        `\`node scripts/build-capsid-guidelines.mjs\`.`,
    );
  }

  const breach = assertFloor("check:guidelines", "checks", checks, MINIMUM_CHECKS);
  if (breach) ok("this gate executed its assertions", false, breach);
}

main()
  .then(() => {
    if (failures.length > 0) {
      console.error(`\n${failures.length} FAILED of ${checks} checks:\n`);
      for (const f of failures) console.error(`  ${f}`);
      process.exitCode = 1;
      return;
    }
    console.log(`\n${checks} checks, 0 failures`);
  })
  .catch((error) => {
    console.error(
      `\ncheck:guidelines could not run: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
