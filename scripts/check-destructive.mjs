/**
 * Gate: every DESTRUCTIVE intent is confirmed in the ACTION, not in a handler.
 *
 * OBSERVATION BOUNDARY: this is a SOURCE gate. It reads each route's `action`
 * and proves the confirmation predicate is called inside the branch that
 * handles the intent, before that branch can be reached by a submission. It
 * does NOT run an action, so it cannot see a guard that is present and wrong
 * (a count compared against the number the form carried rather than the one
 * read this request, say). The predicate's own behaviour is held by
 * `test/media-view.test.mjs`; whether the branch reaches it is this gate's job.
 *
 *   npm run check:destructive
 *
 * ## Why this exists
 *
 * An external audit found three destructive paths whose only confirmation ran
 * in a client event handler: bulk post delete used `prompt()` in an `onClick`,
 * single post delete and single media delete used `confirm()` in an `onSubmit`.
 * With scripting off the handler never runs, the form posts, and the action
 * deletes. The ceremony was script-only while the destruction was not.
 *
 * **THE SAME DEFECT HAD ALREADY BEEN FOUND AND FIXED ONCE, on `empty-trash`,
 * and closed WITHOUT SWEEPING FOR SIBLINGS.** That is the whole reason this
 * file is a gate over a CLASS rather than three assertions over three lines. A
 * guard that runs in a handler is not a guard, it is feedback; the gate is
 * whatever the action checks, because the action is the only thing a crawler, a
 * prefetch, a hand-made POST or a reader without JavaScript cannot skip.
 *
 * ## The completeness half, which is the part that keeps working
 *
 * Every intent an action handles must be CLASSIFIED here, destructive or not.
 * A new intent nobody classified FAILS BY NAME rather than defaulting to safe.
 * That is the difference between a gate that catches the next instance and one
 * that documents the last three: without it, a fourth delete added next year
 * would be as invisible as these three were.
 *
 * FAILS CLOSED. An unreadable file, an action whose body will not parse, or an
 * intent vocabulary that comes back empty is a FAILURE, never a skip.
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROUTES = join(root, "app", "routes");

/** The predicate every destructive branch has to reach. */
const PREDICATE = "confirmationSatisfied";

/**
 * DESTRUCTIVE: removes something that cannot be brought back by pressing the
 * inverse control. Each of these must call the predicate inside its own branch.
 */
const DESTRUCTIVE = new Set([
  "admin.posts._index.tsx:bulk-delete",
  "admin.posts.$slug.edit.tsx:delete",
  "admin.media._index.tsx:delete",
  "admin.media._index.tsx:empty-trash",
  /*
   * RECLASSIFIED 2026-08-17, from REVERSIBLE. Both read as maintenance and both
   * destroy records: `rebuild` removes rows whose source object is gone, and
   * `sync-ask` prunes every AI Search record the run did not upload and drops
   * cached answers. Neither can know its own removal count without running, so
   * both confirm on a count of 1 and state the scale at stake instead.
   */
  "admin.media._index.tsx:rebuild",
  "admin.posts._index.tsx:sync-ask",
]);

/**
 * REVERSIBLE, with the reason, because "not destructive" is a judgement and an
 * unexplained entry here is how something destructive gets waved through.
 */
const REVERSIBLE = new Map([
  ["admin.posts._index.tsx:bulk-add-tag", "a tag, undone by remove"],
  ["admin.posts._index.tsx:bulk-remove-tag", "a tag, undone by add"],
  ["admin.posts._index.tsx:regenerate", "rewrites D1 rows from the artifact, idempotent"],
  ["admin.posts._index.tsx:reset-ask-budget", "a counter; see the report, no data is lost"],
  ["admin.posts.$slug.edit.tsx:preview-link", "mints, removes nothing"],
  ["admin.posts.$slug.edit.tsx:revoke-preview-link", "revokes access; fails in the safe direction"],
  ["admin.media._index.tsx:trash", "a D1 flag; the object and its URL are untouched"],
  ["admin.media._index.tsx:restore", "the inverse of trash"],
  ["admin.media._index.tsx:bulk-trash", "trash, in bulk; same flag"],
  ["admin.media._index.tsx:bulk-add-tag", "a tag, undone by remove"],
  ["admin.media._index.tsx:bulk-remove-tag", "a tag, undone by add"],
  ["admin.media._index.tsx:set-tags", "replaces the tag set; retypable"],
  ["admin.media._index.tsx:set-alt", "overwrites alt text; retypable"],
]);

