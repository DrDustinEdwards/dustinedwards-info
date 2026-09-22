/**
 * Gate over the site mark.
 *
 *   npm run check:logo
 *
 * BOUNDARY: the component's path data against the four SVG fixtures, the fill BINDINGS against a
 * closed set, the icon suite's container shape and one tile pixel, and the mark AS RENDERED into
 * a social card. It does NOT check contrast, and one pixel per raster cannot see an inverted mark.
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
import { assertFloor } from "./lib/floor.mjs";

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
 * Strips block comments first: this file's header names the viewBox and both hexes.
 *
 * @param {string} source
 * @returns {string}
 */
/*
 * WEAK ON PURPOSE, and only for SVG: the shared strong stripper's line rule eats a
 * protocol-relative url and the rest of its line. The TSX and CSS call sites use the shared one,
 * because a .tsx file has real `//` comments this form would leave standing.
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

// The parse counts are asserted before anything is compared: an assertion that can pass by
// reading nothing is not an assertion.

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

// Every fixture is reproduced; viewBoxes[0] is the master, [1] the tight header crop.

const [MASTER_BOX, HEADER_BOX] = component.viewBoxes;

/** @type {Array<{ file: string, purple: string, viewBox: string | undefined }>} */
const FIXTURES = [
  { file: "public/dustin-edwards-logo.svg", purple: LIGHT, viewBox: MASTER_BOX },
  { file: "public/dustin-edwards-logo-dark.svg", purple: DARK, viewBox: MASTER_BOX },
  { file: "public/dustin-edwards-logo-header.svg", purple: LIGHT, viewBox: HEADER_BOX },
  { file: "public/dustin-edwards-logo-header-dark.svg", purple: DARK, viewBox: HEADER_BOX },
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

/*
 * Where the five purple paths actually get their colour: everything above compares GEOMETRY. It
 * names the binding by VALUE and the set is CLOSED, so a second rule setting fill on this class
 * fails rather than quietly winning the cascade. It does NOT resolve the token to a hex.
 */

/** Selector, normalised, to the fill it binds. The COMPLETE set. */
/*
 * ONE BINDING SINCE RULING 118.2. The second was `.site-header .site-logo-brand -> currentColor`
 * and it did two jobs: it stated the header's ink, and it was the only assertion that the mark
 * RENDERS IN THE HEADER AT ALL, which is the omission it caught when a build replaced the header
 * with a wordmark.
 *
 * The header now draws the mark in the logo's own colours, so the rule is gone and the binding
 * with it. THE OMISSION GUARD DOES NOT GO WITH IT, which would be a gate narrowed to fit a change:
 * it moves below, to an assertion that reads the header COMPONENT. That is the property the
 * binding was a proxy for, and it holds whatever the header is painted in next.
 */
const EXPECTED_FILL_BINDINGS = [[".site-logo-brand", "var(--brand)"]];

{
  /* THE WHOLE STYLESHEET SET: the binding and the header mark family live in different files. */
  /*
   * CSS through the SHARED helper: in CSS `//` is never a comment, so the line rule can only
   * remove something real. If a protocol-relative url ever appears, THIS call site goes block-only.
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

  /*
   * THE HEADER MARK IS NOT RE-INKED. Ruling 118.2 lives in the ABSENCE of a rule, and an absence
   * is what drifts back unseen: the three warm paths carry presentation attributes, which any CSS
   * rule outranks, so `.site-header-mark path { fill: x }` would repaint the whole mark without
   * touching `.site-logo-brand` and without moving a character in the set above.
   *
   * A count of zero over an empty scope is what a clean sweep reports. The POSITIVE CONTROL is
   * that the family is found at all: the width rule is `.site-header-mark`, so the selector must
   * appear before zero fill bindings on it mean anything.
   */
  const family = [...css.matchAll(/([^{}]*\.site-header-mark[^{}]*)\{([^}]*)\}/g)].map((m) => ({
    selector: m[1].replace(/\s+/g, " ").trim(),
    fill: /(?:^|[;\s])fill\s*:\s*([^;]+)/.exec(m[2])?.[1].trim() ?? null,
  }));
  const inked = family.filter((r) => r.fill);

  eq("the stylesheets carry .site-header-mark rules to examine", family.length > 0, true);
  eq(
    "no stylesheet binds fill on the header mark" +
      `\n    found: ${inked.map((r) => `${r.selector} -> ${r.fill}`).join(" | ")}`,
    inked.length,
    0,
  );
}

/*
 * THE MARK RENDERS IN THE HEADER, carried over from the fill binding that used to prove it. Read
 * off the COMPONENT rather than off the cascade, so a repaint cannot satisfy it and a removal
 * cannot hide behind one.
 */
{
  const header = stripComments(
    readFileSync(join(ROOT, "app/components/site-header.tsx"), "utf8"),
  );

  eq(
    "the header imports the mark",
    /import\s*\{[^}]*\bSiteLogoHeader\b[^}]*\}\s*from/.test(header),
    true,
  );
  eq("the header renders the mark", /<SiteLogoHeader\b/.test(header), true);
}

/*
 * The rendered icon suite, in this OFFLINE gate rather than with the assets manifest, which is
 * NETWORK tier. TWO FAILURE SHAPES: a dropped size changes the container, a wrong tile changes
 * nothing structural, so each raster gets one colour probe. THE PROBE POINT IS DERIVED: pixel
 * (0, 0) is outside the mark for any padding and outside the inscribed maskable circle.
 */

const checksBeforeIcons = checks;
const icons = JSON.parse(readFileSync(join(ROOT, "scripts", "fixtures", "icon-suite.json"), "utf8"));

