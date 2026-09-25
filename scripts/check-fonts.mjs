import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import * as fontkit from "fontkit";

import { createTally } from "./lib/tally.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = join(root, "scripts", "fixtures", "font-baseline.json");
const update = process.argv.includes("--update");

const tally = createTally({ blankLine: true });
const { ok } = tally;

console.log("\ncheck:fonts\n");

const SHEETS = [
  join(root, "app", "app.css"),
  ...readdirSync(join(root, "app", "styles"))
    .filter((f) => f.endsWith(".css"))
    .map((f) => join(root, "app", "styles", f)),
];

/**
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

  // Type levels carry axes and family in separate tokens, so the regex above sees neither. The family
  // travels with the request: two shipped families carry `opsz` on different ranges.
  const levelFamilies = new Map();
  for (const m of css.matchAll(/--t-([a-z0-9-]+)-family\s*:\s*([^;]+);/gi)) {
    levelFamilies.set(m[1], m[2].trim());
  }
  for (const m of css.matchAll(/--t-([a-z0-9-]+)-vars\s*:\s*([^;]+);/gi)) {
    const [, level, value] = m;
    // A variant inherits its level's family: the base is the level name minus its last segment, used only
    // when no exact token exists.
    const base = level.includes("-") ? level.slice(0, level.lastIndexOf("-")) : null;
    const family =
      levelFamilies.get(level) ?? (base ? (levelFamilies.get(base) ?? null) : null);
    for (const a of value.matchAll(/['"]([a-zA-Z]{4})['"]\s*(-?[\d.]+)/g)) {
      variationRequests.push({ sheet, axis: a[1], value: Number(a[2]), family, level });
    }
  }
}

// Split rather than filtered, so `file` is non-nullable. The annotation below must be a double-star
// block: written with a single star, the `@type` is not JSDoc and nothing is checked.
/** @type {{sheet: string, family: string, weight: string|null, style: string|null, stretch: string|null, file: string, raw: string}[]} */
const withFile = [];
/** @type {typeof blocks} */
const withoutFile = [];
for (const b of blocks) {
  if (b.file) withFile.push({ ...b, file: b.file });
  else withoutFile.push(b);
}
ok("the sheets parsed into @font-face blocks", blocks.length >= 20, `${blocks.length} parsed, expected at least 20`);
ok("blocks naming a file were found", withFile.length >= 20, `${withFile.length} name a file`);

// The local()-only faces are skipped explicitly and listed exactly, so a file-backed block cannot fall
// into the skip path unnoticed.
/* "Inter Fallback" twice: a regular face and a bold one, one per weight band. The serif's twice: roman and italic. */
const FILELESS = ["Inter Fallback", "Inter Fallback", "Source Serif 4 Web Fallback", "Source Serif 4 Web Fallback"];
{
  const got = withoutFile.map((b) => b.family).sort();
  ok(
    `the local()-only faces are exactly the ${FILELESS.length} metric-adjusted fallbacks`,
    got.length === FILELESS.length && got.every((f, i) => f === [...FILELESS].sort()[i]),
    `skipped [${got.join(", ")}], expected [${[...FILELESS].sort().join(", ")}]. A new fileless face must be ` +
      `named here, or it is a face this gate silently does not check.`,
  );
}

const shipped = [];
for (const dir of [join(root, "app", "fonts"), join(root, "app", "fonts", "katex")]) {
  for (const f of readdirSync(dir, { withFileTypes: true })) {
    if (f.isFile() && /\.(woff2?|ttf|otf)$/.test(f.name)) shipped.push(join(dir, f.name));
  }
}

const referenced = new Set(withFile.map((b) => b.file));
for (const file of shipped) {
  ok(
    `${relative(root, file)} is referenced by an @font-face block`,
    referenced.has(file),
    `the file ships and no declaration names it, so nothing asserts what it is`,
  );
}

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

// Namespaced families legitimately differ from the binary's name table: the serif is namespaced so a
// reader with the retail family installed cannot put a different file in the resolution path.
/** @type {Map<string, string>} declared family -> the family its file must report */
const NAMESPACED = new Map([["Source Serif 4 Web", "Source Serif 4"]]);

