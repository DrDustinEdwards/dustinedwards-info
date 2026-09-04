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
  /*
   * BOTH WEBMENTION REMOVALS, 2026-09-04, and they are the first destructive
   * intents in this repo with NO RECOVERY PATH AT ALL.
   *
   * Every other entry above removes something that a rebuild, a sync or the
   * repository can produce again: media rows are derived from R2, the Ask
   * index from the corpus, a post's file from git. A webmention row came from
   * a stranger's POST, converges toward nothing, and hard rule 18's "repair it
   * through its derivation" has no meaning for it. Deleted is gone.
   */
  "admin.mentions.tsx:delete",
  "admin.mentions.tsx:sweep",
]);

/**
 * REVERSIBLE, with the reason, because "not destructive" is a judgement and an
 * unexplained entry here is how something destructive gets waved through.
 */
const REVERSIBLE = new Map([
  ["admin.posts._index.tsx:bulk-add-tag", "a tag, undone by remove"],
  ["admin.posts._index.tsx:bulk-remove-tag", "a tag, undone by add"],
  [
    "admin.posts._index.tsx:duplicate",
    "creates a new draft; removes and overwrites nothing, and savePost refuses a slug that exists",
  ],
  [
    "admin.posts._index.tsx:unpublish",
    "sets draft:true, undone by republish; the file, its history and first_published all stand",
  ],
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
  [
    "admin.mentions.tsx:approve",
    "sets a decision on a verified mention, undone by reject: the DB layer's " +
      "decidable set holds approved and rejected alongside pending precisely so " +
      "the pair is a two-way door, and no column is removed either way",
  ],
  ["admin.mentions.tsx:reject", "the inverse of approve, on the same two-way door"],
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
 * THE BACKUP BUCKET IS WRITE-AND-READ ONLY. Ruled 2026-09-01, vol 13.
 *
 * `MEDIA_BACKUP` exists so that the site's own code deleting a media object
 * cannot lose the bytes. That is worth exactly as much as the guarantee that
 * NOTHING here ever deletes from it, and a guarantee held only by prose is the
 * shape this repo keeps paying for. Pruning the mirror is a human act, by hand.
 *
 * WHOLE-SOURCE, not routes: the danger is not a form intent, it is any line
 * anywhere that reaches the binding with a delete. `app/`, `workers/` and
 * `scripts/` are all swept.
 *
 * COMMENTS ARE STRIPPED FIRST, and that is load bearing rather than tidy. Every
 * file that touches this binding carries a comment SAYING it never deletes from
 * it, and several of those sentences contain both the binding name and the word
 * delete. Matching raw source would fail on the documentation of the rule.
 */
{
  /** @param {string} dir @returns {string[]} */
  const walk = (dir) => {
    if (!existsSync(dir)) return [];
    /** @type {string[]} */
    const out = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "dist") continue;
        out.push(...walk(full));
      } else if (/\.(ts|tsx|mjs|js)$/.test(entry.name)) {
        out.push(full);
      }
    }
    return out;
  };

  /**
   * Does this stripped source delete from the backup binding?
   *
   * The window is what makes it an anchored needle rather than a file-wide
   * co-occurrence: a file may legitimately name `MEDIA_BACKUP` and, far away,
   * delete from something else.
   *
   * @param {string} stripped
   * @returns {string[]} offending excerpts
   */
  const backupDeletes = (stripped) => {
    /** @type {string[]} */
    const hits = [];
    const needle = /MEDIA_BACKUP/g;
    for (let m = needle.exec(stripped); m; m = needle.exec(stripped)) {
      const window = stripped.slice(m.index, m.index + 120);
      if (/\.\s*delete\s*\(/.test(window)) hits.push(window.replace(/\s+/g, " ").slice(0, 100));
    }
    return hits;
  };

  /*
   * THE DISCRIMINATION CONTROL, run BEFORE the sweep.
   *
   * A matcher that cannot detect the violation agrees with every file it reads,
   * and a clean sweep by a blind needle is indistinguishable from a clean
   * repository. So the needle is first shown to FIRE on a known-bad string and
   * to stay silent on the two shapes that must not trip it.
   */
  assertThat(
    backupDeletes("await env.MEDIA_BACKUP.delete(key);").length === 1,
    "the backup-delete needle detects a real delete",
    "it matched nothing, so the sweep below would pass over a genuine violation",
  );
  assertThat(
    backupDeletes("await env.MEDIA_BACKUP.put(key, body);").length === 0,
    "the backup-delete needle ignores a put",
    "a needle that fires on any use of the binding would be unusable",
  );
  assertThat(
    backupDeletes("await env.MEDIA.delete(key); const b = env.MEDIA_BACKUP;").length === 0,
    "the backup-delete needle does not fire on a delete from MEDIA",
    "deleting a media object is legitimate; only the mirror is protected",
  );

  /*
   * THIS FILE IS EXCLUDED FROM ITS OWN SWEEP, and the exclusion is named rather
   * than a glob, so it can never widen.
   *
   * The discrimination control above is a STRING LITERAL containing exactly the
   * violation being hunted, which is the point of it. Sweeping this file finds
   * that literal and reports the gate as the offender. Measured on the first
   * run of this block: one violation, in `check-destructive.mjs`, at the
   * control. The alternative was to write the control obfuscated so it would
   * not match itself, which would mean the control no longer tests the needle
   * that actually runs.
   */
  const SELF = join(root, "scripts", "check-destructive.mjs");
  const sources = [
    ...walk(join(root, "app")),
    ...walk(join(root, "workers")),
    ...walk(join(root, "scripts")),
  ].filter((file) => file !== SELF);

  /*
   * SCOPE FLOOR. A walk that returned nothing reports what a clean sweep
   * reports, and this whole block would then be a comment.
   */
  assertThat(
    sources.length >= 100,
    "the backup sweep read a non-empty source tree",
    `only ${sources.length} file(s) were read, so a clean result means nothing`,
  );

  let mentioning = 0;
  /** @type {string[]} */
  const violations = [];
  for (const file of sources) {
    const stripped = strip(readFileSync(file, "utf8"));
    if (!stripped.includes("MEDIA_BACKUP")) continue;
    mentioning += 1;
    for (const hit of backupDeletes(stripped)) {
      violations.push(`${file.slice(root.length + 1)}: ${hit}`);
    }
  }

  /*
   * AND A FLOOR ON THE SWEEP'S SUBJECT. Zero files naming the binding would
   * mean the mirror had been removed or renamed, and every assertion above
   * would then be true of nothing.
   */
  assertThat(
    mentioning > 0,
    "at least one source file reaches the MEDIA_BACKUP binding",
    "no file names it, so either the mirror is gone or this gate is watching a " +
      "binding that no longer exists",
  );

  assertThat(
    violations.length === 0,
    "no source deletes from the backup bucket",
    `${violations.length} delete(s) against MEDIA_BACKUP: ${violations.join(" | ")}`,
  );

  console.log(
    `  backup bucket: ${sources.length} source file(s) swept, ${mentioning} reach ` +
      `MEDIA_BACKUP, ${violations.length} delete from it`,
  );
}

/*
 * EXECUTED-COUNT FLOOR.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-16 by RUNNING it: 53,
 * over 12 action modules and 19 intents, 6 of them destructive. Never summed, and not the 50 first
 * written here from counting the source by eye, which failed the gate on its
 * own first green run. Floored at 49, slack 4, so retiring one intent does not
 * fail the floor while dropping a whole BLOCK still does.
 *
 * RE-MEASURED 2026-09-01, again by running it: 59, over 13 action modules and
 * the same 19 intents, plus the six assertions the MEDIA_BACKUP block adds. The
 * FLOOR IS DELIBERATELY NOT RAISED to 55: its job is to catch a whole block
 * being skipped, and the slack is what lets an intent be retired without a
 * second edit here. Raising it on every addition would make it a count of the
 * checks rather than a floor under them.
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
