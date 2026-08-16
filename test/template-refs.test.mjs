/**
 * The repository-reference scan, which is what makes the third usage state
 * possible.
 *
 * Every test here replays something the scan got WRONG on a real run against
 * this repository, before it was fixed. None of them are hypothetical:
 *
 *   - a doc comment naming six brand assets marked all six as placed by page
 *     code, including the scanner's own header describing the problem;
 *   - `"public/site.webmanifest"` in a source array marked `/site.webmanifest`
 *     as referenced by the file that merely lists it;
 *   - a prefix pair (`/logo.svg` inside `/logo-header.svg`) is the collision
 *     that motivated the boundary check in the first place.
 *
 * @see app/lib/media/template-refs.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  SOURCE_EXTENSIONS,
  SOURCE_ROOTS,
  foldRefs,
  isSourceFile,
  referencesIn,
  stripComments,
} from "../app/lib/media/template-refs.mjs";

const ASSETS = [
  "/logo.svg",
  "/logo-header.svg",
  "/logo-dark.svg",
  "/favicon.svg",
  "/favicon.ico",
  "/site.webmanifest",
  "/phage-hunters/2019.webp",
  "/og-image.png",
];

/* ---- the match itself ---------------------------------------------------- */

test("a real reference in a string literal is found", () => {
  assert.deepEqual(referencesIn('const a = { src: "/phage-hunters/2019.webp" };', ASSETS), [
    "/phage-hunters/2019.webp",
  ]);
});

test("a PREFIX collision is not a reference", () => {
  // `/logo.svg` is a prefix of `/logo-header.svg`. Only the longer one is here.
  const found = referencesIn('<img src="/logo-header.svg">', ASSETS);
  assert.deepEqual(found, ["/logo-header.svg"]);
  assert.ok(!found.includes("/logo.svg"), "the shorter path must not ride along");
});

test("a SUFFIX collision is not a reference, which is the one that fired", () => {
  // Measured: `SOURCE_FILES = ["public/site.webmanifest"]` marked the asset
  // `/site.webmanifest` as referenced by the module that only lists the file.
  const found = referencesIn('const SOURCE_FILES = ["public/site.webmanifest"];', ASSETS);
  assert.deepEqual(found, [], "a longer path ENDING with an asset path is not that asset");
});

test("the same path in two places is reported once", () => {
  const text = 'a("/og-image.png"); b("/og-image.png");';
  assert.deepEqual(referencesIn(text, ASSETS), ["/og-image.png"]);
});

test("a collision followed later by a real hit still finds the real hit", () => {
  // The scanner must keep looking past a rejected match rather than giving up,
  // which is the bug an early `return false` would have introduced.
  const text = 'import "/logo-header.svg";\nconst real = "/logo.svg";';
  const found = referencesIn(text, ASSETS);
  assert.ok(found.includes("/logo.svg"), "the genuine reference after a collision was missed");
  assert.ok(found.includes("/logo-header.svg"));
});

test("nothing is invented from an empty file", () => {
  assert.deepEqual(referencesIn("", ASSETS), []);
});

/* ---- comments are prose, not placement ----------------------------------- */

test("an asset named only in a line comment is NOT a reference", () => {
  const text = '// generated from /logo.svg, do not edit\nconst x = 1;';
  assert.deepEqual(referencesIn(stripComments(text), ASSETS), []);
});

test("an asset named only in a block comment is NOT a reference", () => {
  const text = "/**\n * Path data copied from /logo-header.svg verbatim.\n */\nexport const A = 1;";
  assert.deepEqual(referencesIn(stripComments(text), ASSETS), []);
});

test("a URL inside a string survives the comment stripper", () => {
  // THE REASON THIS IS A TOKENIZER AND NOT A REGEX. Stripping from `//` to end
  // of line would eat the rest of this line and take the asset with it.
  const text = 'const u = "https://example.test/x"; const a = "/logo.svg";';
  const stripped = stripComments(text);
  assert.ok(stripped.includes("https://example.test/x"), "the URL was destroyed");
  assert.deepEqual(referencesIn(stripped, ASSETS), ["/logo.svg"]);
});

test("a comment marker inside a string is not a comment", () => {
  const text = 'const s = "/* not a comment */"; const a = "/favicon.ico";';
  assert.deepEqual(referencesIn(stripComments(text), ASSETS), ["/favicon.ico"]);
});

test("a quote inside a comment does not open a string", () => {
  // If the stripper mistook this apostrophe for a string start it would swallow
  // the rest of the file and the real reference below would vanish.
  const text = "// it is the author's note about /logo.svg\nconst a = '/favicon.svg';";
  assert.deepEqual(referencesIn(stripComments(text), ASSETS), ["/favicon.svg"]);
});

