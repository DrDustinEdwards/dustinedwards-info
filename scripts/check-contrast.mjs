// check:contrast. The palette passes live here; the prefers-contrast, Shiki, built-CSS and opacity passes are scripts/lib/contrast-*.mjs.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { apca, channels } from "../app/lib/contrast.mjs";
import { allSourceCss, resolveToken, THEME_SELECTORS, tokenDeclarations } from "./lib/tokens.mjs";
import {
  APCA_KEYSTONE,
  DECLARED_ELSEWHERE,
  MATRIX,
  NON_PARTICIPATING,
} from "./lib/contrast-matrix.mjs";
import {
  MODES,
  assert,
  assertPair,
  darkAttr,
  darkMedia,
  fail,
  light,
  root,
  tally,
} from "./lib/contrast-model.mjs";
import { checkPrefersContrast } from "./lib/contrast-tiers.mjs";
import { checkShikiThemes } from "./lib/contrast-shiki.mjs";
import { assetDir, checkBuiltCss } from "./lib/contrast-built-css.mjs";
import { checkOpacity } from "./lib/contrast-opacity.mjs";
import { assertFloor } from "@dustinedwards/devkit/node";

/** 0 to 255 per channel, from the same parser the ratios use. */
const bytes = (/** @type {string} */ hex) => channels(hex).map((c) => Math.round(c * 255));

/**
 * A browser composites `color-mix(in srgb, ...)` of two opaque colors as plain linear
 * interpolation of the 8-bit values.
 * @param {string} expr
 * @returns {string|null}
 */
function compositeMix(expr) {
  const m =
    /^color-mix\(\s*in\s+srgb\s*,\s*(#[0-9a-fA-F]{6})\s+([\d.]+)%\s*,\s*(#[0-9a-fA-F]{6})\s*\)$/.exec(
      expr.trim(),
    );
  if (!m) return null;
  const [, a, pct, b] = m;
  const p = Number(pct) / 100;
  const [from, to] = [bytes(a), bytes(b)];
  const out = [0, 1, 2].map((i) => Math.round(from[i] * p + to[i] * (1 - p)));
  return `#${out.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

// Name parity: a token missing from dark keeps its light value there.

{
  const lightNames = Object.keys(light).sort();
  const darkNames = Object.keys(darkAttr).sort();
  const missingInDark = lightNames.filter((n) => !darkNames.includes(n));
  const orphanInDark = darkNames.filter((n) => !lightNames.includes(n));

  assert(
    `light declares ${lightNames.length} tokens the dark block also declares` +
      (missingInDark.length ? `\n    missing from dark: ${missingInDark.join(", ")}` : ""),
    missingInDark.length === 0,
  );
  assert(
    `dark declares no token light does not` +
      (orphanInDark.length ? `\n    orphaned in dark: ${orphanInDark.join(", ")}` : ""),
    orphanInDark.length === 0,
  );

  // The prefers-color-scheme block and the attribute block must agree exactly,
  // or "system" and "dark" would render as two different themes.
  const drift = Object.keys({ ...darkMedia, ...darkAttr }).filter(
    (n) => darkMedia[n] !== darkAttr[n],
  );
  assert(
    `both dark blocks carry identical values` +
      (drift.length ? `\n    differ: ${drift.join(", ")}` : ""),
    drift.length === 0,
  );
}

for (const [mode, block] of MODES) {
  for (const name of Object.keys(block)) {
    const { value } = resolveToken(block, name);
    assert(
      `${mode} ${name} resolves to a literal hex, got: ${value ?? `unresolvable (${block[name]})`}`,
      value !== null && /^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(value),
    );
  }
}

/** @type {Record<string, Record<string, string[]>>} */
const DECLARATIONS = {
  light: tokenDeclarations("light", THEME_SELECTORS.light),
  dark: tokenDeclarations("dark (attribute)", THEME_SELECTORS.dark),
};

for (const [mode] of MODES) {
  const decls = DECLARATIONS[mode];
  for (const [name, values] of Object.entries(decls)) {
    if (values.length === 1) continue;
    assert(`${mode} ${name} is declared at most twice, got ${values.length}`, values.length === 2);
    const [hex, recipe] = values;
    const composite = compositeMix(recipe);
    assert(
      `${mode} ${name}'s second declaration is a color-mix, got: ${recipe}`,
      composite !== null,
    );
    if (composite === null) continue;
    const close =
      /^#[0-9a-fA-F]{6}$/.test(hex) &&
      [0, 1, 2].every((i) => Math.abs(bytes(hex)[i] - bytes(composite)[i]) <= 1);
    assert(
      `${mode} ${name}: the recipe composites to the hex beside it` +
        (close ? "" : `\n    ${recipe}\n    composites to ${composite}, declared ${hex}`),
      close,
    );
  }
}