/*
 * NOT IN THE VOCABULARY, AND THAT IS THE BOUNDARY WORTH STATING: `upload-form`
 * is never compared with `intent === "..."`. It is selected by the shared
 * predicate in `app/lib/media/upload-contract.mjs`, so this gate's detector
 * cannot see it, and neither can it see any future intent routed the same way.
 * Adding a destructive path behind a predicate rather than a comparison would
 * hide it from here. Named rather than left to be discovered.
 */

let checks = 0;
let failures = 0;

/**
 * CONDITION FIRST, matching every other gate here. It was label-first for one
 * run, and `check:assertions` caught it twice over: once as helper-signature
 * drift, and once as rule (g), because a label-first call makes argument 1 a
 * string literal and a string literal is always truthy. Every assertion in this
 * file would have passed unconditionally.
 *
 * @param {boolean} ok
 * @param {string} label
 * @param {string} [detail]
 */
function assertThat(ok, label, detail) {
  checks += 1;
  if (ok) return;
  failures += 1;
  console.log(`\n  FAIL  ${label}`);
  if (detail) console.log(`        ${detail}`);
}

/**
 * Blanks comments and string bodies, PRESERVING length so offsets still index.
 * @param {string} src
 */
function strip(src) {
  const out = src.split("");
  let i = 0;
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === "/*") {
      let j = src.indexOf("*/", i + 2);
      if (j === -1) j = src.length;
      for (let k = i; k < Math.min(j + 2, src.length); k++) if (out[k] !== "\n") out[k] = " ";
      i = j + 2;
      continue;
    }
    if (two === "//") {
      let j = src.indexOf("\n", i);
      if (j === -1) j = src.length;
      for (let k = i; k < j; k++) out[k] = " ";
      i = j;
      continue;
    }
    const c = src[i];
    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "\\") { j += 2; continue; }
        if (src[j] === c) break;
        j++;
      }
      // The literal's BODY is blanked but its delimiters are kept, so an
      // `intent === "x"` comparison is still findable on the raw text while
      // brace matching cannot be thrown by a brace inside a string.
      for (let k = i + 1; k < Math.min(j, src.length); k++) if (out[k] !== "\n") out[k] = " ";
      i = j + 1;
      continue;
    }
    i++;
  }
  return out.join("");
}

/** @param {string} s @param {number} open */
function matchBrace(s, open) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === "{") depth++;
    else if (s[i] === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

console.log("\ncheck:destructive\n");

if (!existsSync(ROUTES)) {
  console.log(`\n  FAIL  ${ROUTES} is missing.`);
  process.exit(1);
}

const files = readdirSync(ROUTES).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));
assertThat(
  files.length >= 34,
  "the route directory yielded files to scan",
  `found ${files.length}, floor 34, measured 37 on 2026-08-24; a glob that stops matching would otherwise report zero problems`,
);

/** Every `file:intent` pair the routes actually handle. */
const found = new Set();
let actionFiles = 0;

