import test from "node:test";
import assert from "node:assert/strict";

import {
  foldRefs,
  isSourceFile,
  referencesIn,
  stripComments,
} from "../app/lib/media/template-refs.mjs";

const ASSETS = [
  "/dustin-edwards-logo.svg",
  "/dustin-edwards-logo-header.svg",
  "/dustin-edwards-logo-dark.svg",
  "/dustin-edwards-favicon.svg",
  "/favicon.ico",
  "/site.webmanifest",
  "/phage-hunters/dustin-edwards-2019.webp",
  "/dustin-edwards-og-image.png",
];

test("a real reference in a string literal is found", () => {
  assert.deepEqual(referencesIn('const a = { src: "/phage-hunters/dustin-edwards-2019.webp" };', ASSETS), [
    "/phage-hunters/dustin-edwards-2019.webp",
  ]);
});

test("a PREFIX collision is not a reference", () => {
  // `/dustin-edwards-logo.svg` is a prefix of `/dustin-edwards-logo-header.svg`. Only the longer one is here.
  const found = referencesIn('<img src="/dustin-edwards-logo-header.svg">', ASSETS);
  assert.deepEqual(found, ["/dustin-edwards-logo-header.svg"]);
  assert.ok(!found.includes("/dustin-edwards-logo.svg"), "the shorter path must not ride along");
});

test("a SUFFIX collision is not a reference, which is the one that fired", () => {
  const found = referencesIn('const SOURCE_FILES = ["public/site.webmanifest"];', ASSETS);
  assert.deepEqual(found, [], "a longer path ENDING with an asset path is not that asset");
});

test("the same path in two places is reported once", () => {
  const text = 'a("/dustin-edwards-og-image.png"); b("/dustin-edwards-og-image.png");';
  assert.deepEqual(referencesIn(text, ASSETS), ["/dustin-edwards-og-image.png"]);
});

test("a collision followed later by a real hit still finds the real hit", () => {
  // The scanner must keep looking past a rejected match rather than giving up.
  const text = 'import "/dustin-edwards-logo-header.svg";\nconst real = "/dustin-edwards-logo.svg";';
  const found = referencesIn(text, ASSETS);
  assert.ok(found.includes("/dustin-edwards-logo.svg"), "the genuine reference after a collision was missed");
  assert.ok(found.includes("/dustin-edwards-logo-header.svg"));
});

test("nothing is invented from an empty file", () => {
  assert.deepEqual(referencesIn("", ASSETS), []);
});

test("an asset named only in a line comment is NOT a reference", () => {
  const text = '// generated from /dustin-edwards-logo.svg, do not edit\nconst x = 1;';
  assert.deepEqual(referencesIn(stripComments(text), ASSETS), []);
});

test("an asset named only in a block comment is NOT a reference", () => {
  const text = "/**\n * Path data copied from /dustin-edwards-logo-header.svg verbatim.\n */\nexport const A = 1;";
  assert.deepEqual(referencesIn(stripComments(text), ASSETS), []);
});

test("a URL inside a string survives the comment stripper", () => {
  // Stripping from `//` to end of line would eat the rest of this line and the asset with it.
  const text = 'const u = "https://example.test/x"; const a = "/dustin-edwards-logo.svg";';
  const stripped = stripComments(text);
  assert.ok(stripped.includes("https://example.test/x"), "the URL was destroyed");
  assert.deepEqual(referencesIn(stripped, ASSETS), ["/dustin-edwards-logo.svg"]);
});

test("a comment marker inside a string is not a comment", () => {
  const text = 'const s = "/* not a comment */"; const a = "/favicon.ico";';
  assert.deepEqual(referencesIn(stripComments(text), ASSETS), ["/favicon.ico"]);
});

test("a quote inside a comment does not open a string", () => {
  // If the stripper mistook this apostrophe for a string start it would swallow
  // the rest of the file and the real reference below would vanish.
  const text = "// it is the author's note about /dustin-edwards-logo.svg\nconst a = '/dustin-edwards-favicon.svg';";
  assert.deepEqual(referencesIn(stripComments(text), ASSETS), ["/dustin-edwards-favicon.svg"]);
});

test("an escaped quote does not end a string early", () => {
  const text = 'const s = "a \\" /dustin-edwards-logo.svg still inside"; const b = "/favicon.ico";';
  const found = referencesIn(stripComments(text), ASSETS);
  assert.ok(found.includes("/favicon.ico"));
});

test("a template literal is scanned, because that is where paths live", () => {
  const text = "const a = `/phage-hunters/dustin-edwards-2019.webp`;";
  assert.deepEqual(referencesIn(stripComments(text), ASSETS), ["/phage-hunters/dustin-edwards-2019.webp"]);
});

test("stripping preserves newlines, so a stripped block cannot join two lines", () => {
  const text = "/* one\n   two */\nconst a = 1;";
  const stripped = stripComments(text);
  assert.equal((stripped.match(/\n/g) ?? []).length, (text.match(/\n/g) ?? []).length);
});

test("css has block comments and no line comments", () => {
  // `//` is not a comment in CSS, and a naive stripper would eat a data URI.
  const text = '.a { background: url(/dustin-edwards-logo.svg); } /* url(/favicon.ico) */';
  const found = referencesIn(stripComments(text, true), ASSETS);
  assert.deepEqual(found, ["/dustin-edwards-logo.svg"], "the commented one must not count");
});

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
  assert.equal(isSourceFile("public/dustin-edwards-logo.svg"), false);
  assert.equal(isSourceFile("README.md"), false);
});

test("results fold to sorted keys and sorted files, so the artifact is stable", () => {
  const out = foldRefs([
    { file: "app/z.ts", assets: ["/dustin-edwards-logo.svg", "/favicon.ico"] },
    { file: "app/a.ts", assets: ["/dustin-edwards-logo.svg"] },
  ]);
  assert.deepEqual(Object.keys(out.refs), ["/dustin-edwards-logo.svg", "/favicon.ico"]);
  assert.deepEqual(out.refs["/dustin-edwards-logo.svg"], ["app/a.ts", "app/z.ts"]);
  assert.equal(out.generated, 2);
});

test("one file naming one asset twice is recorded once", () => {
  const out = foldRefs([{ file: "app/a.ts", assets: ["/dustin-edwards-logo.svg"] }, { file: "app/a.ts", assets: ["/dustin-edwards-logo.svg"] }]);
  assert.deepEqual(out.refs["/dustin-edwards-logo.svg"], ["app/a.ts"]);
});

test("the self-referential guard beats SOURCE_FILES, which is where it decides", () => {
  /* `SOURCE_FILES` entries are named individually and BYPASS the root rule, so a
   * self-referential file listed there would be read unless the guard runs first. */
  // `content/features.json` IS in SOURCE_FILES and IS read, which is the
  // control: it proves the bypass exists for the guard to beat.
  assert.equal(isSourceFile("content/features.json"), true);
  assert.equal(isSourceFile("content/generated/assets.json"), false);
});
