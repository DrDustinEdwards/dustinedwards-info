/**
 * Gate over the site mark.
 *
 * OBSERVATION BOUNDARY: compares the component's path data against the four SVG
 * fixtures, the mark's fill BINDINGS in app.css against a closed expected set,
 * and the shipped icon suite's CONTAINER SHAPE, dimensions and one tile pixel
 * against a ruled manifest. It does not resolve a token to a hex, so a mark
 * bound to the right token name where that token has been given the page colour
 * still passes; check:contrast owns the resolved values. And it reads ONE pixel
 * per raster: an icon whose tile is right and whose mark is upside down,
 * clipped, or drawn in the wrong purple passes every assertion here. Nothing in
 * this repo looks at the shape of a rendered raster. Eyes remain the instrument
 * for that, and the contact sheet is how they get used.
 *
 *   npm run check:logo
 *
 * Proves that app/components/site-logo.tsx, the module the Worker renders,
 * reproduces the ratified SVGs exactly. Pure: no network, no database, no build.
 *
 * WHY THE FOUR public/*.svg FILES ARE KEPT. They are not dead assets and they
 * are not what the site renders; the component is. They are the FIXTURES this
 * gate derives from. Two independent sources argue here, exactly as in
 * check:contrast: the expected path data and fills come from the SVG files, and
 * the actual ones come from the component. Nothing in this script restates a
 * path, so a hand-edited component moves one side of the comparison and fails.
 * Delete the fixtures and the gate has nothing to check against, which is the
 * whole reason they stay under the repo's leanness rule.
 *
 * The component collapses four files into one path list plus a viewBox, because
 * the four differ in exactly two ways: the viewBox, and whether the five purple
 * paths carry the light hex or the dark one. The five purple paths carry no fill
 * at all in the component; they take .site-logo-brand, which is var(--brand),
 * and that token already resolves per theme. This gate is what keeps that
 * collapse honest.
 *
 * v4 AMENDED that last claim and the amendment is asserted at the foot of this
 * file, not just described here. --brand is no longer the only fill the class
 * can take: on the public chrome the mark is bound to --mark-on-chrome, the
 * dark-mode variant, in BOTH themes. The component is untouched, because the
 * override is a CSS binding and not a path.
 *
 * It fails in BOTH directions: a path hand-edited in the component, and an asset
 * regenerated from the spec that the component did not follow.
 *
 * Construction spec: Capsid dustinedwards/logo-spec.md. A variant is a rebuild
 * from those values, never a hand edit of path data.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Resvg } from "@resvg/resvg-js";

import { icoPayload, pngCornerPixel, pngSize, readIco } from "./lib/raster.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The ratified purple, light and dark. Transcribed from logo-spec.md. */
const LIGHT = "#4F2D7F";
const DARK = "#B7A5E0";

/** Marks a component path that takes its fill from var(--brand). */
const TOKEN = "(token)";

/** How many paths the mark has, and how many of them are purple. */
const PATH_COUNT = 8;
const BRAND_PATH_COUNT = 5;

let checks = 0;
/** @type {string[]} */
const failures = [];

/**
 * @param {string} label
 * @param {unknown} actual
 * @param {unknown} expected
 */
function eq(label, actual, expected) {
  checks += 1;
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) failures.push(`${label}\n    expected ${b}\n    actual   ${a}`);
}

/**
 * Strips block comments before anything is located.
 *
 * check:contrast learned this the hard way: its own token block spelled the
 * three theme selectors out in prose, so the parser found the COMMENT first and
 * passed every row for the wrong reason. This file's header names viewBox and
 * both hexes, so the same trap is live here.
 *
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/**
 * @typedef {{ fill: string, d: string }} MarkPath
 */

/**
 * Reads one ratified SVG fixture.
 *
 * @param {string} relative
 * @returns {{ viewBox: string, paths: MarkPath[] }}
 */