let apcaWorstDelta = 0;
for (const [text, bg, expected] of APCA_KEYSTONE) {
  const got = apca(String(text), String(bg));
  const delta = Math.abs(got - Number(expected));
  if (delta > apcaWorstDelta) apcaWorstDelta = delta;
  assert(`APCA keystone ${text} on ${bg}: expected ${expected}, got ${got}`, delta < 1e-9);
  // The sign is half the assertion: a magnitude-only check passes an implementation with backwards polarity.
  assert(
    `APCA keystone ${text} on ${bg}: sign should be ${Number(expected) >= 0 ? "positive" : "negative"}`,
    Math.sign(got) === Math.sign(Number(expected)),
  );
}

/** @type {Array<{mode: string, note: string, lc: number, ratio: number}>} */
const advisory = [];

for (const [mode, block] of MODES) {
  for (const [fgName, bgName, min, note] of MATRIX) {
    // RESOLVED, not raw: a series slot is declared as its ramp step, and the
    // ratio that ships is the ramp's hex.
    const fg = resolveToken(block, fgName).value;
    const bg = resolveToken(block, bgName).value;
    if (!fg || !bg) {
      assert(
        `${mode}: ${note} references a token that does not exist (${fgName} on ${bgName})`,
        false,
      );
      continue;
    }
    const ratio = assertPair(`${mode}: ${note}`, fg, bg, min, {
      fgShown: `${fgName} ${fg}`,
      bgShown: `${bgName} ${bg}`,
    });
    advisory.push({ mode, note, lc: apca(fg, bg), ratio });
  }
}

/** Every .css file under `dir`, at any depth. @param {string} dir @returns {string[]} */
function walkCss(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walkCss(p) : name.endsWith(".css") ? [p] : [];
  });
}

// An undeclared `var()` drops silently, and every pass above walks declarations.

{
  /* All source stylesheets, stripped: app.css prose names the Shiki tokens. */
  const code = allSourceCss().replace(/\/\*[\s\S]*?\*\//g, " ");

  const used = new Set([...code.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)].map((m) => m[1]));
  /* Capsomer's sheets declare the family's tokens (--page-max, --ground, --header-h...); the site reads them. */
  const capsomerDir = join(root, "node_modules", "capsomer");
  const capsomerCss = ["tokens", "css", "components"]
    .flatMap((dir) => walkCss(join(capsomerDir, dir)))
    .map((p) => readFileSync(p, "utf8"))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, " ");
  const declaredAnywhere = new Set(
    [...`${code}\n${capsomerCss}`.matchAll(/(?:^|[;{]|\s)(--[A-Za-z0-9_-]+)\s*:/g)].map(
      (m) => m[1],
    ),
  );

  /* Scope, both sides: an empty set on either side fails for the wrong reason. */
  assert(
    `resolution scope: ${used.size} var() token(s) found in the source stylesheets`,
    used.size > 0,
  );
  assert(
    `resolution scope: ${declaredAnywhere.size} token declaration(s) found in the source stylesheets`,
    declaredAnywhere.size > 0,
  );

  /* Enarratio reads each size, spacing and timing with its own fallback: Capsomer's tokens set
     some of them (capsomer/css/enarratio.css) and the rest take the fallback. */
  const bare = new Set([...code.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)\s*\)/g)].map((m) => m[1]));
  const knob = (/** @type {string} */ n) => n.startsWith("--enarratio-") && !bare.has(n);
  const unresolved = [...used]
    .filter((n) => !declaredAnywhere.has(n) && !DECLARED_ELSEWHERE.has(n) && !knob(n))
    .sort();

  assert(
    `every var(--token) used in app.css resolves to a declaration` +
      (unresolved.length ? `\n    used but never declared: ${unresolved.join(", ")}` : ""),
    unresolved.length === 0,
  );

  for (const [name, why] of DECLARED_ELSEWHERE) {
    assert(`exemption ${name} names a token app.css still uses (${why})`, used.has(name));
    assert(`exemption ${name} is still undeclared in app.css`, !declaredAnywhere.has(name));
  }
}

{
  const named = new Set(MATRIX.flatMap(([fg, bg]) => [fg, bg]));

  /* Transitive: a slot declared as `var(--ramp)` measures the ramp step. */
  const inMatrix = new Set(named);
  for (const [, block] of MODES) {
    for (const n of named) {
      for (const step of resolveToken(block, n).chain) inMatrix.add(step);
    }
  }

  const declared = Object.keys(light).filter((n) => n in darkAttr && n in darkMedia);

  // Non-empty only: how many tokens the palette has is a design default, not something to floor.
  assert(
    `participation scope is non-empty: ${declared.length} tokens declared in all three blocks`,
    declared.length > 0,
  );

  const unproven = declared.filter((n) => !inMatrix.has(n) && !NON_PARTICIPATING.has(n));
  assert(
    `every declared token appears in at least one matrix pair` +
      (unproven.length ? `\n    declared but never measured: ${unproven.join(", ")}` : ""),
    unproven.length === 0,
  );

  for (const [name, why] of NON_PARTICIPATING) {
    assert(`exemption ${name} names a token that is still declared`, declared.includes(name));
    assert(`exemption ${name} is still outside the matrix (${why})`, !inMatrix.has(name));
  }
}