for (const b of withFile) {
  const rel = relative(root, b.file);
  if (!existsSync(b.file)) {
    ok(`${rel} exists`, false, `declared in ${relative(root, b.sheet)} and not on disk`);
    continue;
  }

  const font = fontFor(b.file);
  const axes = font.variationAxes ?? {};

  // KaTeX's name table carries the family without the style suffix, which is what the CSS declares too.
  const expected = NAMESPACED.get(b.family) ?? b.family;
  // The PostScript fallback compares the family part before the style suffix EXACTLY: a prefix match let
  // "InterDisplay-Bold" pass for "Inter".
  ok(
    `${rel} is the family the declaration names`,
    font.familyName === expected || font.postscriptName?.split("-")[0] === expected.replace(/\s+/g, ""),
    `css says "${b.family}"${
      expected === b.family ? "" : ` (namespaced, and must be "${expected}")`
    }, the file's name table says "${font.familyName}" (${font.postscriptName})`,
  );

  // Absent means `normal`, and the two keywords a face descriptor accepts are numbers in disguise; a
  // value in none of these shapes used to fall through every branch unasserted.
  const WEIGHT_KEYWORDS = /** @type {Record<string, string>} */ ({ "": "400", normal: "400", bold: "700" });
  const declaredWeight = (b.weight ?? "").trim().toLowerCase();
  const weight = WEIGHT_KEYWORDS[declaredWeight] ?? declaredWeight;
  const range = weight.match(/^(\d+)\s+(\d+)$/);
  if (range) {
    const [, lo, hi] = range;
    ok(
      `${rel} carries a wght axis, as its declared range promises`,
      Boolean(axes.wght),
      `css declares "font-weight: ${weight}" and the file has axes [${Object.keys(axes).join(", ") || "none"}]`,
    );
    if (axes.wght) {
      ok(
        `${rel} wght range matches the declaration exactly`,
        axes.wght.min === Number(lo) && axes.wght.max === Number(hi),
        `css declares ${lo} ${hi}, the file's wght is ${axes.wght.min} to ${axes.wght.max}. A narrower file means ` +
          `weights the stylesheet asks for are synthesised rather than drawn.`,
      );
    }
  } else if (/^\d+$/.test(weight)) {
    ok(
      `${rel} is static, as its single declared weight implies`,
      !axes.wght,
      `css declares "font-weight: ${weight}" but the file has a wght axis; declare the range instead`,
    );
    const us = font["OS/2"]?.usWeightClass;
    ok(
      `${rel} usWeightClass matches the declared weight`,
      us === Number(weight),
      `css declares ${weight}, the file's OS/2.usWeightClass is ${us}`,
    );
  } else {
    ok(
      `${rel} declares a font-weight this gate can read`,
      false,
      `"font-weight: ${b.weight}" is neither a number, a range nor normal/bold, so nothing checked it`,
    );
  }

  // Absent means `normal`; `oblique` (with or without an angle) is a slanted face.
  const style = (b.style ?? "normal").trim().toLowerCase();
  if (style === "italic" || style === "normal" || style.startsWith("oblique")) {
    const italicByAngle = font.italicAngle !== 0;
    const italicByName = /italic|oblique/i.test(font.subfamilyName ?? "") || /italic/i.test(font.postscriptName ?? "");
    const isItalic = italicByAngle || italicByName || Boolean(axes.ital) || Boolean(axes.slnt);
    ok(
      `${rel} slant matches the declared font-style`,
      (style !== "normal") === isItalic,
      `css declares "${style}", the file reports italicAngle=${font.italicAngle} subfamily="${font.subfamilyName}"`,
    );
  } else {
    ok(
      `${rel} declares a font-style this gate can read`,
      false,
      `"font-style: ${b.style}" is not normal, italic or oblique, so nothing checked it`,
    );
  }

  const declaredStretch = (b.stretch ?? "").trim().toLowerCase();
  const stretch = declaredStretch.match(/^([\d.]+)%\s+([\d.]+)%$/);
  if (stretch) {
    ok(
      `${rel} wdth range matches the declared font-stretch`,
      axes.wdth !== undefined && axes.wdth.min === Number(stretch[1]) && axes.wdth.max === Number(stretch[2]),
      `css declares ${stretch[1]}% ${stretch[2]}%, the file's wdth is ${axes.wdth ? `${axes.wdth.min} to ${axes.wdth.max}` : "absent"}`,
    );
  } else if (declaredStretch !== "" && declaredStretch !== "normal" && declaredStretch !== "100%") {
    ok(
      `${rel} declares a font-stretch this gate can read`,
      false,
      `"font-stretch: ${b.stretch}" is not a percentage range or normal, so nothing checked it`,
    );
  }
}