function readFixture(relative) {
  const source = stripComments(readFileSync(join(ROOT, relative), "utf8"));
  const viewBox = source.match(/viewBox="([^"]+)"/);
  if (!viewBox) throw new Error(`${relative}: no viewBox`);

  /** @type {MarkPath[]} */
  const paths = [];
  for (const m of source.matchAll(/<path fill="(#[0-9A-Fa-f]{6})" d="([^"]+)"\s*\/>/g)) {
    paths.push({ fill: m[1].toUpperCase(), d: m[2] });
  }
  return { viewBox: viewBox[1], paths };
}

/**
 * Reads the component the Worker actually renders.
 *
 * @returns {{ viewBoxes: string[], paths: MarkPath[] }}
 */
function readComponent() {
  const source = stripComments(
    readFileSync(join(ROOT, "app/components/site-logo.tsx"), "utf8"),
  );

  /** @type {MarkPath[]} */
  const paths = [];
  const pattern =
    /<path (?:className="site-logo-brand"|fill="(#[0-9A-Fa-f]{6})") d="([^"]+)"\s*\/>/g;
  for (const m of source.matchAll(pattern)) {
    const literal = m[1];
    paths.push({ fill: literal ? literal.toUpperCase() : TOKEN, d: m[2] });
  }

  const viewBoxes = [...source.matchAll(/viewBox="([^"]+)"/g)].map((m) => m[1]);
  return { viewBoxes, paths };
}

const component = readComponent();

// --- The component is shaped the way the collapse assumes ------------------
//
// An assertion that can pass by reading nothing is not an assertion, so the
// parse counts are asserted before anything is compared against them.

eq("component parses 8 paths", component.paths.length, PATH_COUNT);
eq("component parses 2 viewBoxes", component.viewBoxes.length, 2);
eq(
  "component drives 5 paths from var(--brand)",
  component.paths.filter((p) => p.fill === TOKEN).length,
  BRAND_PATH_COUNT,
);
eq(
  "component hardcodes no purple",
  component.paths.some((p) => p.fill === LIGHT || p.fill === DARK),
  false,
);

// --- Every fixture is reproduced -------------------------------------------
//
// viewBoxes[0] is the master (square), viewBoxes[1] the tight header crop, in
// the order the components are declared.

const [MASTER_BOX, HEADER_BOX] = component.viewBoxes;

/** @type {Array<{ file: string, purple: string, viewBox: string | undefined }>} */
const FIXTURES = [
  { file: "public/logo.svg", purple: LIGHT, viewBox: MASTER_BOX },
  { file: "public/logo-dark.svg", purple: DARK, viewBox: MASTER_BOX },
  { file: "public/logo-header.svg", purple: LIGHT, viewBox: HEADER_BOX },
  { file: "public/logo-header-dark.svg", purple: DARK, viewBox: HEADER_BOX },
];

for (const { file, purple, viewBox } of FIXTURES) {
  const fixture = readFixture(file);

  eq(`${file} has 8 paths`, fixture.paths.length, PATH_COUNT);
  eq(`${file} viewBox matches the component`, fixture.viewBox, viewBox);
  eq(
    `${file} has 5 purple paths`,
    fixture.paths.filter((p) => p.fill === purple).length,
    BRAND_PATH_COUNT,
  );

  for (let i = 0; i < fixture.paths.length; i += 1) {
    const want = fixture.paths[i];
    const got = component.paths[i];
    if (!got) {
      eq(`${file} path ${i} exists in the component`, false, true);
      continue;
    }
    // The token stands for whichever purple this variant carries.
    eq(`${file} path ${i} fill`, got.fill === TOKEN ? purple : got.fill, want.fill);
    eq(`${file} path ${i} data is verbatim`, got.d, want.d);
  }
}

