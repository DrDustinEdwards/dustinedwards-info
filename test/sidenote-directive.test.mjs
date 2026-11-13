/* The note must stay in the prose flow as a sibling of its paragraph and the stylesheet floats
 * it into the rail; hoisting it elsewhere would need script to measure its alignment. */

import test from "node:test";
import assert from "node:assert/strict";

import { render } from "./lib/render.mjs";

/* Ids added later would mean migrating every published note, so the numbering is asserted. */
await test("notes are numbered per document, in source order", async () => {
  const { html } = await render(
    ':::sidenote{kind="One"}\nA.\n:::\n\nBetween.\n\n:::sidenote{kind="Two"}\nB.\n:::\n',
  );
  assert.match(html, /id="sn-1"/);
  assert.match(html, /id="sn-2"/);
  assert.ok(
    html.indexOf('id="sn-1"') < html.indexOf('id="sn-2"'),
    "numbering follows source order",
  );
});

await test("a note without a kind is a named build error, not an unlabelled box", async () => {
  await assert.rejects(() => render(":::sidenote\nNo label.\n:::\n"), /requires a kind attribute/);
});

await test("a heading inside a note is refused: the rail is not where a section goes", async () => {
  await assert.rejects(
    () => render(':::sidenote{kind="Aside"}\n## A section\n:::\n'),
    /holds a heading/,
  );
});