// The hand-rolled readers test themselves against a third-party encoder: resvg encodes and
// `raster.mjs` decodes, neither derived from the other.
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

// The ICO container, parsed from the file rather than trusted

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
    // The embedded PNG's IHDR must agree with the directory entry: a container claiming 32px around
    // a 16px image is a corruption the directory alone cannot see.
    const payload = icoPayload(buf, entry);
    eq(`${icons.ico.file} ${entry.size}px payload size agrees with its entry`, pngSize(payload), {
      width: entry.width,
      height: entry.height,
    });
    eq(`${icons.ico.file} ${entry.size}px sits on the tile`, pngCornerPixel(payload), icons.tile);
  }
}

// Every raster: dimensions and one tile probe

// A zero-scope loop asserts nothing. The manifest must actually list rasters
// before any of the assertions inside the loop mean anything.
eq("the icon manifest lists rasters to check", icons.rasters.length >= 5, true);

for (const raster of icons.rasters) {
  const buf = readFileSync(join(ROOT, raster.file));
  eq(`${raster.file} dimensions`, pngSize(buf), { width: raster.width, height: raster.height });
  eq(`${raster.file} sits on the tile`, pngCornerPixel(buf), icons.tile);
}

// favicon.svg is a tile like everything else. The superseded assertion policed a mechanism that
// cannot work: `prefers-color-scheme` reads the OPERATING SYSTEM, while the icon has to survive
// the TAB STRIP's colour. So the query must now be ABSENT. Comments are stripped first.

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

// Executed-count floor for the icon section, MEASURED THROUGH THIS GATE'S OWN PIPELINE. Losing
// the self-test, the raster loop or the ICO block each drops under it and is named as SKIPPED.
const ICON_CHECKS = checks - checksBeforeIcons;
const MINIMUM_ICON_CHECKS = 34;
const iconFloorBreach = assertFloor(
  "check:logo",
  "icon-checks",
  ICON_CHECKS,
  MINIMUM_ICON_CHECKS,
);
if (iconFloorBreach) failures.push(`the icon section: ${iconFloorBreach}`);

/*
 * The mark as it is RENDERED, which CLOSES THE HOLE THIS FILE'S BOUNDARY NAMES: everything above
 * compares TEXT, so a re-fitted or letterboxed embed would move no character here.
 *
 *   ACTUAL    the node build:og puts in the card, through satori and resvg
 *   EXPECTED  the committed fixture's own paths, drawn into the same box by resvg directly
 *
 * The two share a rasteriser and nothing else, and EXPECTED's framing is a plain nested `<svg>`,
 * which makes the aspect-padding in `mark.mjs` falsifiable rather than assumed.
 */

const checksBeforeRender = checks;
{
  const { chrome: CHROME, mark: MARK_ON_CHROME } = resolveTokens(
    { chrome: "--surface-chrome", mark: "--mark-on-chrome" },
    tokenBlock("check:logo", THEME_SELECTORS.light),
    "check:logo",
  );

  const mark = readMark();
  const fixture = readFixture("public/dustin-edwards-logo-header-dark.svg");

  // ACTUAL. The font is required by satori and never used, the mark being paths; the cast is the
  // one build-og.mjs makes, so no caller needs a build step.
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

    // Two blank rasters compare equal and prove nothing. A quarter of the box is a floor.
    const MINIMUM_INK = Math.round((mark.width * mark.height) / 4);
    eq(
      `the expected raster is a picture (${ink} inked of ${mark.width * mark.height})`,
      ink >= MINIMUM_INK,
      true,
    );

    /*
     * TOLERANCE IS ZERO, and zero is the honest number: both sides are the same geometry at the same
     * size through the same resvg in one process. A resvg upgrade moves both identically; only
     * satori changing how it hands the mark over can drift them, which is what this catches.
     */
    eq("the rendered mark differs from the fixture in no pixel", differing, 0);
    eq("the rendered mark's max channel delta", maxDelta, 0);
  }
}

/*
 * Executed-count floor for the render section, MEASURED BY RUNNING IT. The `<image>` parse is a
 * real branch: if satori stops emitting one, that assertion and this both fail, which is correct.
 */
const RENDER_CHECKS = checks - checksBeforeRender;
const MINIMUM_RENDER_CHECKS = 8;
const renderFloorBreach = assertFloor(
  "check:logo",
  "render-checks",
  RENDER_CHECKS,
  MINIMUM_RENDER_CHECKS,
);
if (renderFloorBreach) failures.push(`the render section: ${renderFloorBreach}`);

// Report

/*
 * WHOLE-GATE EXECUTED-COUNT FLOOR: a section floor cannot see another section stopping, so this
 * floors the geometry, the fixtures and the CSS fill bindings. MEASURED BY RUNNING IT, never
 * summed, summing being what went wrong here once already.
 */
const MINIMUM_CHECKS = 134;
const floorBreach = assertFloor("check:logo", "checks", checks, MINIMUM_CHECKS);
if (floorBreach) failures.push(floorBreach);

if (failures.length > 0) {
  console.error(`check:logo FAILED, ${failures.length} of ${checks} checks:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(
  `check:logo ok. ${checks} assertions over ${FIXTURES.length} fixtures, ` +
    `${EXPECTED_FILL_BINDINGS.length} CSS binding${EXPECTED_FILL_BINDINGS.length === 1 ? "" : "s"}, the icon suite ` +
    `(${ICON_CHECKS} of them) and the rendered mark (${RENDER_CHECKS}), 0 failures.`,
);