for (const file of files) {
  const raw = readFileSync(join(ROUTES, file), "utf8");
  if (!/export\s+async\s+function\s+action|export\s+const\s+action/.test(raw)) continue;
  actionFiles += 1;
  const bare = strip(raw);

  // Every intent this module BRANCHES on. The comparison is the vocabulary:
  // a value only reaches a destructive path by being tested for here.
  for (const m of raw.matchAll(/intent\s*===\s*"([^"]+)"/g)) {
    found.add(`${file}:${m[1]}`);
  }

  for (const id of [...found].filter((k) => k.startsWith(`${file}:`))) {
    const intent = id.slice(file.length + 1);
    if (!DESTRUCTIVE.has(id)) continue;

    /*
     * THE SMALLEST BRANCH THAT TESTS THIS INTENT, and the smallness is the
     * point. `bulk-delete` is tested twice in its file: once in a compound
     * condition shared with the two retag intents, and once in its own inner
     * branch. Asserting against the outer one would be satisfied by a guard
     * sitting in the retag path, and asserting against the FILE would be
     * satisfied by any mention anywhere, which is the mistake the media axis
     * gate made this week: an assertion that searches the whole document is
     * satisfied by anything on the page.
     */
    /** @type {{ text: string, size: number } | null} */
    let smallest = null;
    for (const m of raw.matchAll(new RegExp(`intent\\s*===\\s*"${intent}"`, "g"))) {
      /*
       * Offsets come from RAW and are used against BARE. `strip` blanks string
       * BODIES, so the intent literal is unmatchable in the stripped text (the
       * first version of this searched there and found nothing, and every
       * per-intent assertion below went vacuous while the run still printed a
       * count). It preserves LENGTH exactly, so the two index the same bytes,
       * and brace matching has to happen on the stripped text or a brace inside
       * a string throws it.
       */
      const open = bare.indexOf("{", m.index);
      if (open === -1) continue;
      const close = matchBrace(bare, open);
      if (close === -1) continue;
      const size = close - open;
      if (!smallest || size < smallest.size) {
        smallest = { text: raw.slice(open, close), size };
      }
    }

    assertThat(
      smallest !== null,
      `${id}: its branch parses`,
      "no braced branch was found for this intent, so nothing was examined",
    );
    if (!smallest) continue;

    assertThat(
      smallest.text.includes(PREDICATE),
      `${id}: the confirmation is checked in the ACTION`,
      `the branch handling this destructive intent never calls ${PREDICATE}(). ` +
        `If the confirmation moved to an onClick or onSubmit handler, it is gone ` +
        `for every reader without JavaScript while the destruction is not.`,
    );
  }
}

assertThat(
  actionFiles >= 12,
  "route modules exporting an action were found",
  `only ${actionFiles} matched, floor 12, measured 13 on 2026-08-24; the action detector stopped matching`,
);
assertThat(
  found.size >= 17,
  "the intent vocabulary is non-empty",
  `parsed ${found.size} intent(s), floor 17, measured 19 on 2026-08-24; every per-intent assertion above is vacuous if this is empty`,
);

/*
 * COMPLETENESS, BOTH DIRECTIONS.
 *
 * A new intent nobody classified fails by name rather than defaulting to safe,
 * and a classification whose intent no longer exists fails too, so this file
 * cannot quietly accumulate entries for code that is gone.
 */
for (const id of found) {
  assertThat(
    DESTRUCTIVE.has(id) || REVERSIBLE.has(id),
    `${id} is classified`,
    `a new intent is handled by an action and nobody has said whether it ` +
      `destroys anything. Add it to DESTRUCTIVE (and guard it) or to ` +
      `REVERSIBLE with the reason.`,
  );
}
for (const id of [...DESTRUCTIVE, ...REVERSIBLE.keys()]) {
  assertThat(
    found.has(id),
    `${id} still exists`,
    "classified here but no action branches on it; the entry is stale",
  );
}

console.log(`  ${actionFiles} action module(s), ${found.size} intent(s), ${DESTRUCTIVE.size} destructive`);

/*
 * EXECUTED-COUNT FLOOR.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-16 by RUNNING it: 53,
 * over 12 action modules and 19 intents, 6 of them destructive. Never summed, and not the 50 first
 * written here from counting the source by eye, which failed the gate on its
 * own first green run. Floored at 49, slack 4, so retiring one intent does not
 * fail the floor while dropping a whole BLOCK still does.
 */
const MINIMUM_CHECKS = 49;
if (checks < MINIMUM_CHECKS) {
  assertThat(
    false,
    "this gate executed its assertions",
    `only ${checks} ran, expected at least ${MINIMUM_CHECKS}. A block was ` +
      `SKIPPED rather than failing. Measured: 53.`,
  );
}

console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}\n`);
process.exit(failures > 0 ? 1 : 0);
