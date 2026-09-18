/**
 * Gate: every `@font-face` DECLARATION must be true of the BINARY it names.
 *
 *   npm run check:fonts [-- --update]
 *
 * BOUNDARY: it reads DISK, never the wire. Per block that names a file it compares the declared
 * weight range, style, stretch and family against the file's own tables, and pins each binary by
 * digest so a re-subset with its axes intact cannot pass.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as fontkit from "fontkit";

import { assertFloor } from "./lib/floor.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(root, "scripts", "fixtures", "font-baseline.json");
const update = process.argv.includes("--update");

let failures = 0;
let checks = 0;

/**
 * The first argument is named `ok` as six other gates spell it, `check:invariants` section 17
 * refusing two argument orders for one name: a copied assertion would put a truthy STRING in the
 * condition slot and still increment the count.
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

console.log("\ncheck:fonts\n");

/**
 * The stylesheets that may declare a face. `app/app.css` holds the site's own,
 * `app/styles/*.css` holds the generated katex sheet; both are read, so a face
 * added to any sheet is in scope without this list being edited.
 */
const SHEETS = [
  join(root, "app", "app.css"),
  ...readdirSync(join(root, "app", "styles"))
    .filter((f) => f.endsWith(".css"))
    .map((f) => join(root, "app", "styles", f)),
];

/**
 * Comments are stripped BEFORE matching, hard rule 10: prose about a face is not a face.
 *
 * @param {string} css
 * @returns {string}
 */
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** @type {{sheet: string, family: string, weight: string|null, style: string|null, stretch: string|null, file: string|null, raw: string}[]} */
const blocks = [];
/** @type {{sheet: string, axis: string, value: number, family: string|null, level?: string}[]} */
const variationRequests = [];

