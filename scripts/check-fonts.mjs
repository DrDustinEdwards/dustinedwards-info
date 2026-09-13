/**
 * Gate over the self-hosted fonts: every `@font-face` DECLARATION must be true
 * of the BINARY it names.
 *
 * ## THE HOLE THIS FILLS
 *
 * `font-weight: 100 900` is a claim about a file. Nothing checked it. The two
 * Inter faces under `app/fonts/` were taken from `fonts.gstatic.com` and
 * committed, so unlike every other derived thing here they have no upstream to
 * be compared against: a file swapped for a static build, a re-subset that
 * narrows the weight axis, or a variable axis that quietly disappears would all
 * have rendered wrong and failed nothing.
 *
 * It exists now rather than later because a type scale is about to declare
 * `font-variation-settings: "opsz" <n>` per level. `opsz` on these files runs
 * 14 to 32, and a browser CLAMPS an out-of-range axis value silently: no error,
 * no console line, just a level that did not get the optical size it asked for.
 * That is the class of defect this gate is for.
 *
 * ## WHAT IT ASSERTS, per `@font-face` block that names a file
 *
 * The declared `font-weight` range against the `wght` axis, EXACTLY rather than
 * as a subset, so a narrowed re-subset fails. A single declared weight against
 * `OS/2.usWeightClass`, which is the static-font form. `font-style` against the
 * italic evidence in the file. `font-stretch` against `wdth` where declared.
 * The declared `font-family` against the file's own name table, so a wholesale
 * swap of a different typeface fails. And every `"opsz"`-style axis named in a
 * `font-variation-settings` anywhere in the sheets must EXIST in that family's
 * faces and CONTAIN the requested value.
 *
 * ## THE BASELINE, and why axis assertions alone are not enough
 *
 * Everything above is satisfied by a file that was re-subsetted while keeping
 * its axes: same `wght`, same `opsz`, fewer glyphs. That is a real way to break
 * a page and it is invisible to every assertion in the list. So each binary
 * also carries a pinned SHA-256 in `scripts/fixtures/font-baseline.json`, and a
 * changed byte is a named failure. `--update` rewrites it, deliberately loud,
 * which is the same shape `check:admin-ui` uses for the same reason: a fixture
 * that can be regenerated silently is not a fixture.
 *
 * ## OBSERVATION BOUNDARY
 *
 * It reads DISK, never the wire, so it says nothing about what a browser
 * received. It asserts AGREEMENT and never judgment: whether `font-display`,
 * the metric-adjusted fallback or a `unicode-range` are the RIGHT choices is
 * not a thing it can know. It cannot see whether a font renders correctly, only
 * whether the declaration and the file agree about what the file is.
 *
 * ## OVERLAP, stated rather than discovered
 *
 * The 20 KaTeX faces are included for uniformity and the protection here is the
 * WEAKER half: `check:content` section 5 already byte-compares
 * `katex.generated.css` AND its faces against a fresh derivation from the
 * installed katex package, reconciled both ways, so a swapped or re-subsetted
 * KaTeX font already fails there. A rule with an exception is a rule somebody
 * edits, which is why they are in rather than out.
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
 * The first argument is named `ok` because six other gates spell it that way
 * and `check:invariants` section 17 refuses two argument orders for one helper
 * name: an assertion copied between files would otherwise put a truthy STRING
 * in the condition slot, never fail, and still increment the count.
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
 * Comments are stripped BEFORE matching, hard rule 10: prose about a face is
 * not a face.
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

  // Axis requests anywhere in the sheet, not only inside @font-face: this is
  // what catches a type scale asking for an optical size the file cannot serve.
  for (const m of css.matchAll(/font-variation-settings\s*:\s*([^;}]+)/gi)) {
    for (const a of m[1].matchAll(/['"]([a-zA-Z]{4})['"]\s*(-?[\d.]+)/g)) {
      variationRequests.push({ sheet, axis: a[1], value: Number(a[2]), family: null });
    }
  }

  /*
   * AND THE TYPE LEVELS, which do not spell `font-variation-settings` anywhere.
   *
   * app.css carries the scale as five properties per level, so a level's axes
   * live in `--t-<level>-vars` and its family in `--t-<level>-family`. The
   * regex above sees neither, which would have made this gate blind to exactly
   * the defect its own header says it was written for: a type scale asking for
   * an optical size the file cannot serve.
   *
   * THE FAMILY IS CARRIED WITH THE REQUEST, and that is the half that makes the
   * assertion sharp. Two shipped families now carry `opsz` on different ranges,
   * Inter 14 to 32 and Source Serif 4 8 to 60. Checking a request against every
   * carrier would fail the serif's legitimate `opsz` 48 against Inter; checking
   * it against none would let an Inter level ask for 48 and be clamped in
   * silence. Each level is checked against the family its own -family token
   * names, and nothing else.
   */
  const levelFamilies = new Map();
  for (const m of css.matchAll(/--t-([a-z0-9-]+)-family\s*:\s*([^;]+);/gi)) {
    levelFamilies.set(m[1], m[2].trim());
  }
  for (const m of css.matchAll(/--t-([a-z0-9-]+)-vars\s*:\s*([^;]+);/gi)) {
    const [, level, value] = m;
    // A VARIANT INHERITS ITS LEVEL'S FAMILY. A `--t-<level>-strong-vars` is
    // that level at a heavier weight, not a ninth level, so it has no
    // `-family` of its own and must not: a second family token for one level
    // would be a second owner of the same decision. The base is the level name
    // with its last segment dropped, and only when no exact `-family` exists,
    // so a real level always wins over the fallback.
    //
    // The variant is NOT spelled in full here on purpose. Section 31's token
    // scan reads scripts/ without stripping comments, so naming it would mark
    // it as referenced and then fail it for being referenced.
    const base = level.includes("-") ? level.slice(0, level.lastIndexOf("-")) : null;
    const family =
      levelFamilies.get(level) ?? (base ? (levelFamilies.get(base) ?? null) : null);
    for (const a of value.matchAll(/['"]([a-zA-Z]{4})['"]\s*(-?[\d.]+)/g)) {
      variationRequests.push({ sheet, axis: a[1], value: Number(a[2]), family, level });
    }
  }
}

/*
 * SCOPE, ASSERTED BEFORE ANY PER-BLOCK ASSERTION. A regex that stopped matching
 * would iterate nothing and every loop below would report a clean sweep, which
 * is the tenth vacuity class. The floors are the inventory as it stands and are
 * deliberately low bars: they exist to prove the parse happened at all.
 */
/*
 * Split rather than filtered, so `file` is a string in the half that has one.
 * `blocks.filter((b) => b.file)` leaves the type `string | null` and every use
 * below would need a cast, which is a way of telling the typechecker to stop
 * looking at exactly the field whose absence this gate cares about.
 *
 * The annotation below is a DOUBLE-STAR block on purpose. Written as a plain
 * `/*` comment the `@type` is not JSDoc, TypeScript ignores it, and the array
 * infers `any[]`: every null error disappears and nothing is checked, which is
 * a silent pass wearing the costume of a fix.
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
 * The local()-only faces are SKIPPED EXPLICITLY and counted, so a future
 * file-backed block cannot fall into the skip path unnoticed. Two today, both
 * metric-adjusted fallbacks: "Inter Fallback" over `local("Arial")` and
 * "Source Serif 4 Web Fallback" over `local("Georgia")`.
 *
 * The list is exact rather than a count, because a count is satisfied by any
 * two fileless faces and the thing worth asserting is WHICH two.
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

// NAMESPACED FAMILIES are the one case where the declared family and the
// binary's own name table legitimately differ. app.css declares the serif as
// "Source Serif 4 Web" so that a reader with the retail family installed cannot
// put a different file in the resolution path for the same name. This map is
// what keeps that from being a licence: the declaration is still pinned to ONE
// binary family, so swapping the typeface behind the namespaced name fails
// exactly as it would without one.
//
// It polices itself below, in both directions, for the reason the exemption
// maps in check:contrast do: an entry naming a family app.css no longer
// declares is a hole nobody would notice.
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
 * AXIS REQUESTS FROM THE SHEETS. The value must be IN RANGE, because a browser
 * clamps an out-of-range axis silently: the level renders, at the wrong optical
 * size, with nothing anywhere reporting it.
 */
/*
 * A ZERO-SCOPE SEARCH REPORTS A CLEAN SWEEP. The scale carries eight levels and
 * every one of them names two axes, so the floor is the inventory as it stands
 * and exists to prove the parse happened at all rather than to bound it.
 */
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
 * THE SATORI FACES, which are not in any stylesheet.
 *
 * `build-og.mjs` and `check-logo.mjs` draw the social cards with the static
 * TTFs under `assets/fonts/`. They are Inter too, and nothing reconciled them
 * against the faces the site serves: MEASURED 2026-09-12, the TTFs are Inter
 * 4.001 build git-9221beed3 and the served woff2 are 4.001 build git-66647c0bb,
 * so the cards are already drawn with a different build of the same release.
 * That is tolerable and it is not nothing, which is why it is asserted here
 * rather than left to be discovered: the family must match what the site
 * serves, and the weights build-og asks for must be the weights in the files.
 *
 * ## RULED 2026-09-12: THE SERVED woff2 BUILD IS CANONICAL
 *
 * `git-66647c0bb`, the build under `app/fonts/`, is the site's Inter. It is
 * what every reader sees, and its provenance is already ruled: byte-identical
 * to what fonts.gstatic.com served, so the change was WHO serves them and not
 * WHAT is served. Social cards are a secondary artifact of that identity and
 * take their typeface from it rather than the other way round.
 *
 * THE TWO ARE NOT ALIGNED AND CANNOT CHEAPLY BE. satori reads TTF, OTF and
 * WOFF and NOT woff2, by its own README, so one shared file is impossible.
 * Aligning would mean statics compiled from the canonical build, and those do
 * not exist to download: Google Fonts publishes Inter as variable fonts only
 * (`Inter[opsz,wght].ttf`), and rsms/inter releases carry their own version
 * lineage rather than a `4.001;git-*` build string.
 *
 * So the difference STANDS, deliberately, and what was refused with it was
 * building a woff2-to-TTF instancing pipeline: a new dependency, a build step
 * and a gate to keep the two in step, which is the same trade app.css already
 * refused for italic subsetting. What holds the line instead is this section
 * plus the byte baseline: neither side can move without a named failure.
 *
 * MEASURED, and the reason this is tolerable rather than merely accepted: the
 * two builds agree on unitsPerEm, ascent, descent and lineGap, and on the
 * advance width of every glyph tested, so card text sets identically. Outlines
 * differ in point encoding, which is what a variable default instance against a
 * compiled static looks like, so that comparison cannot separate a build
 * difference from variable-versus-static and is not offered as evidence.
 */
const OG_FACES = [
  { file: join(root, "assets", "fonts", "Inter-Regular.ttf"), weight: 400 },
  { file: join(root, "assets", "fonts", "Inter-Bold.ttf"), weight: 700 },
];
/*
 * THE FAMILY THE SITE SERVES, read from `--font-sans` rather than from the
 * FIRST `@font-face` block under app/fonts/.
 *
 * It was the first block, which was true for exactly as long as Inter was the
 * only family there. The serif landed under app/fonts/ on 2026-09-13 and made
 * the old selector a statement about source ORDER: moving the serif's face
 * above Inter's would have silently re-pointed this comparison at the serif and
 * the cards would have been checked against the wrong typeface, passing.
 *
 * `--font-sans` is an independent declaration and the right source anyway: the
 * cards draw body-weight text, and the body's family is what that token says.
 * The serif sets headings and never appears on a card.
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
 * THE FLOOR. Measured by RUNNING this gate over the tree as it stands, never by
 * summing the assertions above: a hand-counted floor is a second owner of a
 * number the gate already knows.
 *
 * MEASURED ON THE DEFAULT BRANCH, and the distinction cost a wrong floor once
 * already. `--update` SKIPS the per-binary baseline comparisons, so it executes
 * 26 fewer checks than a plain run: 117 against 143. A floor measured from an
 * `--update` run sits 26 under the count it is supposed to guard, which is the
 * exact shape ruling 23 exists to catch.
 *
 * RE-MEASURED 2026-09-13 on a plain run, NOT an `--update` one, after the serif
 * and the type levels landed: 232. The rise is the serif's own per-binary
 * assertions plus 22 axis requests where there were none, since the scale is
 * the first thing on this site to ask for an optical size. Floor is that count
 * minus the check:floors tolerance, max(3, ceil(232 * 0.05)) = 12.
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