// The namespace map polices itself: an entry naming a family no sheet declares
// any more is a widened comparison nobody would notice, and an entry whose
// declared and binary names are equal is not a namespace at all.
for (const [declared, binary] of NAMESPACED) {
  ok(
    `namespace entry "${declared}" names a family a sheet still declares`,
    withFile.some((b) => b.family === declared),
    `no @font-face declares it; the entry is dead and should be removed`,
  );
  ok(
    `namespace entry "${declared}" actually renames something`,
    declared !== binary,
    `declared and binary family are identical, so the entry does nothing`,
  );
}

// A browser clamps an out-of-range axis silently, so the level renders at the wrong optical size.
ok(
  "axis requests were found in the sheets",
  variationRequests.length >= 16,
  `${variationRequests.length} found; a regex that stopped matching would iterate nothing and every ` +
    `assertion below would report a clean sweep`,
);

/**
 * Resolves `var(--font-sans)` to the first family in that stack, the face the level actually sets in.
 *
 * @param {string|null} value
 * @returns {string|null}
 */
function resolveFamily(value) {
  if (!value) return null;
  let v = value.trim();
  const sheet = stripComments(readFileSync(join(root, "app", "app.css"), "utf8"));
  for (let i = 0; i < 4 && v.startsWith("var("); i += 1) {
    // `var(--a, fallback)` names --a; the fallback is not part of the name.
    const name = v.slice(4, v.indexOf(")")).split(",")[0].trim();
    if (!/^--[a-z0-9-]+$/i.test(name)) return null;
    // Anchored, so `--x--font-sans:` cannot answer for `--font-sans`.
    const decl = new RegExp(`(?:^|[\\s;{])${name}\\s*:\\s*([^;]+);`).exec(sheet);
    if (!decl) return null;
    v = decl[1].trim();
  }
  return v.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}

const faces = withFile.filter((b) => existsSync(b.file)).map((b) => ({ b, axes: fontFor(b.file).variationAxes ?? {} }));
for (const req of variationRequests) {

  const where = req.level ? `--t-${req.level}-vars` : relative(root, req.sheet);

  // A level whose family cannot be resolved would be checked against nothing,
  // which is the zero-scope class: it would pass by measuring no face at all.
  const wanted = resolveFamily(req.family);
  if (req.level) {
    ok(
      `${where} resolves to a family this gate can check`,
      wanted !== null,
      `--t-${req.level}-family is "${req.family}" and no declaration resolves it, so this level's ` +
        `"${req.axis}" ${req.value} would be checked against no face at all`,
    );
  }

  // A level is checked against its own family only; a bare `font-variation-settings` names none, so it
  // is checked against every carrier of the axis.
  const carriers = faces.filter(
    (f) => f.axes[req.axis] && (wanted === null || f.b.family === wanted),
  );
  ok(
    `the "${req.axis}" axis requested in ${where} exists in a shipped face` +
      (wanted ? ` of "${wanted}"` : ""),
    carriers.length > 0,
    wanted
      ? `no shipped face of "${wanted}" carries "${req.axis}"; the declaration is inert`
      : `no shipped font carries "${req.axis}"; the declaration is inert`,
  );
  for (const c of carriers) {
    const a = c.axes[req.axis];
    if (!a) continue;
    ok(
      `"${req.axis}" ${req.value} from ${where} is in range for ${relative(root, c.b.file)}`,
      req.value >= a.min && req.value <= a.max,
      `the file supports ${a.min} to ${a.max}; a browser CLAMPS ${req.value} silently, so the level renders at the ` +
        `wrong optical size and nothing reports it`,
    );
  }
}

