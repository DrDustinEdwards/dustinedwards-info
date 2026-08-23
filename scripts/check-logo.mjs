/**
 * Gate over the site mark.
 *
 * OBSERVATION BOUNDARY: compares the component's path data against the four SVG
 * fixtures, the mark's fill BINDINGS in app.css against a closed expected set,
 * the shipped icon suite's CONTAINER SHAPE, dimensions and one tile pixel
 * against a ruled manifest, and the mark AS RENDERED into a social card against
 * a rasterisation of the committed fixture, every pixel of it.
 *
 * It does not check CONTRAST, and it resolves exactly one token to a hex,
 * `--mark-on-chrome`, on both sides of that render comparison, so a retuned
 * token moves them together and the comparison stays about shape. A mark bound
 * to the right token name where the token has been given the page colour still
 * passes here; check:contrast owns resolved values.
 *
 * THE ICON SUITE is still read ONE pixel per raster: an icon whose tile is
 * right and whose mark is upside down, clipped or drawn in the wrong purple
 * passes every assertion about it. That gap is now bounded rather than total,
 * because the same mark is compared pixel for pixel in the render section, and
 * the icons are rendered from the same paths; what is unasserted is each icon
 * FILE, not the shape it was cut from. Eyes remain the instrument for the
 * suite, and the contact sheet is how they get used.
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
import { stripComments } from "./lib/strip-comments.mjs";

import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

import { markElement, readMark } from "./lib/mark.mjs";
import { icoPayload, pngCornerPixel, pngSize, readIco } from "./lib/raster.mjs";
import { THEME_SELECTORS, allSourceCss, resolveTokens, tokenBlock } from "./lib/tokens.mjs";

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
/*
 * WEAK ON PURPOSE, and only for SVG. This removes whole-line // comments
 * only. The shared strong stripper in scripts/lib/strip-comments.mjs must
 * NOT be pointed at SVG: its line-comment rule eats a PROTOCOL-RELATIVE url
 * ("//cdn.example.com/x"), whose slashes follow a quote rather than a colon,
 * and takes the rest of the line with it. Measured 2026-08-23 on a fixture:
 * the whole xlink:href value and the attributes after it were destroyed.
 *
 * The audit that prompted the consolidation said the hazard was the strong
 * form eating xmlns:xlink="http://...". It is not; that is a colon and the
 * guard protects it. test/strip-comments.test.mjs asserts the real one.
 *
 * The TSX and CSS call sites below DO use the shared helper: a .tsx file has
 * real // comments and this weak form would leave a trailing one standing.
 */
