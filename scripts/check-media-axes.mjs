/**
 * Gate: every listing axis `listMediaPage` declares actually REACHES SQL.
 *
 * OBSERVATION BOUNDARY: this is a SOURCE gate. It reads the two modules and
 * proves the axis list is derived rather than restated and that the forwarding
 * is a spread rather than a hand-copied key list. It does NOT run a query, so it
 * cannot see an axis that arrives at `listMediaPage` and is then built into the
 * wrong SQL. It sees DROPPED, not MISBUILT. Proving the SQL itself needs a
 * database and belongs to `check:media --remote` and to verify-live.
 *
 *   npm run check:media-axes
 *
 * Why this exists. Until 2026-08-16 `listMedia`'s options type named six of the
 * twelve axes `listMediaPage` implements. The loader passed all twelve through
 * an object SPREAD, and a spread is exempt from TypeScript's excess-property
 * check, so the six undeclared ones compiled cleanly and were dropped on the
 * floor. `listMediaPage` implemented every one of them correctly; they simply
 * never arrived.
 *
 * MEASURED ON PRODUCTION the day it was found, which is what turned a code
 * reading into a defect: `?sort=size` and `?sort=name&dir=asc` returned rows
 * byte-identical to the default; `?lens=large` returned 24 rows beside a chip
 * reading 8; `?lens=unattached` returned 24 beside a chip reading 53; and
 * `?trash=1` returned 24 NOT-trashed files beside a trash count of 0. The chip
 * counts were right because they are separate queries that bypass the dropping
 * layer, so the page disagreed with itself.
 *
 * THE AXIS LIST IS DERIVED FROM THE SOURCE OF TRUTH, never restated here. A new
 * axis added to `listMediaPage` is covered by this gate the moment it is
 * declared, which is the only version of this check worth having: a hardcoded
 * list would have to be updated by the same person who forgot the forwarding.
 *
 * FAILS CLOSED. An unreadable file, an unparseable signature or a zero-length
 * axis list is a FAILURE, never a skip: an axis list that came back empty would
 * otherwise satisfy every per-axis assertion by having nothing to check.
 */

import { readFileSync, existsSync } from "node:fs";
import { assertFloor } from "./lib/floor.mjs";

const DB_PATH = "app/db/index.ts";
const CORE_PATH = "app/lib/media/core.server.ts";

let checks = 0;
let failures = 0;

/**
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
 * Blanks comments and string bodies so brace matching cannot be thrown by a
 * `{` inside a doc comment. Length is PRESERVED, so every offset computed on
 * the stripped text still indexes the original.
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
      for (let k = i + 1; k < Math.min(j, src.length); k++) if (out[k] !== "\n") out[k] = " ";
      i = j + 1;
      continue;
    }
    i++;
  }
  return out.join("");
}

/**
 * Returns the index just past the block opened at `open`.
 * @param {string} s
 * @param {number} open
 * @param {string} o
 * @param {string} c
 */
