/**
 * Gate: every listing axis `listMediaPage` declares actually REACHES SQL.
 *
 *   npm run check:media-axes
 *
 * BOUNDARY: a SOURCE gate. It proves the axis list is derived rather than restated and that the
 * forwarding is a spread rather than a hand-copied key list, but it does NOT run a query, so it
 * sees DROPPED, not MISBUILT.
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
 * Blanks comments and string bodies so brace matching cannot be thrown by a `{` inside a doc
 * comment. Length is PRESERVED, so every offset computed on the stripped text indexes the original.
 *
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
 *
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

/* 1. Derive the axis vocabulary from `listMediaPage`'s own signature. */

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
 * SCOPE NON-EMPTINESS, the vacuity rule: every per-axis assertion below is vacuous if this list is
 * empty. The floor is the count MEASURED when this gate was written, so losing an axis from the
 * signature fails here rather than quietly shrinking the gate.
 */
const AXES_FLOOR = 12;
assertThat(
  AXES.length >= AXES_FLOOR,
  "the derived axis list is non-empty and has not shrunk",
  `parsed ${AXES.length} axes from ${DB_PATH}, expected at least ${AXES_FLOOR}. ` +
    `Parsed: ${AXES.join(", ") || "(none)"}`,
);

console.log(`  ${AXES.length} axes derived from listMediaPage: ${AXES.join(", ")}`);

/* 2. Every declared axis is READ in listMediaPage's body. */

const bodyOpen = dbBare.indexOf("{", paramClose);
const bodyClose = matchBlock(dbBare, bodyOpen, "{", "}");
assertThat(bodyClose !== -1, "listMediaPage's body parses");
const pageBody = dbBare.slice(bodyOpen, bodyClose);

/*
 * THE OPTIONS OBJECT IS FOLLOWED INTO HELPERS, because an axis is just as consumed when the whole
 * object is handed on. Matched by SHAPE rather than by the spelling that exists today: any
 * `name(options)` call pulls that function's body into the searched text.
 */
const helperNames = [...pageBody.matchAll(/(\w+)\(\s*options\s*[,)]/g)].map((m) => m[1]);
let searchable = pageBody;
for (const name of new Set(helperNames)) {
  const at = dbBare.search(new RegExp(`function\\s+${name}\\s*\\(`));
  if (at === -1) continue;
  // Step over the PARAMETER LIST before looking for the body: a helper whose options are typed
  // inline carries a `{` in its own signature, and that type mentions every axis name and reads none
  // of them, so the naive offset accused them anyway.
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

/* 3. listMedia's options type is DERIVED, not restated. */

assertThat(
  /Parameters<\s*typeof\s+listMediaPage\s*>/.test(coreBare),
  "listMedia's options type is derived from listMediaPage",
  `${CORE_PATH} must type its options as Parameters<typeof listMediaPage>[1] ` +
    `rather than restating the keys. A restated list is what dropped six axes.`,
);

/* 4. Every axis actually reaches the call. NAMES the ones that do not. */

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
 * A spread forwards the whole object, so it covers every axis by construction; without one only
 * the keys written out arrive, and the gate NAMES the rest. That is what the plant exercises.
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
 * EXECUTED-COUNT FLOOR, MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it, never summed and
 * never the value first written here from counting the source by eye. The slack is two, so
 * retiring a genuinely dead axis does not fail the floor while dropping a whole BLOCK still does.
 */
const MINIMUM_CHECKS = 22;
const floorBreach = assertFloor("check:media-axes", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) assertThat(false, "this gate executed its assertions", floorBreach);

console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}\n`);
process.exit(failures > 0 ? 1 : 0);
