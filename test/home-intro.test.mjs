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

/** The text of the element with `class`, tags taken off and entities decoded the way a reader sees them. */
function textOf(html, className) {
  const match = html.match(new RegExp(`<span class="${className}">((?:[^<]|<span[^>]*>[^<]*</span>)*)</span>`));
  assert.ok(match, `the hero has no .${className}`);
  return match[1].replace(/<[^>]+>/g, "").replaceAll("&amp;", "&");
}

await test("the home hero states the whole organization, the university and its system", () => {
  const html = render();
  // Machines read the same fact as the CV's line, comma included, though a reader sees two lines.
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

test("the hero sets the organization on two lines, the university then its system, split from the CV's own line", () => {
  const html = render();
  const lines = [...html.matchAll(/<span class="org-line">([^<]*)<\/span>/g)].map((m) => m[1].replaceAll("&amp;", "&"));
  const [first, ...rest] = IDENTITY.org.split(",");
  assert.deepEqual(lines, [first.trim(), rest.join(",").trim()]);
  assert.equal(lines.length, 2);
  // One p-org element holds both lines, so the h-card still has a single organization.
  assert.equal(html.match(/class="p-org"/g)?.length, 1);
});
