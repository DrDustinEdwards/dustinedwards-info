/**
 * Gate over CLAUDE.md's size and shape.
 *
 *   npm run check:claude-md
 *
 * OBSERVATION BOUNDARY: this reads CLAUDE.md as bytes and asserts its SHAPE.
 * It cannot tell whether a single sentence in it is TRUE, whether a command it
 * lists exists, or whether the Capsid documents it points at say what it claims.
 * A file that is small, correctly ordered and entirely wrong passes here.
 *
 * ## Why a size gate at all
 *
 * CLAUDE.md is injected into every session's context. There is a documented
 * limit near 40,000 characters, past which content is silently truncated, and
 * SILENTLY is the whole problem: nothing in the harness reports it, so a rule
 * that scrolled past the boundary is a rule that does not exist for that
 * session, and it reads as present to anyone opening the file.
 *
 * Measured 2026-08-07, before the rewrite: the file was 65,489 characters, so
 * 39% of it was past the boundary. What sat in that 39% was the ENTIRE hard
 * rules section, because it was last. The rules a session most needed were the
 * ones it could not see.
 *
 * ## Why the ordering assertion is not decoration
 *
 * Size alone would not have caught that. A 39,000 character file with the rules
 * at the end is inside the limit and still puts the most important pointer where
 * a reader gives up. So the gate asserts BOTH: the file fits, and the pointer at
 * the hard rules appears early enough to be read before anything else.
 *
 * The 10,000 ceiling is a judgement, not a platform fact, and it is written here
 * rather than derived so that moving it is a deliberate edit in a diff.
 *
 * ## The character offset ALONE was an assertion that could not fail
 *
 * Caught by planting it, 2026-08-07, which is the only reason it is not still
 * here. With the file at 8,479 characters, moving the hard-rules section to the
 * very END of the document put it at offset 7,749, comfortably under the 10,000
 * ceiling. The gate stayed green on the exact reordering it was written to
 * prevent. A threshold larger than the whole file is not a threshold.
 *
 * So the ORDINAL check below is the one with teeth: the hard rules must be among
 * the first two `##` sections, which is falsifiable at any file size. The
 * character ceiling is kept because it starts mattering again the moment the
 * file grows, and it fails for a different reason (a bloated section ABOVE the
 * rules pushing them down), but on today's file it is slack and this note is
 * here so nobody mistakes it for the load-bearing one.
 *
 * That is hard rule 10 applied to this gate's own assertions: a pass count is
 * not coverage, and the way to know is to plant the violation.
 *
 * ## Why this is its own gate rather than a section of check:headers
 *
 * check:headers exists to argue a transcribed ratification against a parse of
 * `workers/app.ts`. Its subject is the security header set. Adding a file-size
 * assertion to it would make its name false, hide the assertion from anyone
 * looking for what checks CLAUDE.md, and widen a security gate's stated
 * boundary to cover something unrelated. Gates here are named for what they
 * observe.
 *
 * FAILS CLOSED. A missing file, an empty file, or a file with no hard-rules
 * section is a failure, never a skip.
 *
 * Pure: no network, no database, no build.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PATH = join(root, "CLAUDE.md");

/**
 * The ceilings, transcribed here rather than read from the file being checked.
 *
 * TRUNCATION is the platform constraint. POINTER is this repo's judgement about
 * how far into a file a session can be trusted to read before it starts acting.
 */
const TRUNCATION_LIMIT = 40000;
const POINTER_LIMIT = 10000;

/** Below this, the file is a stub and every shape assertion below is vacuous. */
const MINIMUM_PLAUSIBLE = 1000;

let checks = 0;
let failures = 0;

