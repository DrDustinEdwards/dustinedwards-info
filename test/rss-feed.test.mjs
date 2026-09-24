import test from "node:test";
import assert from "node:assert/strict";

import { absolutiseUrls, cdata, escapeXml, rssItem } from "../app/lib/rss-feed.mjs";

const ORIGIN = "https://example.test";

const FULL = {
  slug: "a-post",
  title: "A post about D1 & FTS5",
  html: '<p>Body with <a href="/blog/other">a link</a> and <img src="/media/x.png" alt="x"></p>',
  description: "One sentence about it.",
  publishAt: new Date("2026-08-01T00:00:00.000Z"),
  tags: ["cloudflare", "d1"],
};

test("the item carries the rendered body in content:encoded", () => {
  const item = rssItem(FULL, ORIGIN);
  assert.match(item, /<content:encoded><!\[CDATA\[/);
  assert.match(item, /Body with/);
});

test("the summary stays in description and is NOT the body", () => {
  const item = rssItem(FULL, ORIGIN);
  assert.match(item, /<description>One sentence about it\.<\/description>/);
  // The list view a reader shows must not become the first paragraph of markup.
  assert.doesNotMatch(item, /<description>[^<]*Body with/);
});

test("a row with no rendered html omits the element rather than emitting it empty", () => {
  // An empty content:encoded tells a reader the post IS empty. An absent one
  // tells it to follow the link.
  const item = rssItem({ ...FULL, html: null }, ORIGIN);
  assert.doesNotMatch(item, /content:encoded/);
  assert.match(item, /<link>https:\/\/example\.test\/blog\/a-post<\/link>/);
});

test("a title with an ampersand is escaped, and escaped once", () => {
  const item = rssItem(FULL, ORIGIN);
  assert.match(item, /<title>A post about D1 &amp; FTS5<\/title>/);
  assert.doesNotMatch(item, /&amp;amp;/, "double-escaped");
});

test("CDATA survives a `]]>` inside the content", () => {
  /* A CDATA section ends at the FIRST `]]>`, so content carrying that sequence spills the
   * rest of the post into the document as markup. */
  const source = "before ]]> after";
  const wrapped = cdata(source);
  assert.equal(wrapped, "<![CDATA[before ]]]]><![CDATA[> after]]>");

  /* Read back rather than counted: the repair produces TWO sections, so "the first `]]>` is
   * at the end" is false of the correct output as well as the broken one. */
  const textOf = (/** @type {string} */ xml) =>
    xml
      .split("<![CDATA[")
      .slice(1)
      .map((part) => part.slice(0, part.indexOf("]]>")))
      .join("");

  assert.equal(textOf(wrapped), source, "a reader would not recover the original text");

  /* The control: the naive form loses text, or any wrapper at all would satisfy the above. */
  const naive = `<![CDATA[${source}]]>`;
  assert.notEqual(
    textOf(naive),
    source,
    "the naive form no longer loses text, so this case does not discriminate",
  );
  assert.equal(textOf(naive), "before ", "the naive form loses everything after the sequence");
});

test("CDATA leaves ordinary content alone", () => {
  assert.equal(cdata("<p>plain</p>"), "<![CDATA[<p>plain</p>]]>");
});

/* ------------------------------------------------------------------- URLs */

test("root-relative href and src become absolute", () => {
  const out = absolutiseUrls(
    '<a href="/blog/x">x</a><img src="/media/y.png">',
    ORIGIN,
  );
  assert.match(out, /href="https:\/\/example\.test\/blog\/x"/);
  assert.match(out, /src="https:\/\/example\.test\/media\/y\.png"/);
});

test("srcset candidates are absolutised, all of them", () => {
  const out = absolutiseUrls(
    '<img srcset="/media/a.png 320w, /media/b.png 640w" src="/media/a.png">',
    ORIGIN,
  );
  assert.equal(
    (out.match(/https:\/\/example\.test\/media\//g) ?? []).length,
    3,
    "a candidate was left relative, and a reader would fetch it from its own host",
  );
});

test("absolute and protocol-relative URLs are left alone", () => {
  const input =
    '<a href="https://elsewhere.test/x">x</a><a href="//cdn.test/y">y</a>' +
    '<a href="mailto:someone@example.test">z</a>';
  assert.equal(absolutiseUrls(input, ORIGIN), input);
});

test("a fragment or a query-only href is left alone", () => {
  // Heading permalinks are `#anchor`. Rewriting one would send a reader to the
  // site root instead of to the heading they clicked.
  const input = '<a href="#a-heading">jump</a>';
  assert.equal(absolutiseUrls(input, ORIGIN), input);
});

test("the item's body is absolutised, which is the whole point of the pass", () => {
  const item = rssItem(FULL, ORIGIN);
  assert.match(item, /href="https:\/\/example\.test\/blog\/other"/);
  assert.match(item, /src="https:\/\/example\.test\/media\/x\.png"/);
  assert.doesNotMatch(item, /src="\/media/, "a root-relative src reached the feed");
});

/* ------------------------------------------------------- shared machinery */

test("escapeXml handles all five entities and nothing else", () => {
  assert.equal(escapeXml(`&<>"'`), "&amp;&lt;&gt;&quot;&apos;");
  assert.equal(escapeXml("plain text"), "plain text");
});