// The satori faces are a different build of the served typeface, because satori cannot read woff2.
// The served woff2 build is canonical, and the difference stands.
const OG_FACES = [
  { file: join(root, "assets", "fonts", "Inter-Regular.ttf"), weight: 400 },
  { file: join(root, "assets", "fonts", "Inter-Bold.ttf"), weight: 700 },
];
// Read from the `--font-sans` token, not the first `@font-face` block, which is a statement about source order.
const servedFamily = (() => {
  const sheet = stripComments(readFileSync(join(root, "app", "app.css"), "utf8"));
  const decl = /--font-sans:\s*([^;]+);/.exec(sheet);
  ok("app.css declares --font-sans", Boolean(decl), "the served family cannot be read without it");
  if (!decl) return null;
  return decl[1].trim().split(",")[0].trim().replace(/^['"]|['"]$/g, "");
})();

ok(
  `--font-sans names a family app/fonts/ actually serves ("${servedFamily}")`,
  withFile.some(
    (b) => b.family === servedFamily && b.file.includes(join("app", "fonts")) && !b.file.includes("katex"),
  ),
  `the stack's first family is not backed by any self-hosted face, so the cards are compared against a name nothing ships`,
);

for (const face of OG_FACES) {
  const rel = relative(root, face.file);
  if (!existsSync(face.file)) {
    ok(`${rel} exists`, false, `build-og.mjs reads it to draw every social card`);
    continue;
  }
  const font = fontFor(face.file);
  ok(
    `${rel} is the family the site serves`,
    font.familyName === servedFamily,
    `the cards would be drawn in "${font.familyName}" while the site renders "${servedFamily}"`,
  );
  ok(
    `${rel} carries the weight build-og requests`,
    font["OS/2"]?.usWeightClass === face.weight,
    `build-og draws at ${face.weight}, the file's usWeightClass is ${font["OS/2"]?.usWeightClass}`,
  );
}

// Every assertion above is satisfied by a file re-subsetted with its axes intact, so the bytes are pinned.
/** @param {string} file */
const digest = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
const allBinaries = [...shipped, ...OG_FACES.map((f) => f.file)].filter(existsSync).sort();
const current = Object.fromEntries(allBinaries.map((f) => [relative(root, f).split("\\").join("/"), digest(f)]));

if (update) {
  writeFileSync(FIXTURE, `${JSON.stringify(current, null, 2)}\n`);
  console.log(`  --update: rewrote the baseline with ${Object.keys(current).length} digest(s).`);
  console.log("  THIS IS DELIBERATELY LOUD. Commit it only if the font change was intended.\n");
} else {
  ok("the font baseline exists", existsSync(FIXTURE), `${relative(root, FIXTURE)} is missing; regenerate with --update`);
  if (existsSync(FIXTURE)) {
    /** @type {Record<string, string>} */
    const pinned = JSON.parse(readFileSync(FIXTURE, "utf8"));
    ok(
      "the baseline covers every shipped binary",
      Object.keys(pinned).length === Object.keys(current).length,
      `baseline pins ${Object.keys(pinned).length}, disk has ${Object.keys(current).length}`,
    );
    // Both directions: a count match alone passes when one pinned file is swapped for another.
    for (const name of Object.keys(pinned)) {
      ok(`${name} is pinned and still on disk`, name in current, "the baseline names a binary that is gone");
    }
    for (const [name, sha] of Object.entries(current)) {
      ok(
        `${name} is byte-identical to its pinned baseline`,
        pinned[name] === sha,
        pinned[name]
          ? `expected ${pinned[name].slice(0, 16)}, got ${sha.slice(0, 16)}. A re-subset keeps every axis and changes ` +
            `the glyphs; if the change was intended, re-run with --update.`
          : `not in the baseline; re-run with --update if the file is new`,
      );
    }
  }
}

// Measured on a plain run: `--update` skips the per-binary baseline comparisons.
const MINIMUM_CHECKS = 520;
tally.floor("check:fonts", "checks", MINIMUM_CHECKS);

console.log(
  `\n  ${blocks.length} @font-face block(s), ${withFile.length} file-backed, ${withoutFile.length} local()-only, ` +
    `${allBinaries.length} binaries pinned, ${variationRequests.length} axis request(s).`,
);
console.log(`  ${tally.checks} check(s), ${tally.failures} failure(s).\n`);

process.exitCode = tally.failures > 0 ? 1 : 0;
