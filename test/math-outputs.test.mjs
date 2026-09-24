/* KaTeX's `htmlAndMathml` output is two trees legible only with `katex.css`, so a feed reader
 * shows the expression twice and garbled. The fixtures are real KaTeX output, not transcribed. */

import test from "node:test";
import assert from "node:assert/strict";

import katex from "katex";

import { atomEntry } from "../app/lib/atom-feed.mjs";
import { KATEX_OPTIONS } from "../app/lib/content/math.mjs";
import { mathToTex, rssItem } from "../app/lib/rss-feed.mjs";

const ORIGIN = "https://example.test";

/** @param {string} tex @param {boolean} display */
const render = (tex, display) =>
  katex.renderToString(tex, { ...KATEX_OPTIONS, displayMode: display, throwOnError: true });

/** @param {string} html */
const row = (html) => ({
  slug: "a-post",
  title: "A post",
  html,
  description: "One sentence about it.",
  publishAt: new Date("2026-08-01T00:00:00.000Z"),
  updatedAt: new Date("2026-08-01T00:00:00.000Z"),
  tags: ["cloudflare"],
});

test("an inline expression becomes its own TeX between single dollars", () => {
  const out = mathToTex(`<p>Energy is ${render("E = mc^2", false)} exactly.</p>`);
  assert.equal(out, "<p>Energy is $E = mc^2$ exactly.</p>");
});

test("a display expression becomes double dollars, wrapper and all", () => {
  const out = mathToTex(render("a + b", true));
  assert.equal(out, "$$a + b$$");
  // The `katex-display` wrapper is OUTSIDE the `katex` span, so a scan that
  // found the inner one first would leave an empty wrapper around the result.
  assert.doesNotMatch(out, /katex/);
});

test("nothing of KaTeX survives: no spans, no MathML, no annotation", () => {
  const out = mathToTex(
    `<p>${render("\\frac{1}{2}", false)}</p>${render("\\sum_{i=1}^{n} x_i", true)}`,
  );
  assert.doesNotMatch(out, /katex/);
  assert.doesNotMatch(out, /<math/);
  assert.doesNotMatch(out, /annotation/);
  assert.doesNotMatch(out, /<span/);
});

test("an escaped `<` stays escaped, because the item is parsed as HTML", () => {
  // KaTeX writes `a < b` into the annotation as `a &lt; b`. Unescaping it on
  // the way out would put a stray `<` into somebody else's document.
  const out = mathToTex(render("a < b", false));
  assert.equal(out, "$a &lt; b$");
  assert.doesNotMatch(out, /\$a < b\$/);
});

test("surrounding markup is untouched, byte for byte", () => {
  const before = '<p>Before <a href="/blog/x">a link</a></p>';
  const after = '<p><img src="/media/y.png" alt="y"> after</p>';
  const out = mathToTex(`${before}${render("x", false)}${after}`);
  assert.equal(out, `${before}$x$${after}`);
});

test("a body with no math is returned byte-identical", () => {
  const html = '<p>A post about <code>katex</code> and the class="katex" idea.</p>';
  assert.equal(mathToTex(html), html);
});

test("an unterminated wrapper is left alone rather than half-rewritten", () => {
  // Cannot come out of this pipeline; the point is which way it fails.
  const broken = '<p>x <span class="katex"><span class="katex-mathml">y</p>';
  assert.equal(mathToTex(broken), broken);
});

test("a katex span carrying no annotation is left alone", () => {
  const noAnnotation = '<p><span class="katex"><span>nothing to recover</span></span></p>';
  assert.equal(mathToTex(noAnnotation), noAnnotation);
});

test("the RSS item carries the TeX and none of the markup", () => {
  const item = rssItem(row(`<p>${render("E = mc^2", false)}</p>`), ORIGIN);
  assert.match(item, /<content:encoded><!\[CDATA\[<p>\$E = mc\^2\$<\/p>\]\]><\/content:encoded>/);
  assert.doesNotMatch(item, /katex/);
});

test("the Atom entry carries the TeX and none of the markup", () => {
  const entry = atomEntry(row(`<p>${render("E = mc^2", false)}</p>`), ORIGIN);
  assert.match(entry, /<content type="html"><!\[CDATA\[<p>\$E = mc\^2\$<\/p>\]\]><\/content>/);
  assert.doesNotMatch(entry, /katex/);
});

test("absolutising still runs on the body around the math", () => {
  // Both passes on one body, which is what the feeds actually do. A transform
  // that consumed the whole string would silently drop the other pass.
  const item = rssItem(
    row(`<p><img src="/media/x.png" alt="x">${render("x", false)}</p>`),
    ORIGIN,
  );
  assert.match(item, /src="https:\/\/example\.test\/media\/x\.png"/);
  assert.match(item, /\$x\$/);
});
