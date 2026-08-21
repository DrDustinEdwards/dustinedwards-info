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
 * ## LINE ENDINGS, and the second thing this gate got wrong
 *
 * The first version matched the literal `"\n## Hard rules\n"`. `core.autocrlf`
 * is true on this host and CLAUDE.md was not pinned in `.gitattributes`, so the
 * author's working copy was LF while a fresh clone was CRLF. The needle matched
 * on disk and matched nothing in a clean extraction of the very same commit.
 *
 * **The gate was green locally and RED on every fresh Windows clone**, found by
 * extracting HEAD into a worktree and running it there, which is backlog item 1
 * applied by hand to the gate written that morning because of backlog item 1.
 *
 * Two changes, and it needs BOTH:
 *
 *   1. `.gitattributes` case 5 pins CLAUDE.md to LF, so the file this gate
 *      measures is the same bytes everywhere. Asserted below, so removing the
 *      pin fails here rather than silently changing what is measured.
 *   2. Everything structural is matched against a NORMALIZED copy. That is what
 *      protects the next file somebody measures before remembering to pin it.
 *
 * Normalizing is deliberate rather than relying on `.trim()`. The ordinal check
 * below survived the CRLF break by accident, because `trim()` happens to strip
 * the trailing `\r` from a captured heading. Accident is not a mechanism, and
 * the next assertion written in the same style would not be so lucky.
 *
 * SIZE is measured on the RAW bytes, not the normalized copy, because the
 * truncation limit applies to the file as the machine actually has it.
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

/**
 * Below this, the file is a stub and every shape assertion below is vacuous.
 *
 * FLOOR: was 1000, MEASURED 9199 characters this session through this gate's
 * own read, now 8000 (about 13 percent under).
 *
 * 1000 left an 88 percent blind zone. Nine tenths of this file could be deleted
 * and every structural assertion below would still find its needle in what
 * remained, because the needles all sit near the top. This file's whole job is
 * to be what a session reads FIRST, so a large silent deletion is the failure
 * most worth catching here, not an edge case.
 *
 * It now also detects a large DELIBERATE trim, which is intended: moving this
 * number belongs in the same commit as the trim.
 */
const MINIMUM_PLAUSIBLE = 8000;

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

/**
 * RAW is what the machine has and is what the size assertion measures. TEXT is
 * normalized and is what every structural match runs against, so a needle
 * written with `\n` cannot silently miss on a CRLF checkout. See the header.
 */
const raw = readFileSync(PATH, "utf8");
const text = raw.replace(/\r\n/g, "\n");

/* ------------------------------------------------------- fail closed first */

ok(
  "CLAUDE.md is not a stub",
  raw.length >= MINIMUM_PLAUSIBLE,
  `${raw.length} characters. Below ${MINIMUM_PLAUSIBLE} every assertion below ` +
    `would pass by having nothing to examine.`,
);

/*
 * The pin, asserted rather than trusted. `.gitattributes` case 5 exists so this
 * file is the same bytes on every machine; if it is removed, this fails here
 * instead of quietly changing what the size assertion measures.
 */
ok(
  "CLAUDE.md is checked out with LF endings (.gitattributes case 5)",
  !raw.includes("\r\n"),
  `${(raw.match(/\r\n/g) ?? []).length} CRLF sequence(s) found. The pin is what ` +
    `makes the character count below mean the same thing on every clone. Without ` +
    `it this gate measures whichever line ending the machine happens to carry.`,
);

/* -------------------------------------------------------------- the size */

ok(
  `CLAUDE.md fits in the context window (under ${TRUNCATION_LIMIT} characters)`,
  raw.length < TRUNCATION_LIMIT,
  `${raw.length} characters, which is ${raw.length - TRUNCATION_LIMIT} over. ` +
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
const at = text.indexOf(HEADING);

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
  const headings = [...text.matchAll(/\n## (.+)/g)].map((m) => m[1].trim());
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

  const next = text.indexOf("\n## ", at + HEADING.length);
  const section = text.slice(at, next === -1 ? text.length : next);

  ok(
    "the section is not empty",
    section.trim().length > 100,
    "a heading with nothing under it satisfies the ordering check and points nowhere",
  );

  /*
   * THE RULES LIVE HERE NOW, reversed 2026-08-21.
   *
   * This asserted the OPPOSITE: that the section must point at core.md and must
   * not restate. That was the right call while the rules lived in Capsid, and
   * it became wrong when Grok's audit found why they could not stay there:
   * **Capsid cannot be gated, because every gate verifies disk.** Fourteen
   * source files cite these rules by number and nothing could check the numbers.
   *
   * The old ruling's fear was drift from restating in two places. The answer to
   * that is ONE home rather than the unreachable one, so the section must now
   * CONTAIN the rules and `check:invariants` section 15 binds every cited
   * number to a heading here.
   */
  ok(
    "the hard-rules section contains the rules rather than pointing away",
    /^### \d+\. /m.test(section),
    "no `### N.` rule headings in the section. Since 2026-08-21 this file is the " +
      "one home: pointing at Capsid puts them where no gate can verify them, which " +
      "is the mechanism behind a month of stale numbers.",
  );

  /*
   * COUNTED, not just present. A section carrying one rule heading satisfies
   * the pattern above while fourteen rules are missing, and the citations that
   * resolve are exactly the ones nobody deleted.
   */
  const ruleCount = (section.match(/^### \d+\. /gm) ?? []).length;
  ok(
    "the section defines at least fifteen rules",
    ruleCount >= 15,
    `${ruleCount} rule heading(s) found. The list is fifteen with number 12's ` +
      `predecessor REMOVED and its number retained.`,
  );

  /*
   * APPEND-ONLY survives; FROZEN does not.
   *
   * The old assertion was `/frozen/i`, and it would have passed on this very
   * file today, because the sentence recording the unfreeze contains the word
   * "FROZEN". That is hard rule 10's comment-satisfied anchor wearing its own
   * clothes: a needle matched inside a sentence asserting the opposite. The
   * property worth keeping is append-only, so that is what is matched.
   */
  ok(
    "the hard-rules section records that numbering is append-only",
    /append-only/i.test(section),
    "without that note the next reader has no reason not to renumber, and a " +
      "renumber silently retargets fourteen files' citations.",
  );
}

console.log(
  `  ${raw.length} characters of ${TRUNCATION_LIMIT}` +
    (at !== -1 ? `, hard-rules pointer at ${at} of ${POINTER_LIMIT}` : ""),
);

/*
 * EXECUTED-COUNT FLOOR.
 *
 * A pass count is not coverage. Every assertion above can stop running without
 * failing: an early return, a guard that silently skips, a loop over a list
 * that became empty. All of those report green, and a green run with nothing in
 * it is indistinguishable from a green run that checked everything.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 10.
 * Never summed. Floored at 9, slack of one: this gate reads one committed file
 * and asserts fixed properties of it, so the count moves only when an assertion
 * is added or removed deliberately.
 */
const MINIMUM_CHECKS = 9;
if (checks < MINIMUM_CHECKS) {
  ok(
    "this gate executed its assertions",
    false,
    `only ${checks} ran, expected at least ${MINIMUM_CHECKS}. A block was SKIPPED ` +
      `rather than failing. Measured: 10.`,
  );
}

if (failures > 0) {
  console.log(`\n${failures} FAILED of ${checks} checks\n`);
  process.exit(1);
}
console.log(`\n${checks} checks, 0 failures\n`);
