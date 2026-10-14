import test from "node:test";
import assert from "node:assert/strict";

import { personNode } from "../app/lib/seo.ts";
import { IDENTITY } from "../app/lib/identity.generated.mjs";
import { bundleRenderer } from "./lib/render-bundle.mjs";

const { render } = await bundleRenderer(`
  import { createElement as h } from "react";
  import { renderToString } from "react-dom/server";
  import { HomeIntro } from "~/components/home-intro";
  export const render = () => renderToString(h(HomeIntro));
`);

/** The text of the element with `class`, entities decoded the way a reader sees them. */
function textOf(html, className) {
  const match = html.match(new RegExp(`<span class="${className}">([^<]*)</span>`));
  assert.ok(match, `the hero has no .${className}`);
  return match[1].replaceAll("&amp;", "&");
}

await test("the home hero states the whole organization, the university and its system", () => {
  const html = render();
  assert.equal(textOf(html, "p-org"), "Tarleton State University, Texas A&M University System");
  assert.equal(textOf(html, "p-org"), IDENTITY.org);
  assert.match(html, /Texas A&amp;M University System/);
});

await test("the hero keeps the role and department, and the Person record keeps the short university in worksFor", () => {
  const html = render();
  assert.equal(textOf(html, "p-job-title"), IDENTITY.role);
  assert.match(html, new RegExp(IDENTITY.department));
  // Structured data needs the one literal university, not the system line.
  const person = personNode("https://example.test");
  assert.equal(person.worksFor.name, "Tarleton State University");
  assert.doesNotMatch(JSON.stringify(person.worksFor), /Texas A&M/);
});