/** @param {string} label @param {boolean} condition @param {string} [detail] */
function ok(label, condition, detail = "") {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${label}${detail ? `: ${detail}` : ""}`);
  }
}

console.log("\ncheck:claude-md\n");

if (!existsSync(PATH)) {
  console.log("  FAIL  CLAUDE.md is missing.\n");
  process.exit(1);
}

const source = readFileSync(PATH, "utf8");

/* ------------------------------------------------------- fail closed first */

ok(
  "CLAUDE.md is not a stub",
  source.length >= MINIMUM_PLAUSIBLE,
  `${source.length} characters. Below ${MINIMUM_PLAUSIBLE} every assertion below ` +
    `would pass by having nothing to examine.`,
);

/* -------------------------------------------------------------- the size */

ok(
  `CLAUDE.md fits in the context window (under ${TRUNCATION_LIMIT} characters)`,
  source.length < TRUNCATION_LIMIT,
  `${source.length} characters, which is ${source.length - TRUNCATION_LIMIT} over. ` +
    `Everything past the limit is silently truncated, so it is not merely long, ` +
    `it is absent for every session while still reading as present in the file.`,
);

/* ----------------------------------------------------------- the ordering */

/*
 * Anchored on the HEADING, not on a loose phrase. The Commands section lists
 * `check:claude-md` and describes it as checking "the hard-rules pointer", so a
 * substring search for the words would match that line instead and measure the
 * wrong offset. Same class of trap as the comment-stripping ones in
 * check:contrast, check:logo, check:features, check:headers and check:urls.
 */
const HEADING = "\n## Hard rules\n";
const at = source.indexOf(HEADING);

ok(
  "CLAUDE.md has a Hard rules section",
  at !== -1,
  "no `## Hard rules` heading found; the ordering assertion below cannot run",
);

if (at !== -1) {
  ok(
    `the hard-rules pointer appears before character ${POINTER_LIMIT}`,
    at < POINTER_LIMIT,
    `found at ${at}. Fitting inside the truncation limit is not enough: a session ` +
      `reads top to bottom and acts before it reaches the end. This section was ` +
      `LAST in the file until 2026-08-07, and therefore past the truncation ` +
      `boundary entirely.`,
  );

  /*
   * THE ORDINAL CHECK, and it is the one that can actually fail today. See the
   * header: on a file this size the character ceiling is slack, so ordering is
   * asserted structurally instead of by offset.
   */
  const headings = [...source.matchAll(/\n## (.+)/g)].map((m) => m[1].trim());
  const ordinal = headings.findIndex((h) => h === "Hard rules");

  ok(
    "the document has sections to order",
    headings.length >= 3,
    `${headings.length} found; with fewer than three the ordinal check below means nothing`,
  );
  ok(
    "hard rules is one of the FIRST TWO sections",
    ordinal !== -1 && ordinal <= 1,
    `it is section ${ordinal + 1} of ${headings.length}` +
      (ordinal > 1 ? `, after: ${headings.slice(0, ordinal).join(", ")}` : "") +
      `. Only the session ritual may precede it, because the ritual is the one ` +
      `thing that has to happen before a session can read the rules at all.`,
  );

  const next = source.indexOf("\n## ", at + HEADING.length);
  const section = source.slice(at, next === -1 ? source.length : next);

  ok(
    "the section is not empty",
    section.trim().length > 100,
    "a heading with nothing under it satisfies the ordering check and points nowhere",
  );

  /*
   * The section must POINT, not restate. Nineteen rules across two files with
   * four duplicate pairs, three of them false as written, is what restating
   * produced. Ruling: dustinedwards/decisions.md, 2026-08-07.
   */
  ok(
    "the hard-rules section points at core.md",
    section.includes("core.md"),
    "the rules live in dustinedwards/core.md and this section exists to say so",
  );

  ok(
    "the hard-rules section records that the numbering is frozen",
    /frozen/i.test(section),
    "scripts/check-invariants.mjs:44 cites hard rule 11 BY NUMBER, so renumbering " +
      "silently breaks a code comment. If that note is gone, the next reader has " +
      "no reason not to renumber.",
  );
}

console.log(
  `  ${source.length} characters of ${TRUNCATION_LIMIT}` +
    (at !== -1 ? `, hard-rules pointer at ${at} of ${POINTER_LIMIT}` : ""),
);

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