// A Worker cannot read a stylesheet, so the swatches come from a committed build product. Re-derived
// here from the sheet as it is now, so a disagreement means the committed file is stale.
{
  const inventory = JSON.parse(readFileSync(join(root, "content", "tokens.json"), "utf8"));
  /** @type {Array<{name: string, light: string, dark: string}>} */
  const rows = inventory.tokens ?? [];

  const expected = Object.keys(light).map((name) => ({
    name,
    light: resolveToken(light, name).value,
    dark: resolveToken(darkAttr, name).value,
  }));

  assert(
    `tokens.json scope is non-empty: ${rows.length} row(s) against ${expected.length} palette tokens`,
    expected.length > 0 && rows.length === expected.length,
  );

  const drift = expected.filter((want, i) => {
    const got = rows[i];
    return !got || got.name !== want.name || got.light !== want.light || got.dark !== want.dark;
  });
  assert(
    `content/tokens.json matches app.css, token for token and in order` +
      (drift.length ? `\n    first disagreement: ${drift[0].name}. Run npm run build:tokens.` : ""),
    drift.length === 0,
  );
}

checkPrefersContrast();
const shiki = checkShikiThemes();
const builtNote = checkBuiltCss();

console.log("check:contrast");
console.log(
  `  tokens        light ${Object.keys(light).length}, dark ${Object.keys(darkAttr).length}`,
);
console.log(`  matrix        ${MATRIX.length} pairs x 2 modes`);
console.log(
  `  APCA impl     ${APCA_KEYSTONE.length}/${APCA_KEYSTONE.length} keystone vectors, worst delta ${apcaWorstDelta.toExponential(2)}`,
);
console.log(`  shiki         ${shiki.checked} token/surface pairs`);
if (shiki.unreachable.length > 0) {
  console.log(
    `  unreachable   ${shiki.unreachable.length} low-contrast VCS token(s), no diff grammar loaded:`,
  );
  for (const d of shiki.unreachable) {
    console.log(`      ${d.split("\n")[0].trim()}`);
  }
}
console.log(`  built CSS     ${builtNote}`);

// APCA is advisory. Lowest first, because the low end is where the two models disagree.
const worst = advisory
  .filter((a) => Math.abs(a.lc) > 0)
  .sort((a, b) => Math.abs(a.lc) - Math.abs(b.lc))
  .slice(0, 8);
// Signed Lc: the sign is the polarity. Ranked by magnitude.
console.log("\n  APCA Lc (SIGNED, advisory only), eight weakest of the matrix:");
for (const a of worst) {
  const lc = `${a.lc >= 0 ? "+" : ""}${a.lc.toFixed(1)}`;
  console.log(
    `    Lc ${lc.padStart(6)}  ${a.ratio.toFixed(2).padStart(5)}:1  ${a.mode.padEnd(5)} ${a.note}`,
  );
}

checkOpacity();

const buildPresent = existsSync(assetDir);

// Floors: counts from running the gate with build/ present and absent, a little under each. Only CI
// reaches the absent branch; measure it by moving build/ aside, never by reasoning.
const MINIMUM_CHECKS = buildPresent ? 594 : 478;
const floorBreach = assertFloor(
  "check:contrast",
  buildPresent ? "checks-build-present" : "checks-build-absent",
  tally.checks,
  MINIMUM_CHECKS,
  `Build ${buildPresent ? "present" : "absent"}. RE-MEASURED 2026-08-28 by RUNNING ` +
    `the gate in BOTH branches, taken by moving build/ aside rather than by reasoning ` +
    `about which assertions skip.` +
    `\n        THE ABSENT-BUILD FLOOR WAS THE STALE ONE, and it was stale because ` +
    `it was DERIVED rather than run: each change added its new assertions to the ` +
    `previous derived figure, and the chain had drifted about ten below the real ` +
    `count. A floor arrived at by arithmetic over a floor arrived at by arithmetic ` +
    `is a number nobody has measured.`,
);
if (floorBreach) fail(floorBreach);

if (tally.failures > 0) {
  console.error(`\n${tally.failures} FAILED of ${tally.checks} checks:\n`);
  for (const f of tally.failed) console.error(`  ${f}`);
  process.exit(1);
}

console.log(`\n${tally.checks} checks, 0 failures`);
