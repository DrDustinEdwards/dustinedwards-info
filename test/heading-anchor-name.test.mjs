/* A heading's permalink is named by its heading (WCAG 2.4.4), so a screen reader's links list tells
 * the anchors apart instead of reading the same phrase for every section. */

import test from "node:test";
import assert from "node:assert/strict";

import { render } from "./lib/render.mjs";

test("each heading anchor is named by its own heading, without the # it appends", async () => {
  const { html } = await render("## Measured results\n\nText.\n\n### Why it held\n\nMore.\n");
  const labels = [...html.matchAll(/class="heading-anchor"[^>]*aria-label="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(labels, ["Link to section: Measured results", "Link to section: Why it held"]);
});
