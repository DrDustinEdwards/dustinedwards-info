/* Chrome refuses to prerender while CDP is attached, so nothing can see a prerender activate:
 * the claim here is only that the rules a browser would act on are correct. */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { build } from "vite";

import { enhancePlugin } from "../scripts/lib/enhance-bundle.mjs";

import {
  DOCUMENT_ACTION,
  buildSpeculationRules,
} from "../app/lib/speculation.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

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

/*
 * The header is TSX behind `~/` imports and `?url` assets, so Vite bundles it
 * here with the React that renders it, and the bundle is imported from disk.
 */
const ENTRY = "virtual:header-render";
const built = await build({
  configFile: false,
  root,
  logLevel: "silent",
  mode: "production",
  resolve: { alias: [{ find: /^~\//, replacement: `${join(root, "app")}/` }] },
  ssr: { noExternal: true },
  plugins: [
    // The header renders <Enhance module="header">, which reads its URL from `virtual:enhance`.
    enhancePlugin(),
    {
      name: "header-render-entry",
      enforce: "pre",
      resolveId: (id) => (id === ENTRY ? `\0${ENTRY}` : null),
      load: (id) =>
        id === `\0${ENTRY}`
          ? `
            import { createElement as h } from "react";
            import { renderToString } from "react-dom/server";
            import { createMemoryRouter, RouterProvider } from "react-router";
            import { SiteHeader } from "~/components/site-header";
            export function render(pathname) {
              const router = createMemoryRouter([{ path: "*", element: h(SiteHeader) }], {
                initialEntries: [pathname],
              });
              return renderToString(h(RouterProvider, { router }));
            }`
          : null,
    },
  ],
  build: {
    write: false,
    ssr: true,
    minify: false,
    rollupOptions: { input: ENTRY, output: { format: "esm", codeSplitting: false } },
  },
});
const chunk = (Array.isArray(built) ? built[0] : built).output.find((o) => o.type === "chunk");
const bundleDir = mkdtempSync(join(tmpdir(), "header-render-"));
writeFileSync(join(bundleDir, "header.mjs"), chunk.code);
const { render: renderHeader } = await import(pathToFileURL(join(bundleDir, "header.mjs")).href);
rmSync(bundleDir, { recursive: true, force: true });

/** @param {string} html */
const anchorHrefs = (html) => [...html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)].map((m) => m[1]);

/** @param {string} html */
function renderedRules(html) {
  const m = html.match(/<script type="speculationrules"[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(m, "the rendered header carries no speculation rules");
  return JSON.parse(m[1])[DOCUMENT_ACTION];
}

test("every header link is site-absolute, so it resolves the same on every page", () => {
  const hrefs = anchorHrefs(renderHeader("/blog/ten-years-on-cloudflare"));
  assert.ok(hrefs.length >= 5, `the header rendered ${hrefs.length} links`);
  for (const href of hrefs) {
    assert.match(href, /^\/(?!\/)/, `${href} is not a site-absolute path`);
  }
});

test("the brand link goes home, and home is speculated from other pages", () => {
  const html = renderHeader("/blog");
  assert.ok(anchorHrefs(html).includes("/"), "the header has no link to /");
  assert.ok(
    !exclusionsIn(renderedRules(html)).includes("/"),
    "/ is excluded from the rule on /blog, so the brand link would not be speculated",
  );
});

test("THE ACTION IS PREFETCH, NOT PRERENDER", () => {
  /* A prerender that has not painted is still ACTIVATABLE, and `moderate` starts on
   * pointerdown, so a click with no hover dwell swaps in a blank frame. */
  const payload = payloadOn("/blog");
  assert.deepEqual(Object.keys(payload), ["prefetch"], `payload keys are ${JSON.stringify(Object.keys(payload))}`);
  assert.equal(payload.prerender, undefined, "the payload still carries a prerender rule");
});

test("THERE IS EXACTLY ONE RULE, and it is a document rule at moderate eagerness", () => {
  /* ONE, deliberately: an `immediate` list rule for the header cost 4 to 5 extra credentialed
   * document requests on every public page load. */
  const rules = rulesOn("/blog");
  assert.equal(rules.length, 1, `expected one rule, got ${JSON.stringify(rules)}`);
  assert.ok(rules[0].where, "the rule is not a document rule");
  assert.ok(!rules[0].urls, "the rule carries a urls list");
  assert.equal(rules[0].eagerness, "moderate");
});

test("the rule has a positive scope, not only exclusions", () => {
  /* An `and` of only `not` clauses matches every unexcluded link, cross-origin included. The
   * pathname pattern takes its origin from the document, so the rule is same-origin. */
  const positive = rulesOn("/blog")[0].where.and.filter((clause) => clause.href_matches);
  assert.deepEqual(positive, [{ href_matches: "/*" }]);
});

test("THE CURRENT PAGE IS EXCLUDED FROM ITS OWN RULE", () => {
  /* Self-speculation spends a request that reaches the ORIGIN for any cookied reader, and
   * Chrome caps moderate speculations, so the useless one can evict a useful one. */
  for (const pathname of ["/", "/blog", "/blog/ten-years-on-cloudflare", "/colophon"]) {
    assert.ok(
      exclusions(pathname).includes(pathname),
      `${pathname} is not excluded from its own rule`,
    );
  }
});

test("the routes that must never be speculated are each named by an exclusion", () => {
  /* Checked against the routes, not the module's own constants, which would agree by
   * construction. `/search/ask` reaches a billed model. */
  const found = exclusions("/blog");
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

test("ANY URL CARRYING A QUERY IS EXCLUDED, as a search component", () => {
  /* A pathname pattern cannot see the query string, and the pathname-glob spelling makes
   * Chrome resolve ZERO candidates on every page while looking correct. */
  assert.ok(
    exclusions("/blog").includes("search:(.+)"),
    "the query exclusion is not a search-component pattern",
  );
});