/* --- Where the five purple paths actually get their colour -----------------
 *
 * NEW at v4, and it closes a hole rather than adding ceremony. Everything above
 * this line compares GEOMETRY: the component's path data and literal fills
 * against the fixtures'. Nothing had ever looked at the CSS BINDING, so this
 * file's own header could go on saying ".site-logo-brand is var(--brand), and
 * that token resolves per theme" for as long as anyone left it there, and it
 * would have kept passing after that stopped being the whole truth.
 *
 * v4 binds the mark ON THE PUBLIC CHROME to --mark-on-chrome in BOTH themes,
 * because on a purple surface the light variant is the legible one. That is a
 * deliberate variant assignment, and this assertion is what makes it
 * deliberate: it names both bindings by VALUE, and the set is CLOSED, so a
 * third rule setting fill on this class fails here rather than quietly becoming
 * the one that wins the cascade.
 *
 * It does NOT resolve the tokens to hexes. check:contrast owns that, and now
 * measures --mark-on-chrome against --surface-chrome in both modes.
 */

/** Selector, normalised, to the fill it binds. The COMPLETE set. */
const EXPECTED_FILL_BINDINGS = [
  [".site-logo-brand", "var(--brand)"],
  [".site-header .site-logo-brand", "var(--mark-on-chrome)"],
];

{
  const css = stripComments(readFileSync(join(ROOT, "app", "app.css"), "utf8"));

  /** @type {Array<[string, string]>} */
  const found = [];
  for (const m of css.matchAll(/([^{}]*\.site-logo-brand[^{}]*)\{([^}]*)\}/g)) {
    const fill = /(?:^|[;\s])fill\s*:\s*([^;]+)/.exec(m[2]);
    if (!fill) continue;
    found.push([m[1].replace(/\s+/g, " ").trim(), fill[1].trim()]);
  }

  // A zero-scope search reports zero violations. The class must be found at all
  // before its bindings mean anything.
  eq("app.css binds fill on .site-logo-brand somewhere", found.length > 0, true);

  eq(
    `app.css has exactly ${EXPECTED_FILL_BINDINGS.length} fill bindings for the mark` +
      `\n    found: ${found.map(([s, f]) => `${s} -> ${f}`).join(" | ")}`,
    found.length,
    EXPECTED_FILL_BINDINGS.length,
  );

  // Both directions. Every expected binding ships, and nothing else does.
  for (const [selector, fill] of EXPECTED_FILL_BINDINGS) {
    const got = found.find(([s]) => s === selector);
    eq(`app.css binds ${selector}`, got?.[1] ?? "(no such rule)", fill);
  }
  for (const [selector, fill] of found) {
    eq(
      `app.css declares no unexpected mark binding: ${selector}`,
      EXPECTED_FILL_BINDINGS.some(([s, f]) => s === selector && f === fill),
      true,
    );
  }
}

/* --- The rendered icon suite ----------------------------------------------
 *
 * WHERE THIS LIVES AND WHY IT IS NOT IN check:media. The ruling puts these
 * assertions with the gate that owns the assets manifest, which is check:media.
 * check:media is NETWORK tier: it lists R2 and queries D1, so folding them
 * there would make the icon suite unchecked on `npm run check`, unchecked
 * inside check:head, and unchecked on a plane. The ruling anticipated that and
 * said to put the section in the offline path and say where. This is where.
 *
 * check:logo is the right offline home on its own merits: the icon suite IS
 * this mark rasterised, and the relationship is the one this file already has
 * with the four SVG fixtures. `scripts/fixtures/icon-suite.json` carries the
 * ruled shape; the files carry what actually shipped; nothing here restates a
 * number. check:media still owns the PATH manifest, and `assets.json` stays
 * paths-only for the reason build-assets.mjs gives.
 *
 * TWO FAILURE SHAPES, and structure alone catches only one. A regenerator that
 * drops a size changes the container; a regenerator pointed at the wrong tile
 * changes nothing structural at all and produces a file that is correct in
 * every respect a header can see. So each raster also gets one colour probe.
 *
 * THE PROBE POINT IS DERIVED, not chosen. Every tile is emitted by
 * build-icons.mjs as a full-bleed rect with the mark CENTRED and fitted by its
 * longer ink dimension inside a padded box, so the mark occupies at most the
 * central (1 - 2p) of the canvas and never comes within p of an edge. Pixel
 * (0, 0) is therefore outside the mark for any padding p > 0. It is also
 * outside the maskable safe circle, which is inscribed: the corner sits at
 * 0.707 of the half-diagonal from centre against the circle's 0.4 radius. So
 * the probe survives any future revision that moves, rescales or redraws the
 * mark, as long as the tile stays a tile. That is the property worth having.
 */

