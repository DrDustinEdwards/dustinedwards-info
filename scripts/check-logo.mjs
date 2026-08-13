/**
 * Gate over the site mark.
 *
 * OBSERVATION BOUNDARY: compares the component's path data against the four SVG
 * fixtures, and the mark's fill BINDINGS in app.css against a closed expected
 * set. It does not rasterise anything and it does not resolve a token to a hex,
 * so a mark bound to the right token name where that token has been given the
 * page colour still passes here. check:contrast owns the resolved values.
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

// --- Report ---------------------------------------------------------------

if (failures.length > 0) {
  console.error(`check:logo FAILED, ${failures.length} of ${checks} checks:\n`);
  for (const f of failures) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(
  `check:logo ok. ${checks} assertions over ${FIXTURES.length} fixtures ` +
    `and ${EXPECTED_FILL_BINDINGS.length} CSS bindings, 0 failures.`,
);