for (const sheet of SHEETS) {
  const css = stripComments(readFileSync(sheet, "utf8"));

  for (const m of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const body = m[1];
    /** @param {string} prop @returns {string|null} */
    const pick = (prop) => body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, "i"))?.[1].trim() ?? null;
    const family = (pick("font-family") ?? "").replace(/^['"]|['"]$/g, "");
    // The FIRST url() is the file this block is about. A block with none is a
    // local()-only face and is skipped, counted, below.
    const url = body.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/)?.[1] ?? null;
    blocks.push({
      sheet,
      family,
      weight: pick("font-weight"),
      style: pick("font-style"),
      stretch: pick("font-stretch"),
      file: url ? resolve(dirname(sheet), url) : null,
      raw: body,
    });
  }

  // Axis requests anywhere in the sheet, which is what catches a type scale asking for an optical
  // size the file cannot serve.
  for (const m of css.matchAll(/font-variation-settings\s*:\s*([^;}]+)/gi)) {
    for (const a of m[1].matchAll(/['"]([a-zA-Z]{4})['"]\s*(-?[\d.]+)/g)) {
      variationRequests.push({ sheet, axis: a[1], value: Number(a[2]), family: null });
    }
  }

  /*
   * AND THE TYPE LEVELS, which spell `font-variation-settings` nowhere: the scale carries a level's
   * axes and its family in separate tokens, so the regex above sees neither. THE FAMILY IS CARRIED
   * WITH THE REQUEST: two shipped families carry `opsz` on different ranges, so checking against
   * every carrier fails a legitimate value and checking against none lets a level be clamped.
   */
  const levelFamilies = new Map();
  for (const m of css.matchAll(/--t-([a-z0-9-]+)-family\s*:\s*([^;]+);/gi)) {
    levelFamilies.set(m[1], m[2].trim());
  }
  for (const m of css.matchAll(/--t-([a-z0-9-]+)-vars\s*:\s*([^;]+);/gi)) {
    const [, level, value] = m;
    // A VARIANT INHERITS ITS LEVEL'S FAMILY: a heavier spelling of a level is not a ninth level, so a
    // family token of its own would be a second owner. The base is the level name minus its last
    // segment, and only when no exact token exists. The variant is NOT spelled in full here: section
    // 31's token scan reads `scripts/` without stripping comments, so naming it would mark it
    // referenced and then fail it for being referenced.
    const base = level.includes("-") ? level.slice(0, level.lastIndexOf("-")) : null;
    const family =
      levelFamilies.get(level) ?? (base ? (levelFamilies.get(base) ?? null) : null);
    for (const a of value.matchAll(/['"]([a-zA-Z]{4})['"]\s*(-?[\d.]+)/g)) {
      variationRequests.push({ sheet, axis: a[1], value: Number(a[2]), family, level });
    }
  }
}

/*
 * SCOPE, ASSERTED BEFORE ANY PER-BLOCK ASSERTION: a regex that stopped matching iterates nothing
 * and every loop reports a clean sweep. Low bars, existing to prove the parse happened at all.
 */
/*
 * Split rather than filtered, so `file` is a string in the half that has one: filtering leaves
 * the type nullable and every use needs a cast, which tells the typechecker to stop looking at
 * the field this gate cares about. The annotation below is a DOUBLE-STAR block on purpose:
 * written `/*` the `@type` is not JSDoc, the array infers `any[]`, and nothing is checked.
 */
/** @type {{sheet: string, family: string, weight: string|null, style: string|null, stretch: string|null, file: string, raw: string}[]} */
const withFile = [];
/** @type {typeof blocks} */
const withoutFile = [];
for (const b of blocks) {
  if (b.file) withFile.push({ ...b, file: b.file });
  else withoutFile.push(b);
}
assertThat(blocks.length >= 20, "the sheets parsed into @font-face blocks", `${blocks.length} parsed, expected at least 20`);
assertThat(withFile.length >= 20, "blocks naming a file were found", `${withFile.length} name a file`);

/*
 * The local()-only faces are SKIPPED EXPLICITLY and counted, so a future file-backed block cannot
 * fall into the skip path unnoticed. Exact rather than a count: WHICH two is the assertion.
 */
const FILELESS = ["Inter Fallback", "Source Serif 4 Web Fallback"];
{
  const got = withoutFile.map((b) => b.family).sort();
  assertThat(
    got.length === FILELESS.length && got.every((f, i) => f === [...FILELESS].sort()[i]),
    `the local()-only faces are exactly the ${FILELESS.length} metric-adjusted fallbacks`,
    `skipped [${got.join(", ")}], expected [${[...FILELESS].sort().join(", ")}]. A new fileless face must be ` +
      `named here, or it is a face this gate silently does not check.`,
  );
}

/** Every font binary that ships, so the reverse direction can be asserted. */
const shipped = [];
for (const dir of [join(root, "app", "fonts"), join(root, "app", "fonts", "katex")]) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (f.isFile() && /\.(woff2?|ttf|otf)$/.test(f.name)) shipped.push(join(dir, f.name));
  }
}

const referenced = new Set(withFile.map((b) => b.file));
for (const file of shipped) {
  assertThat(
    referenced.has(file),
    `${relative(root, file)} is referenced by an @font-face block`,
    `the file ships and no declaration names it, so nothing asserts what it is`,
  );
}

/** Cache: one parse per file however many blocks name it. */
/** @type {Map<string, import("fontkit").Font>} */
const parsed = new Map();
/** @param {string} file */
function fontFor(file) {
  const hit = parsed.get(file);
  if (hit) return hit;
  const font = /** @type {import("fontkit").Font} */ (fontkit.openSync(file));
  parsed.set(file, font);
  return font;
}

// NAMESPACED FAMILIES are the one case where the declared family and the binary's name table
// legitimately differ: the serif is namespaced so a reader with the retail family installed
// cannot put a different file in the resolution path. This map keeps that from being a licence,
// the declaration still being pinned to ONE binary family. It polices itself both directions.
/** @type {Map<string, string>} declared family -> the family its file must report */
const NAMESPACED = new Map([["Source Serif 4 Web", "Source Serif 4"]]);

for (const b of withFile) {
  const rel = relative(root, b.file);
  if (!existsSync(b.file)) {
    assertThat(false, `${rel} exists`, `declared in ${relative(root, b.sheet)} and not on disk`);
    continue;
  }

  const font = fontFor(b.file);
  const axes = font.variationAxes ?? {};

  // The family the file calls itself. KaTeX's name table carries the family
  // without the style suffix, which is what the CSS declares too.
  //
  // A namespaced declaration is still pinned to one binary family; see the map.
  const expected = NAMESPACED.get(b.family) ?? b.family;
  assertThat(
    font.familyName === expected || font.postscriptName?.startsWith(expected.replace(/\s+/g, "")),
    `${rel} is the family the declaration names`,
    `css says "${b.family}"${
      expected === b.family ? "" : ` (namespaced, and must be "${expected}")`
    }, the file's name table says "${font.familyName}" (${font.postscriptName})`,
  );

  const weight = (b.weight ?? "").trim();
  const range = weight.match(/^(\d+)\s+(\d+)$/);
  if (range) {
    const [, lo, hi] = range;
    assertThat(
      Boolean(axes.wght),
      `${rel} carries a wght axis, as its declared range promises`,
      `css declares "font-weight: ${weight}" and the file has axes [${Object.keys(axes).join(", ") || "none"}]`,
    );
    if (axes.wght) {
      assertThat(
        axes.wght.min === Number(lo) && axes.wght.max === Number(hi),
        `${rel} wght range matches the declaration exactly`,
        `css declares ${lo} ${hi}, the file's wght is ${axes.wght.min} to ${axes.wght.max}. A narrower file means ` +
          `weights the stylesheet asks for are synthesised rather than drawn.`,
      );
    }
  } else if (/^\d+$/.test(weight)) {
    assertThat(
      !axes.wght,
      `${rel} is static, as its single declared weight implies`,
      `css declares "font-weight: ${weight}" but the file has a wght axis; declare the range instead`,
    );
    const us = font["OS/2"]?.usWeightClass;
    assertThat(
      us === Number(weight),
      `${rel} usWeightClass matches the declared weight`,
      `css declares ${weight}, the file's OS/2.usWeightClass is ${us}`,
    );
  }

  if (b.style === "italic" || b.style === "normal") {
    const italicByAngle = font.italicAngle !== 0;
    const italicByName = /italic|oblique/i.test(font.subfamilyName ?? "") || /italic/i.test(font.postscriptName ?? "");
    const isItalic = italicByAngle || italicByName || Boolean(axes.ital) || Boolean(axes.slnt);
    assertThat(
      (b.style === "italic") === isItalic,
      `${rel} slant matches the declared font-style`,
      `css declares "${b.style}", the file reports italicAngle=${font.italicAngle} subfamily="${font.subfamilyName}"`,
    );
  }

  const stretch = (b.stretch ?? "").trim().match(/^([\d.]+)%\s+([\d.]+)%$/);
  if (stretch) {
    assertThat(
      axes.wdth !== undefined && axes.wdth.min === Number(stretch[1]) && axes.wdth.max === Number(stretch[2]),
      `${rel} wdth range matches the declared font-stretch`,
      `css declares ${stretch[1]}% ${stretch[2]}%, the file's wdth is ${axes.wdth ? `${axes.wdth.min} to ${axes.wdth.max}` : "absent"}`,
    );
  }
}

// The namespace map polices itself: an entry naming a family no sheet declares
// any more is a widened comparison nobody would notice, and an entry whose
// declared and binary names are equal is not a namespace at all.
for (const [declared, binary] of NAMESPACED) {
  assertThat(
    withFile.some((b) => b.family === declared),
    `namespace entry "${declared}" names a family a sheet still declares`,
    `no @font-face declares it; the entry is dead and should be removed`,
  );
  assertThat(
    declared !== binary,
    `namespace entry "${declared}" actually renames something`,
    `declared and binary family are identical, so the entry does nothing`,
  );
}

/*
 * AXIS REQUESTS FROM THE SHEETS, IN RANGE: a browser clamps silently, so the level renders at
 * the wrong optical size with nothing reporting it.
 */
/* A ZERO-SCOPE SEARCH REPORTS A CLEAN SWEEP. The floor proves the parse happened at all. */
assertThat(
  variationRequests.length >= 16,
  "axis requests were found in the sheets",
  `${variationRequests.length} found; a regex that stopped matching would iterate nothing and every ` +
    `assertion below would report a clean sweep`,
);

/**
 * `--t-*-family` holds `var(--font-sans)` or `var(--font-serif)`. Resolve the
 * indirection to the first family in that stack, which is the face the level
 * actually sets in.
 *
 * @param {string|null} value
 * @returns {string|null}
 */
function resolveFamily(value) {
  if (!value) return null;
  let v = value.trim();
  for (let i = 0; i < 4 && v.startsWith("var("); i += 1) {
    const name = v.slice(4, v.indexOf(")")).trim();
    const sheet = stripComments(readFileSync(join(root, "app", "app.css"), "utf8"));
    const decl = new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(sheet);
    if (!decl) return null;
    v = decl[1].trim();
  }
  return v.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}

for (const req of variationRequests) {
  const faces = withFile.filter((b) => existsSync(b.file)).map((b) => ({ b, axes: fontFor(b.file).variationAxes ?? {} }));

  const where = req.level ? `--t-${req.level}-vars` : relative(root, req.sheet);

  // A level whose family cannot be resolved would be checked against nothing,
  // which is the zero-scope class: it would pass by measuring no face at all.
  const wanted = resolveFamily(req.family);
  if (req.level) {
    assertThat(
      wanted !== null,
      `${where} resolves to a family this gate can check`,
      `--t-${req.level}-family is "${req.family}" and no declaration resolves it, so this level's ` +
        `"${req.axis}" ${req.value} would be checked against no face at all`,
    );
  }

  // A level names its own family, so it is checked against THAT face and no
  // other. A bare `font-variation-settings` names none, so it keeps the older
  // behaviour of being checked against every carrier of the axis.
  const carriers = faces.filter(
    (f) => f.axes[req.axis] && (wanted === null || f.b.family === wanted),
  );
  assertThat(
    carriers.length > 0,
    `the "${req.axis}" axis requested in ${where} exists in a shipped face` +
      (wanted ? ` of "${wanted}"` : ""),
    wanted
      ? `no shipped face of "${wanted}" carries "${req.axis}"; the declaration is inert`
      : `no shipped font carries "${req.axis}"; the declaration is inert`,
  );
  for (const c of carriers) {
    const a = c.axes[req.axis];
    if (!a) continue;
    assertThat(
      req.value >= a.min && req.value <= a.max,
      `"${req.axis}" ${req.value} from ${where} is in range for ${relative(root, c.b.file)}`,
      `the file supports ${a.min} to ${a.max}; a browser CLAMPS ${req.value} silently, so the level renders at the ` +
        `wrong optical size and nothing reports it`,
    );
  }
}

/*
 * THE SATORI FACES, which are in no stylesheet: the cards are drawn from static TTFs that are the
 * same typeface as the served woff2 and a DIFFERENT BUILD of it, and nothing reconciled them.
 * THE SERVED woff2 BUILD IS CANONICAL, cards being a secondary artifact of that identity, and
 * THE TWO CANNOT CHEAPLY BE ALIGNED, satori not reading woff2. So the difference STANDS, and what
 * was refused with it was an instancing pipeline: a dependency, a build step and a gate.
 */
const OG_FACES = [
  { file: join(root, "assets", "fonts", "Inter-Regular.ttf"), weight: 400 },
  { file: join(root, "assets", "fonts", "Inter-Bold.ttf"), weight: 700 },
];
/*
 * THE FAMILY THE SITE SERVES, read from the `--font-sans` token rather than the FIRST
 * `@font-face` block, which was true only while one family lived there: a second made that a
 * statement about source ORDER. The token is an independent declaration and the right source
 * anyway, the cards drawing body-weight text.
 */
const servedFamily = (() => {
  const sheet = stripComments(readFileSync(join(root, "app", "app.css"), "utf8"));
  const decl = /--font-sans:\s*([^;]+);/.exec(sheet);
  assertThat(Boolean(decl), "app.css declares --font-sans", "the served family cannot be read without it");
  if (!decl) return null;
  return decl[1].trim().split(",")[0].trim().replace(/^['"]|['"]$/g, "");
})();

assertThat(
  withFile.some(
    (b) => b.family === servedFamily && b.file.includes(join("app", "fonts")) && !b.file.includes("katex"),
  ),
  `--font-sans names a family app/fonts/ actually serves ("${servedFamily}")`,
  `the stack's first family is not backed by any self-hosted face, so the cards are compared against a name nothing ships`,
);

for (const face of OG_FACES) {
  const rel = relative(root, face.file);
  if (!existsSync(face.file)) {
    assertThat(false, `${rel} exists`, `build-og.mjs reads it to draw every social card`);
    continue;
  }
  const font = fontFor(face.file);
  assertThat(
    font.familyName === servedFamily,
    `${rel} is the family the site serves`,
    `the cards would be drawn in "${font.familyName}" while the site renders "${servedFamily}"`,
  );
  assertThat(
    font["OS/2"]?.usWeightClass === face.weight,
    `${rel} carries the weight build-og requests`,
    `build-og draws at ${face.weight}, the file's usWeightClass is ${font["OS/2"]?.usWeightClass}`,
  );
}

/*
 * THE BASELINE. Every assertion above is satisfied by a file re-subsetted with
 * its axes intact, so the bytes themselves are pinned.
 */
/** @param {string} file */
const digest = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const allBinaries = [...shipped, ...OG_FACES.map((f) => f.file)].filter(existsSync).sort();
const current = Object.fromEntries(allBinaries.map((f) => [relative(root, f).split("\\").join("/"), digest(f)]));

if (update) {
  writeFileSync(FIXTURE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`  --update: rewrote the baseline with ${Object.keys(current).length} digest(s).`);
  console.log("  THIS IS DELIBERATELY LOUD. Commit it only if the font change was intended.\n");
} else {
  assertThat(existsSync(FIXTURE), "the font baseline exists", `${relative(root, FIXTURE)} is missing; regenerate with --update`);
  if (existsSync(FIXTURE)) {
    /** @type {Record<string, string>} */
    const pinned = JSON.parse(readFileSync(FIXTURE, "utf8"));
    assertThat(
      Object.keys(pinned).length === Object.keys(current).length,
      "the baseline covers every shipped binary",
      `baseline pins ${Object.keys(pinned).length}, disk has ${Object.keys(current).length}`,
    );
    for (const [name, sha] of Object.entries(current)) {
      assertThat(
        pinned[name] === sha,
        `${name} is byte-identical to its pinned baseline`,
        pinned[name]
          ? `expected ${pinned[name].slice(0, 16)}, got ${sha.slice(0, 16)}. A re-subset keeps every axis and changes ` +
            `the glyphs; if the change was intended, re-run with --update.`
          : `not in the baseline; re-run with --update if the file is new`,
      );
    }
  }
}

/*
 * THE FLOOR, measured by RUNNING this gate: a hand-counted floor is a second owner of a number
 * the gate already knows. MEASURED ON A PLAIN RUN, and that distinction cost a wrong floor once:
 * `--update` SKIPS the per-binary baseline comparisons.
 */
const MINIMUM_CHECKS = 220;
const breach = assertFloor("check:fonts", "checks", checks, MINIMUM_CHECKS);
if (breach) assertThat(false, "this gate executed its assertions", breach);

console.log(
  `\n  ${blocks.length} @font-face block(s), ${withFile.length} file-backed, ${withoutFile.length} local()-only, ` +
    `${allBinaries.length} binaries pinned, ${variationRequests.length} axis request(s).`,
);
console.log(`  ${checks} check(s), ${failures} failure(s).\n`);

process.exitCode = failures > 0 ? 1 : 0;