const checksBeforeIcons = checks;
const icons = JSON.parse(readFileSync(join(ROOT, "scripts", "fixtures", "icon-suite.json"), "utf8"));

// --- The hand-rolled readers test themselves, against a third party encoder -
//
// A parser and a fixture built on the same assumptions can agree about a format
// both got wrong. resvg ENCODES the PNG here; scripts/lib/raster.mjs decodes it.
// Two implementations, neither derived from the other.
{
  const KNOWN = "#E0A428"; // an existing palette hex, so it is not a magic value
  const solid = new Resvg(
    `<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4" viewBox="0 0 4 4">` +
      `<rect width="4" height="4" fill="${KNOWN}"/></svg>`,
    { fitTo: { mode: "width", value: 4 } },
  )
    .render()
    .asPng();

  eq("raster self-test: PNG reader returns the encoded colour", pngCornerPixel(solid), KNOWN);
  eq("raster self-test: PNG reader returns the encoded size", pngSize(solid), { width: 4, height: 4 });

  // And an ICO wrapped around that same PNG, so the container reader is tested
  // on a payload whose contents are already known rather than on itself.
  const dir = Buffer.alloc(16);
  dir[0] = 4;
  dir[1] = 4;
  dir.writeUInt16LE(1, 4);
  dir.writeUInt16LE(32, 6);
  dir.writeUInt32LE(solid.length, 8);
  dir.writeUInt32LE(22, 12);
  const head = Buffer.alloc(6);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(1, 4);
  const synthetic = Buffer.concat([head, dir, solid]);

  const parsed = readIco(synthetic);
  eq("raster self-test: ICO reader finds one entry", parsed.length, 1);
  eq("raster self-test: ICO reader reports the entry's size", parsed[0].size, 4);
  eq("raster self-test: ICO reader detects PNG encoding", parsed[0].encoding, "PNG");
  eq(
    "raster self-test: ICO payload round-trips to the same colour",
    pngCornerPixel(icoPayload(synthetic, parsed[0])),
    KNOWN,
  );
}

// --- The ICO container, parsed from the file rather than trusted -----------

{
  const buf = readFileSync(join(ROOT, icons.ico.file));
  const entries = readIco(buf);

  eq(`${icons.ico.file} declares ${icons.ico.sizes.length} images`, entries.length, icons.ico.sizes.length);
  eq(
    `${icons.ico.file} carries exactly the ruled sizes`,
    entries.map((e) => e.size).sort((a, b) => a - b),
    [...icons.ico.sizes].sort((a, b) => a - b),
  );

  for (const entry of entries) {
    eq(`${icons.ico.file} ${entry.size}px is square`, entry.height, entry.width);
    eq(`${icons.ico.file} ${entry.size}px is ${icons.ico.encoding} encoded`, entry.encoding, icons.ico.encoding);
    eq(`${icons.ico.file} ${entry.size}px is ${icons.ico.bpp}bpp`, entry.bpp, icons.ico.bpp);
    // The embedded PNG's own IHDR must agree with the directory entry. A
    // container claiming 32px around a 16px image is a real corruption and the
    // directory alone cannot see it.
    const payload = icoPayload(buf, entry);
    eq(`${icons.ico.file} ${entry.size}px payload size agrees with its entry`, pngSize(payload), {
      width: entry.width,
      height: entry.height,
    });
    eq(`${icons.ico.file} ${entry.size}px sits on the tile`, pngCornerPixel(payload), icons.tile);
  }
}

// --- Every raster: dimensions and one tile probe ---------------------------

// A zero-scope loop asserts nothing. The manifest must actually list rasters
// before any of the assertions inside the loop mean anything.
eq("the icon manifest lists rasters to check", icons.rasters.length >= 5, true);

