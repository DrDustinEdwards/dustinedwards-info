/* Chrome refuses to prerender while CDP is attached, so nothing can see a prerender activate:
 * the claim here is only that the rules a browser would act on are correct. */

import test from "node:test";
import assert from "node:assert/strict";
import { bundleRenderer } from "./lib/render-bundle.mjs";

import {
  DOCUMENT_ACTION,
  buildSpeculationRules,
} from "../app/lib/speculation.mjs";

/** @param {string} pathname */
const payloadOn = (pathname) => JSON.parse(buildSpeculationRules({ pathname }));

/** @param {string} pathname */
const rulesOn = (pathname) => payloadOn(pathname)[DOCUMENT_ACTION];

/**
 * Object-form patterns render as `search:(.+)`, so one comparison covers both shapes.
 * @param {object[]} rules
 */
function exclusionsIn(rules) {
  return (rules[0].where.and ?? [])
    .filter((clause) => clause.not)
    .map((clause) => {
      const m = clause.not.href_matches;
      return typeof m === "string" ? m : Object.entries(m).map(([k, v]) => `${k}:${v}`).join(",");
    });
}

/** @param {string} pathname */
const exclusions = (pathname) => exclusionsIn(rulesOn(pathname));

const { render: renderHeader } = await bundleRenderer(`
  import { createElement as h } from "react";
  import { renderToString } from "react-dom/server";
  import { createMemoryRouter, RouterProvider } from "react-router";
  import { SiteHeader } from "~/components/site-header";
  export function render(pathname) {
    const router = createMemoryRouter([{ path: "*", element: h(SiteHeader) }], { initialEntries: [pathname] });
    return renderToString(h(RouterProvider, { router }));
  }
`);

/** @param {string} html */
const anchorHrefs = (html) => [...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map((m) => m[1]);

/** @param {string} html */
function renderedRules(html) {
  const m = html.match(/<script type="speculationrules"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(m, "the rendered header carries no speculation rules");
  return JSON.parse(m[1])[DOCUMENT_ACTION];
}

await test("every header link is site-absolute or a full https address, so it resolves the same on every page", () => {
  const hrefs = anchorHrefs(renderHeader("/writing/ten-years-on-cloudflare"));
  assert.ok(hrefs.length >= 5, `the header rendered ${hrefs.length} links`);
  for (const href of hrefs) {
    // Another site is a full https address; everything
    // on this site is a path from the root, never relative.
    if (href.startsWith("https://")) continue;
    assert.match(href, /^\/(?!\/)/, `${href} is neither a site-absolute path nor a full https address`);
  }
});

await test("the brand link goes home, and home is speculated from other pages", () => {
  const html = renderHeader("/writing");
  assert.ok(anchorHrefs(html).includes("/"), "the header has no link to /");
  assert.ok(
    !exclusionsIn(renderedRules(html)).includes("/"),
    "/ is excluded from the rule on /writing, so the brand link would not be speculated",
  );
});

await test("THE ACTION IS PREFETCH, NOT PRERENDER", () => {
  /* A prerender that has not painted is still ACTIVATABLE, and `moderate` starts on
   * pointerdown, so a click with no hover dwell swaps in a blank frame. */
  const payload = payloadOn("/writing");
  assert.deepEqual(Object.keys(payload), ["prefetch"], `payload keys are ${JSON.stringify(Object.keys(payload))}`);
  assert.equal(payload.prerender, undefined, "the payload still carries a prerender rule");
});

await test("THERE IS EXACTLY ONE RULE, and it is a document rule at moderate eagerness", () => {
  /* ONE, deliberately: an `immediate` list rule for the header cost 4 to 5 extra credentialed
   * document requests on every public page load. */
  const rules = rulesOn("/writing");
  assert.equal(rules.length, 1, `expected one rule, got ${JSON.stringify(rules)}`);
  assert.ok(rules[0].where, "the rule is not a document rule");
  assert.ok(!rules[0].urls, "the rule carries a urls list");
  assert.equal(rules[0].eagerness, "moderate");
});

await test("the rule has a positive scope, not only exclusions", () => {
  /* An `and` of only `not` clauses matches every unexcluded link, cross-origin included. The
   * pathname pattern takes its origin from the document, so the rule is same-origin. */
  const positive = rulesOn("/writing")[0].where.and.filter((clause) => clause.href_matches);
  assert.deepEqual(positive, [{ href_matches: "/*" }]);
});

await test("THE CURRENT PAGE IS EXCLUDED FROM ITS OWN RULE", () => {
  /* Self-speculation spends a request that reaches the ORIGIN for any cookied reader, and
   * Chrome caps moderate speculations, so the useless one can evict a useful one. */
  for (const pathname of ["/", "/writing", "/writing/ten-years-on-cloudflare", "/colophon"]) {
    assert.ok(
      exclusions(pathname).includes(pathname),
      `${pathname} is not excluded from its own rule`,
    );
  }
});

await test("the routes that must never be speculated are each named by an exclusion", () => {
  /* Checked against the routes, not the module's own constants, which would agree by
   * construction. `/search/ask` reaches a billed model. */
  const found = exclusions("/writing");
  const MUST_BE_EXCLUDED = [
    "/admin",
    "/admin/*",
    "/api",
    "/api/*",
    "/media",
    "/media/*",
    "/login",
    "/theme",
    "/search/ask",
    "/*.md",
    "/*.xml",
    "/*.json",
    "/*.txt",
  ];
  for (const pattern of MUST_BE_EXCLUDED) {
    assert.ok(found.includes(pattern), `${pattern} is not in the rule's exclusions`);
  }
});

await test("ANY URL CARRYING A QUERY IS EXCLUDED, as a search component", () => {
  /* A pathname pattern cannot see the query string, and the pathname-glob spelling makes
   * Chrome resolve ZERO candidates on every page while looking correct. */
  assert.ok(
    exclusions("/writing").includes("search:(.+)"),
    "the query exclusion is not a search-component pattern",
  );
});

await test("the rules text can never end its script element, whatever the pathname", () => {
  /* Rendered raw and hashed as-is, so the escaping is the only thing between a hostile path and
   * `</script`. A real URL pathname percent-encodes these, which is why this passes one directly. */
  const pathname = "/</script><!--&x";
  const text = buildSpeculationRules({ pathname });
  assert.doesNotMatch(text, /[<>&]/, `unescaped markup characters in ${text}`);
  assert.ok(exclusions(pathname).includes(pathname), "the escaped rules do not parse back to the path");
});