test("an escaped quote does not end a string early", () => {
  const text = 'const s = "a \\" /logo.svg still inside"; const b = "/favicon.ico";';
  const found = referencesIn(stripComments(text), ASSETS);
  assert.ok(found.includes("/favicon.ico"));
});

test("a template literal is scanned, because that is where paths live", () => {
  const text = "const a = `/phage-hunters/2019.webp`;";
  assert.deepEqual(referencesIn(stripComments(text), ASSETS), ["/phage-hunters/2019.webp"]);
});

test("stripping preserves newlines, so a stripped block cannot join two lines", () => {
  const text = "/* one\n   two */\nconst a = 1;";
  const stripped = stripComments(text);
  assert.equal((stripped.match(/\n/g) ?? []).length, (text.match(/\n/g) ?? []).length);
});

test("css has block comments and no line comments", () => {
  // `//` is not a comment in CSS, and a naive stripper would eat a data URI.
  const text = '.a { background: url(/logo.svg); } /* url(/favicon.ico) */';
  const found = referencesIn(stripComments(text, true), ASSETS);
  assert.deepEqual(found, ["/logo.svg"], "the commented one must not count");
});

/* ---- which files are read ------------------------------------------------ */

test("the scan reads source, and refuses the artifact that lists every asset", () => {
  assert.ok(isSourceFile("app/data/phage-hunters.ts"));
  assert.ok(isSourceFile("workers/app.ts"));
  assert.ok(isSourceFile("public/site.webmanifest"));
  // SELF-REFERENTIAL. `assets.json` IS the asset inventory, so reading it would
  // mark all 58 static files as referenced by repository code and collapse the
  // third state into "everything".
  assert.equal(isSourceFile("content/generated/assets.json"), false);
  // Posts belong to the OTHER tracker. An asset a post cites is `used`, and
  // letting this scan see post markdown would make it claim both states.
  assert.equal(isSourceFile("content/posts/a-post.md"), false);
  assert.equal(isSourceFile("public/logo.svg"), false);
  assert.equal(isSourceFile("README.md"), false);
});

test("the roots and extensions are non-empty, or the scan reads nothing", () => {
  // A scan whose scope is empty reports the same thing as a repository with no
  // references, which is this repo's most-repeated defect class.
  assert.ok(SOURCE_ROOTS.length >= 2, `${SOURCE_ROOTS.length} root(s)`);
  assert.ok(SOURCE_EXTENSIONS.length >= 4, `${SOURCE_EXTENSIONS.length} extension(s)`);
});

/* ---- folding ------------------------------------------------------------- */

test("results fold to sorted keys and sorted files, so the artifact is stable", () => {
  const out = foldRefs([
    { file: "app/z.ts", assets: ["/logo.svg", "/favicon.ico"] },
    { file: "app/a.ts", assets: ["/logo.svg"] },
  ]);
  assert.deepEqual(Object.keys(out.refs), ["/favicon.ico", "/logo.svg"]);
  assert.deepEqual(out.refs["/logo.svg"], ["app/a.ts", "app/z.ts"]);
  assert.equal(out.generated, 2);
});

test("one file naming one asset twice is recorded once", () => {
  const out = foldRefs([{ file: "app/a.ts", assets: ["/logo.svg"] }, { file: "app/a.ts", assets: ["/logo.svg"] }]);
  assert.deepEqual(out.refs["/logo.svg"], ["app/a.ts"]);
});

test("the self-referential guard beats SOURCE_FILES, which is where it decides", () => {
  /*
   * A PLANT PROVED THIS GUARD WAS DOING NOTHING. Removing the check entirely
   * left check:content green, because `content/generated/assets.json` sits under
   * `content/`, which is not a source root, so the root rule already rejected
   * it. The guard was an assertion that could not fail.
   *
   * It decides in exactly one place: `SOURCE_FILES` entries are named
   * individually and BYPASS the root rule, so a self-referential file listed
   * there would be read unless the guard runs first. That ordering is the
   * property, and this is the only test that can see it.
   */
  // `content/features.json` IS in SOURCE_FILES and IS read, which is the
  // control: it proves the bypass exists for the guard to beat.
  assert.equal(isSourceFile("content/features.json"), true);
  // And the guarded one is refused even though it is under the same root.
  assert.equal(isSourceFile("content/generated/assets.json"), false);
});

test("the guard is checked BEFORE the source-file allowance, not after", () => {
  // Order is the whole property: if the allowance ran first, a self-referential
  // entry named in SOURCE_FILES would be read and the third usage state would
  // collapse into "everything is referenced".
  const source = readFileSync(
    new URL("../app/lib/media/template-refs.mjs", import.meta.url),
    "utf8",
  );
  const guard = source.indexOf("SELF_REFERENTIAL.includes(file)");
  const allow = source.indexOf("SOURCE_FILES.includes(file)");
  assert.ok(guard > 0 && allow > 0, "both checks must exist");
  assert.ok(guard < allow, "the self-referential guard must run first");
});