for (const raster of icons.rasters) {
  const buf = readFileSync(join(ROOT, raster.file));
  eq(`${raster.file} dimensions`, pngSize(buf), { width: raster.width, height: raster.height });
  eq(`${raster.file} sits on the tile`, pngCornerPixel(buf), icons.tile);
}

// --- favicon.svg is a tile, like everything else ---------------------------
//
// SUPERSEDES the assertion that stood here for one day, which required both
// prefers-color-scheme values to be present. That was policing a mechanism that
// could not work: the query reads the OPERATING SYSTEM's colour scheme, while
// the thing the icon has to survive is the TAB STRIP's colour, which comes from
// the browser THEME and is invisible to any media query. A purple Chrome theme
// on a light-scheme OS resolved it to light and put a deep-purple mark on a
// purple strip.
//
// So the assertion is now the opposite in one direction: the query must be
// ABSENT, because its presence would mean the superseded design came back.
// Comments are stripped first, on this file's own established rule, and the
// prose above names both the hex and the query.

{
  const svg = stripComments(readFileSync(join(ROOT, icons.svg.file), "utf8"));
  eq(
    `${icons.svg.file} is a full-bleed ${icons.tile} tile`,
    new RegExp(`<rect[^>]*fill="${icons.tile}"`, "i").test(svg),
    true,
  );
  eq(
    `${icons.svg.file} draws the mark in ${icons.svg.mark}`,
    new RegExp(`fill="${icons.svg.mark}"`, "i").test(svg),
    true,
  );
  eq(
    `${icons.svg.file} carries no prefers-color-scheme query`,
    /prefers-color-scheme/i.test(svg),
    false,
  );
}

// --- Executed-count floor for this section ---------------------------------
//
// MEASURED THROUGH THIS GATE'S OWN PIPELINE, 2026-08-13: the icon section
// executes 37 assertions. Counted by RUNNING it, not by adding up the blocks;
// the first estimate written here was 40 and it was wrong.
//
// Floored at 34, the ~8% margin the other gates use. Not scope-floored: losing
// the self-test block (6), the raster loop (11) or the ICO block (17) each
// drops the count below this and is named as a SKIPPED block rather than
// passing quietly. The SVG block is 3 and sits inside the margin, which is
// deliberate rather than overlooked: its three assertions are explicit and
// would fail on their own before a count could notice they had gone.
const ICON_CHECKS = checks - checksBeforeIcons;
const MINIMUM_ICON_CHECKS = 34;
if (ICON_CHECKS < MINIMUM_ICON_CHECKS) {
  failures.push(
    `the icon section executed only ${ICON_CHECKS} assertions, expected at least ` +
      `${MINIMUM_ICON_CHECKS}. A block was SKIPPED rather than failing. Measured: 37.`,
  );
}

// --- Report ---------------------------------------------------------------

/*
 * WHOLE-GATE EXECUTED-COUNT FLOOR.
 *
 * MINIMUM_ICON_CHECKS above floors the ICON SECTION only, and it shipped with
 * that section by rule. This is the floor for everything else: the geometry,
 * the fixtures and the two CSS fill bindings, none of which had one. A section
 * floor cannot see a different section stopping.
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 123.
 * Never summed, and summing is exactly what went wrong here once already: the
 * icon section was recorded as 40 against a measured 37.
 *
 * Floored at 115, roughly 6 percent: the count is a fixed function of the
 * fixture list and the raster manifest, so it steps when an asset is added.
 */
const MINIMUM_CHECKS = 115;
if (checks < MINIMUM_CHECKS) {
  failures.push(
    `only ${checks} assertions executed, expected at least ${MINIMUM_CHECKS}. ` +
      `A block was SKIPPED rather than failing. Measured: 123.`,
  );
}

if (failures.length > 0) {
  console.error(`check:logo FAILED, ${failures.length} of ${checks} checks:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(
  `check:logo ok. ${checks} assertions over ${FIXTURES.length} fixtures, ` +
    `${EXPECTED_FILL_BINDINGS.length} CSS bindings and the icon suite ` +
    `(${ICON_CHECKS} of them), 0 failures.`,
);
