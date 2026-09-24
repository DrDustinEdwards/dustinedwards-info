/* The heading refusal is the enforceable half of "supplementary material only": a heading is
 * how this site spells a section of the argument (it enters the table of contents). */

import test from "node:test";
import assert from "node:assert/strict";

import { renderBody } from "../app/lib/content/pipeline.mjs";

/** @param {string} body */
const render = (body) => renderBody({ file: "test.md", body, resolveImage: () => null });

test("it renders a native details with the summary first", async () => {
  const { html } = await render(':::details{summary="Raw counts"}\nOne paragraph.\n:::\n');
  assert.match(html, /^<details class="post-details"><summary>Raw counts<\/summary>/);
  assert.match(html, /<p>One paragraph\.<\/p><\/details>/);
});

test("the body text is in the HTML whether or not anything runs", async () => {
  /* The TEXT must be present in a closed disclosure: that is what a reader with no script, a
   * printer and a crawler each get. */
  const { html } = await render(':::details{summary="Methods"}\nThe sample was 400 rows.\n:::\n');
  assert.ok(html.includes("The sample was 400 rows."));
  assert.ok(!html.includes("<details class=\"post-details\" open"));
});

test("a summary is required", async () => {
  await assert.rejects(render(":::details\nx\n:::\n"), /requires a summary attribute/);
});

test("a heading inside is refused, and the message says where", async () => {
  await assert.rejects(
    render(':::details{summary="S"}\n\n## The argument\n\ntext\n:::\n'),
    /holds a heading on line 3/,
  );
});

test("tables, code and lists are all allowed, which is the control on that refusal", async () => {
  /* Without this the heading test proves only that SOMETHING is refused. Supplementary
   * material is mostly data: tables, fences and lists. */
  const { html } = await render(
    ':::details{summary="Data"}\n| a | b |\n| - | - |\n| 1 | 2 |\n\n- one\n- two\n\n```js\nconst x = 1;\n```\n:::\n',
  );
  assert.ok(html.includes("<table>"));
  assert.ok(html.includes("<ul>"));
  assert.ok(html.includes("<pre"));
});

test("prose outside the block is untouched", async () => {
  const { html } = await render('Before.\n\n:::details{summary="S"}\nInside.\n:::\n\nAfter.\n');
  assert.match(html, /^<p>Before\.<\/p>/);
  assert.match(html, /<p>After\.<\/p>\s*$/);
});