function stripSvgComments(source) {
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
  const source = stripSvgComments(readFileSync(join(ROOT, relative), "utf8"));
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
  // TSX: the SHARED strong stripper, because a trailing // on a line of code
  // is a real comment here and the SVG form above would leave it standing.
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
  /*
   * THE WHOLE STYLESHEET SET, not app.css alone. Since the 2026-08-21 split the
   * mark's two fill bindings live in DIFFERENT files: `.site-logo-brand` stayed
   * with the tokens in app.css and `.site-header .site-logo-brand` moved to
   * app/styles/public-chrome.css. Reading one path found one of two and failed,
   * which is this section working; reading the set is the fix.
   */
  /*
   * CSS through the SHARED helper. In CSS `//` is never a comment, so the
   * helper's line rule can only ever remove something real; MEASURED across
   * all 17 stylesheets in app/, its output is identical to block-only
   * stripping today. The latent hazard is a protocol-relative url(//host/x),
   * which none of them has. If one ever appears, this call site is the one
   * that should go block-only, not the helper that should change.
   */
  const css = stripComments(allSourceCss());

  /** @type {Array<[string, string]>} */
  const found = [];
  for (const m of css.matchAll(/([^{}]*\.site-logo-brand[^{}]*)\{([^}]*)\}/g)) {
    const fill = /(?:^|[;\s])fill\s*:\s*([^;]+)/.exec(m[2]);
    if (!fill) continue;
    found.push([m[1].replace(/\s+/g, " ").trim(), fill[1].trim()]);
  }

  // A zero-scope search reports zero violations. The class must be found at all
  // before its bindings mean anything.
  eq("the stylesheets bind fill on .site-logo-brand somewhere", found.length > 0, true);

  eq(
    `the stylesheets carry exactly ${EXPECTED_FILL_BINDINGS.length} fill bindings for the mark` +
      `\n    found: ${found.map(([s, f]) => `${s} -> ${f}`).join(" | ")}`,
    found.length,
    EXPECTED_FILL_BINDINGS.length,
  );

  // Both directions. Every expected binding ships, and nothing else does.
  for (const [selector, fill] of EXPECTED_FILL_BINDINGS) {
    const got = found.find(([s]) => s === selector);
    eq(`the stylesheets bind ${selector}`, got?.[1] ?? "(no such rule)", fill);
  }
  for (const [selector, fill] of found) {
    eq(
      `no unexpected mark binding anywhere in the stylesheets: ${selector}`,
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
  const svg = stripSvgComments(readFileSync(join(ROOT, icons.svg.file), "utf8"));
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

/* --- The mark as it is RENDERED, not as it is written ----------------------
 *
 * CLOSES THE HOLE THIS FILE'S OWN BOUNDARY NAMED. Everything above compares
 * TEXT: path data against path data, a fill binding against a closed set, one
 * corner pixel of a raster nobody looks at the middle of. So a change that
 * leaves every string intact and ruins the picture passes: the social card
 * embeds the mark through satori, which URL-encodes it into an `<image>` for
 * resvg to draw, and a satori or resvg release that re-fitted, resampled or
 * letterboxed that embed would move no character in this repo.
 *
 * It was proved by hand once, on 2026-08-14, and a proof that exists in a
 * session transcript is not a gate. This is the same method, standing:
 *
 *   ACTUAL    the node `build:og` puts in the card, from scripts/lib/mark.mjs,
 *             rendered by satori and rasterised by resvg
 *   EXPECTED  the committed fixture's own paths, drawn into the same box by
 *             resvg directly, with no satori in the path
 *
 * The two sides share a rasteriser and nothing else. EXPECTED never reads a
 * stored PNG, never reads anything build:og wrote, and never reads the module
 * under test for geometry: the paths come from `readFixture`, this file's own
 * reader, and the framing is a plain nested `<svg>`, which is what makes the
 * aspect-padding in mark.mjs falsifiable rather than assumed. Remove that
 * padding and resvg letterboxes the embed while the nested svg does not, and
 * this comparison finds it.
 *
 * ONE TOKEN IS RESOLVED HERE, which the boundary above now says. The brand fill
 * on both sides comes from `--mark-on-chrome` in app.css, so a retuned token
 * moves both together and this stays a geometry assertion. It is still an
 * assertion about WHICH token: paint the card from --brand and EXPECTED keeps
 * --mark-on-chrome and the deltas fire.
 *
 * WHAT IT DOES NOT SEE. It renders the mark on its own chrome ground, not a
 * whole card: the card's own layout, its type and its bands are check:head's
 * and the sample renders' business. satori lays this box out at the origin,
 * where the card puts it at x=72 y=34; both are integers, which is the only
 * property the comparison depends on.
 */

const checksBeforeRender = checks;
{
  const { chrome: CHROME, mark: MARK_ON_CHROME } = resolveTokens(
    { chrome: "--surface-chrome", mark: "--mark-on-chrome" },
    tokenBlock("check:logo", THEME_SELECTORS.light),
    "check:logo",
  );

  const mark = readMark();
  const fixture = readFixture("public/logo-header-dark.svg");

  // ACTUAL. The font is required by satori and never used: the mark is paths.
  // The cast is the same one build-og.mjs makes for the same reason: satori's
  // types want a ReactNode, and these are the plain element objects it actually
  // accepts, built without JSX so no caller needs a build step.
  const svg = await satori(
    /** @type {any} */ ({
      type: "div",
      props: {
        style: { width: "100%", height: "100%", display: "flex", background: CHROME },
        children: markElement(),
      },
    }),
    {
      width: mark.width,
      height: mark.height,
      fonts: [
        {
          name: "Inter",
          weight: 400,
          style: "normal",
          data: readFileSync(join(ROOT, "assets", "fonts", "Inter-Regular.ttf")),
        },
      ],
    },
  );

  const image = svg.match(
    /<image x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)" href="([^"]+)"/,
  );

  // A parse that found nothing must fail here rather than skip the block and
  // let the count floor explain it three sections later.
  eq("satori still embeds the mark as one <image>", Boolean(image), true);

  if (image) {
    const inner = decodeURIComponent(image[5].replace(/^data:image\/svg\+xml;utf8,/, ""));
    const embedded = [...inner.matchAll(/<path fill="(#[0-9A-Fa-f]{6})" d="([^"]+)">/g)].map(
      (m) => ({ fill: m[1].toUpperCase(), d: m[2] }),
    );

    // The geometry that reaches the rasteriser, before anything is drawn.
    eq(`the embedded mark carries ${PATH_COUNT} paths`, embedded.length, PATH_COUNT);
    eq(
      "the embedded path data is the fixture's, verbatim",
      embedded.map((p) => p.d),
      fixture.paths.map((p) => p.d),
    );
    eq(
      "the embedded mark is painted in --mark-on-chrome",
      embedded.filter((p) => p.fill === MARK_ON_CHROME.toUpperCase()).length,
      BRAND_PATH_COUNT,
    );
    eq(
      "the embedded warm paths keep the fixture's own fills",
      embedded.filter((p) => p.fill !== MARK_ON_CHROME.toUpperCase()).map((p) => p.fill),
      fixture.paths.filter((p) => p.fill !== DARK).map((p) => p.fill),
    );

    const actual = new Resvg(svg, { fitTo: { mode: "width", value: mark.width } }).render();

    // EXPECTED. The fixture's paths, its OWN viewBox, and the brand purple
    // swapped for the token the card paints with. No satori, no padding.
    const expected = new Resvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${mark.width}" height="${mark.height}" ` +
        `viewBox="0 0 ${mark.width} ${mark.height}">` +
        `<rect width="${mark.width}" height="${mark.height}" fill="${CHROME}"/>` +
        `<svg x="0" y="0" width="${mark.width}" height="${mark.height}" viewBox="${fixture.viewBox}">` +
        fixture.paths
          .map(
            (p) =>
              `<path fill="${p.fill === DARK ? MARK_ON_CHROME : p.fill}" d="${p.d}"/>`,
          )
          .join("") +
        `</svg></svg>`,
      { fitTo: { mode: "width", value: mark.width } },
    ).render();

    eq(
      "both rasters are the same box",
      { width: actual.width, height: actual.height },
      { width: expected.width, height: expected.height },
    );

    let differing = 0;
    let maxDelta = 0;
    let ink = 0;
    const ground = [1, 3, 5].map((i) => parseInt(CHROME.slice(i, i + 2), 16));
    for (let i = 0; i < expected.pixels.length; i += 4) {
      const delta = Math.max(
        Math.abs(expected.pixels[i] - actual.pixels[i]),
        Math.abs(expected.pixels[i + 1] - actual.pixels[i + 1]),
        Math.abs(expected.pixels[i + 2] - actual.pixels[i + 2]),
      );
      if (delta > maxDelta) maxDelta = delta;
      if (delta > 0) differing += 1;
      const fromGround =
        Math.abs(expected.pixels[i] - ground[0]) +
        Math.abs(expected.pixels[i + 1] - ground[1]) +
        Math.abs(expected.pixels[i + 2] - ground[2]);
      if (fromGround > 24) ink += 1;
    }

    // Two blank rasters compare equal and prove nothing, so the expected one
    // has to be a picture before the comparison means anything. A quarter of
    // the box is a floor, not a measurement: the mark inks 1363 of 2880.
    const MINIMUM_INK = Math.round((mark.width * mark.height) / 4);
    eq(
      `the expected raster is a picture (${ink} inked of ${mark.width * mark.height})`,
      ink >= MINIMUM_INK,
      true,
    );

    /*
     * TOLERANCE IS ZERO, and zero is the honest number rather than a strict one.
     *
     * Both sides are the same vector geometry, at the same size, through the
     * same resvg in the same process. Nothing here is a photograph, a
     * compression artefact or a font: there is no source of noise for a
     * tolerance to absorb. A resvg upgrade moves both sides identically, so it
     * cannot drift this apart; only satori changing how it hands the mark over
     * can, which is precisely what this exists to catch.
     *
     * Measured 0 over all 2880 pixels. Both numbers below were taken by
     * breaking the thing on purpose and running this gate: remove the aspect
     * padding from mark.mjs and 348 pixels differ at a max delta of 45; shift
     * the embedded geometry by half a pixel and 408 differ at 77. A tolerance
     * loose enough to feel "safe" would have to be blind to the first of those,
     * which is a defect this repo has already had once.
     */
    eq("the rendered mark differs from the fixture in no pixel", differing, 0);
    eq("the rendered mark's max channel delta", maxDelta, 0);
  }
}

/* --- Executed-count floor for the render section --------------------------
 *
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE by RUNNING it: 9 assertions.
 * Counted, never summed, on this file's own established rule. The whole gate
 * moved from 123 to 132 in the same run, which is the same nine.
 *
 * Floored at 8. The `<image>` parse is a real branch: if satori stops emitting
 * an `<image>` the block runs one assertion and stops, and both this and that
 * assertion fail, which is correct, because the first line to read is the one
 * naming what changed. Every other way for this section to go quiet, an
 * exception swallowed or the block commented out, drops it to 0 or 1.
 */
const RENDER_CHECKS = checks - checksBeforeRender;
const MINIMUM_RENDER_CHECKS = 8;
if (RENDER_CHECKS < MINIMUM_RENDER_CHECKS) {
  failures.push(
    `the render section executed only ${RENDER_CHECKS} assertions, expected at least ` +
      `${MINIMUM_RENDER_CHECKS}. A block was SKIPPED rather than failing. Measured: 9.`,
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
 * MEASURED THROUGH THIS GATE'S OWN PIPELINE on 2026-08-14 by RUNNING it: 132.
 * Never summed, and summing is exactly what went wrong here once already: the
 * icon section was recorded as 40 against a measured 37. It was 123 against a
 * floor of 115 until the render section landed and RAN, adding nine.
 *
 * Floored at 124, roughly 6 percent: the count is a fixed function of the
 * fixture list and the raster manifest, so it steps when an asset is added.
 */
const MINIMUM_CHECKS = 124;
if (checks < MINIMUM_CHECKS) {
  failures.push(
    `only ${checks} assertions executed, expected at least ${MINIMUM_CHECKS}. ` +
      `A block was SKIPPED rather than failing. Measured: 132.`,
  );
}

if (failures.length > 0) {
  console.error(`check:logo FAILED, ${failures.length} of ${checks} checks:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(
  `check:logo ok. ${checks} assertions over ${FIXTURES.length} fixtures, ` +
    `${EXPECTED_FILL_BINDINGS.length} CSS bindings, the icon suite ` +
    `(${ICON_CHECKS} of them) and the rendered mark (${RENDER_CHECKS}), 0 failures.`,
);