function matchBlock(s, open, o, c) {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    if (s[i] === o) depth++;
    else if (s[i] === c) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

console.log("\ncheck:media-axes\n");

for (const path of [DB_PATH, CORE_PATH]) {
  if (!existsSync(path)) {
    console.log(`\n  FAIL  ${path} is missing.`);
    process.exit(1);
  }
}

const dbSrc = readFileSync(DB_PATH, "utf8");
const coreSrc = readFileSync(CORE_PATH, "utf8");
const dbBare = strip(dbSrc);
const coreBare = strip(coreSrc);

/* ------------------------------------------------------------------ *
 * 1. Derive the axis vocabulary from `listMediaPage`'s own signature.
 * ------------------------------------------------------------------ */

const pageDecl = dbBare.indexOf("export async function listMediaPage(");
assertThat(pageDecl !== -1, `${DB_PATH} declares listMediaPage`);
if (pageDecl === -1) {
  console.log(`\n${checks} checks, ${failures} failures\n`);
  process.exit(1);
}

const paramOpen = dbBare.indexOf("(", pageDecl);
const paramClose = matchBlock(dbBare, paramOpen, "(", ")");
assertThat(paramClose !== -1, "listMediaPage's parameter list parses");

const paramText = dbBare.slice(paramOpen, paramClose);
const optOpen = paramOpen + paramText.indexOf("{");
const optClose = matchBlock(dbBare, optOpen, "{", "}");
assertThat(optClose !== -1 && optClose < paramClose, "listMediaPage's options type parses");

const optBody = dbBare.slice(optOpen + 1, optClose);
const AXES = [...optBody.matchAll(/^\s*(\w+)\??:/gm)].map((m) => m[1]);

/*
 * SCOPE NON-EMPTINESS, hard rule 10. Every per-axis assertion below is vacuous
 * if this list is empty, so the list is floored before it is used. The floor is
 * the count MEASURED at the time this gate was written, so losing an axis from
 * the signature fails here rather than quietly shrinking the gate.
 */
const AXES_FLOOR = 12;
assertThat(
  AXES.length >= AXES_FLOOR,
  "the derived axis list is non-empty and has not shrunk",
  `parsed ${AXES.length} axes from ${DB_PATH}, expected at least ${AXES_FLOOR}. ` +
    `Parsed: ${AXES.join(", ") || "(none)"}`,
);

console.log(`  ${AXES.length} axes derived from listMediaPage: ${AXES.join(", ")}`);

/* ------------------------------------------------------------------ *
 * 2. Every declared axis is READ in listMediaPage's body.
 *    Catches an axis added to the signature and never wired to SQL.
 * ------------------------------------------------------------------ */

const bodyOpen = dbBare.indexOf("{", paramClose);
const bodyClose = matchBlock(dbBare, bodyOpen, "{", "}");
assertThat(bodyClose !== -1, "listMediaPage's body parses");
const pageBody = dbBare.slice(bodyOpen, bodyClose);

/*
 * THE OPTIONS OBJECT IS FOLLOWED INTO HELPERS, because an axis is just as
 * consumed when the whole object is handed on. `orderFor(options)` is the live
 * case: `sort` and `dir` are read nowhere in this body and are wired to SQL
 * correctly inside that helper. Matching only `options.<axis>` in the body
 * accused two working axes on this gate's first run.
 *
 * Matched by SHAPE, not by the spelling that exists today: any `name(options)`
 * call in the body pulls that function's body into the searched text.
 */
const helperNames = [...pageBody.matchAll(/(\w+)\(\s*options\s*[,)]/g)].map((m) => m[1]);
let searchable = pageBody;
for (const name of new Set(helperNames)) {
  const at = dbBare.search(new RegExp(`function\\s+${name}\\s*\\(`));
  if (at === -1) continue;
  // Step over the PARAMETER LIST before looking for the body. A helper whose
  // options are typed inline carries a `{` in its own signature, and matching
  // that one hands back the type instead of the code: `orderFor`'s parameter is
  // `{ sort?: string; dir?: string; trashed?: boolean }`, which mentions every
  // axis name and reads none of them, so the naive offset accused them anyway.
  const parenOpen = dbBare.indexOf("(", at);
  const parenClose = matchBlock(dbBare, parenOpen, "(", ")");
  if (parenClose === -1) continue;
  const open = dbBare.indexOf("{", parenClose);
  const close = matchBlock(dbBare, open, "{", "}");
  if (close !== -1) searchable += dbBare.slice(open, close);
}

assertThat(
  searchable.length > pageBody.length,
  "at least one options-taking helper was followed",
  `no \`name(options)\` call was found in listMediaPage's body, so the widened ` +
    `matcher degraded to the body-only scan that produced false accusations.`,
);

for (const axis of AXES) {
  assertThat(
    new RegExp(`options\\.${axis}\\b`).test(searchable),
    `listMediaPage reads options.${axis}`,
    `the axis is declared in the signature but never read in the body or in any ` +
      `helper the options object is passed to, so a caller passing it gets no ` +
      `filtering and no error.`,
  );
}

/* ------------------------------------------------------------------ *
 * 3. listMedia's options type is DERIVED, not restated.
 * ------------------------------------------------------------------ */

assertThat(
  /Parameters<\s*typeof\s+listMediaPage\s*>/.test(coreBare),
  "listMedia's options type is derived from listMediaPage",
  `${CORE_PATH} must type its options as Parameters<typeof listMediaPage>[1] ` +
    `rather than restating the keys. A restated list is what dropped six axes.`,
);

/* ------------------------------------------------------------------ *
 * 4. Every axis actually reaches the call. NAMES the ones that do not.
 * ------------------------------------------------------------------ */

const mediaDecl = coreBare.indexOf("export async function listMedia(");
assertThat(mediaDecl !== -1, `${CORE_PATH} declares listMedia`);

const callAt = coreBare.indexOf("listMediaPage(env,", mediaDecl);
assertThat(callAt !== -1, "listMedia calls listMediaPage(env, ...)");

const argOpen = coreBare.indexOf("{", callAt);
const argClose = matchBlock(coreBare, argOpen, "{", "}");
assertThat(argClose !== -1, "the forwarded options literal parses");

const argBody = coreBare.slice(argOpen + 1, argClose);
const spreads = argBody.includes("...options");
const explicitKeys = [...argBody.matchAll(/^\s*(\w+)\s*:/gm)].map((m) => m[1]);

/*
 * A spread forwards the whole object, so it covers every axis by construction.
 * Without one, only the keys written out arrive, and the gate NAMES the rest.
 * This is the assertion the plant exercises: swap the spread for a hand-copied
 * list and the missing axes are printed by name.
 */
const forwarded = spreads ? new Set(AXES) : new Set(explicitKeys);
const missing = AXES.filter((axis) => !forwarded.has(axis));

assertThat(
  missing.length === 0,
  "every declared axis reaches listMediaPage",
  missing.length
    ? `DROPPED: ${missing.join(", ")}. These are declared on listMediaPage and ` +
        `never forwarded by listMedia, so the URL parameter is parsed, echoed ` +
        `back into the markup, and silently ignored by the query.`
    : undefined,
);

assertThat(
  spreads,
  "listMedia forwards its options by spread",
  `a hand-copied key list is how the six axes were lost. Forward with ` +
    `{ ...options } so a new axis is covered without an edit here.`,
);

console.log(
  `  forwarding: ${spreads ? "spread (covers all axes)" : `explicit keys (${explicitKeys.join(", ")})`}`,
);

/*
 * EXECUTED-COUNT FLOOR.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-16 by RUNNING it: 24
 * with the 12 axes currently declared (12 structural + one read-check per
 * axis). Never summed, and not the 22 first written here from counting the
 * source by eye before the helper-following assertion existed. Floored at 22,
 * a slack of 2, so retiring a genuinely dead axis does not fail the floor while
 * dropping a whole BLOCK still does.
 */
const MINIMUM_CHECKS = 22;
const floorBreach = assertFloor("check:media-axes", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) assertThat(false, "this gate executed its assertions", floorBreach);

console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}\n`);
process.exit(failures > 0 ? 1 : 0);
