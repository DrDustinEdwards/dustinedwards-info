/**
 * The speculation rules: the payload a browser will parse, and the header links
 * those rules act on.
 *
 * The payload comes from `app/lib/speculation.mjs`, which is plain ESM, so the
 * rule assertions are about the object a browser will parse. The header half
 * renders the real `SiteHeader` to a string, because the rules are DOCUMENT
 * rules: a header link is speculated because it is an `<a href>` in the page.
 *
 * ## OBSERVATION BOUNDARY
 *
 * This does not drive a browser, so it cannot see whether Chrome ACCEPTS the
 * rules. `check:browser` owns that on a real page, and it is where a malformed
 * `href_matches` shows up. The nonce half is `check:headers`.
 *
 * **AND NOTHING HERE OR ANYWHERE CAN SEE A PRERENDER ACTIVATE.** Chrome refuses
 * to prerender while CDP is attached, so the whole gated claim is "the rules a
 * browser would act on are correct", never "the browser acted".
 *
 * @see app/lib/nav.ts, app/lib/speculation.mjs, app/components/site-header.tsx
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

import { build } from "vite";

import {
  DOCUMENT_ACTION,
  DOCUMENT_EAGERNESS,
  buildSpeculationRules,
} from "../app/lib/speculation.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The whole payload for one page, so the ACTION KEY itself is assertable. */
/** @param {string} pathname */
const payloadOn = (pathname) => JSON.parse(buildSpeculationRules({ pathname }));

/** @param {string} pathname */
const rulesOn = (pathname) => payloadOn(pathname)[DOCUMENT_ACTION];

/**
 * Every `href_matches` pattern under a `not`, as a comparable string.
 * Object-form patterns render as `search:(.+)`, so one comparison covers both
 * shapes and a spelling change from one to the other cannot pass silently.
 *
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

/** The speculation rules the rendered header carries. @param {string} html */
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
  /*
   * The action is the whole of the 2026-08-28 navigation-blink fix and it is the
   * one thing here a well-meaning change would put back.
   *
   * A prerender that has not painted is still ACTIVATABLE, and `moderate` starts
   * the speculation on pointerdown, so a click with no hover dwell swaps in an
   * empty frame host and the reader gets the themed canvas instead of the paint
   * hold. Measured on production by screen capture with no CDP: fourteen runs,
   * both themes, seven with prerendering on and seven with it off at the
   * browser. All seven prerendering runs showed blank frames at 100% of the
   * `--bg` token with a luma standard deviation of zero. None of the other seven
   * did.
   *
   * The action is asserted as the payload's own KEY, not as a property of a rule
   * object, because that key is what selects the browser's behavior.
   */
  const payload = payloadOn("/blog");
  assert.equal(DOCUMENT_ACTION, "prefetch");
  assert.deepEqual(Object.keys(payload), ["prefetch"], `payload keys are ${JSON.stringify(Object.keys(payload))}`);
  assert.equal(payload.prerender, undefined, "the payload still carries a prerender rule");
});

test("THERE IS EXACTLY ONE RULE, and it is a document rule at moderate eagerness", () => {
  /*
   * ONE, deliberately. An `immediate` list rule for the header's destinations
   * was built and measured on 2026-08-28: it cost 4 to 5 extra credentialed
   * document requests on every public page load, and Dustin reverted it. Two
   * rules reappearing means that decision was undone, which deserves a stop
   * rather than a silent 5x on origin requests.
   */
  const rules = rulesOn("/blog");
  assert.equal(rules.length, 1, `expected one rule, got ${JSON.stringify(rules)}`);
  assert.ok(rules[0].where, "the rule is not a document rule");
  assert.ok(!rules[0].urls, "the rule carries a urls list");
  assert.equal(rules[0].eagerness, DOCUMENT_EAGERNESS);
  assert.equal(DOCUMENT_EAGERNESS, "moderate");
});

test("the rule has a positive scope, not only exclusions", () => {
  /*
   * An `and` of nothing but `not` clauses matches every link the exclusions do
   * not name, INCLUDING cross-origin ones, and reads as a tighter rule than it
   * is. The positive clause is a pathname pattern, so it takes its origin from
   * the document and makes the rule same-origin by construction.
   */
  const positive = rulesOn("/blog")[0].where.and.filter((clause) => clause.href_matches);
  assert.deepEqual(positive, [{ href_matches: "/*" }]);
});

test("THE CURRENT PAGE IS EXCLUDED FROM ITS OWN RULE", () => {
  /*
   * A page that speculates itself spends a request on a navigation that cannot
   * happen, and on this site that request reaches the ORIGIN for any reader
   * carrying a cookie. Chrome caps moderate speculations, so the useless one
   * can evict a useful one.
   */
  for (const pathname of ["/", "/blog", "/blog/ten-years-on-cloudflare", "/colophon"]) {
    assert.ok(
      exclusions(pathname).includes(pathname),
      `${pathname} is not excluded from its own rule`,
    );
  }
});

test("the routes that must never be speculated are each named by an exclusion", () => {
  /*
   * Checked against the routes the exclusions exist for, not against the
   * module's own constants, which would agree by construction.
   *
   * `/search/ask` is the expensive one. It reaches a billed model, so
   * speculating it spends money on a click nobody made.
   */
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
  /*
   * A pathname pattern cannot see the query string, and the pathname-glob
   * spelling of this exclusion was PLANTED on 2026-08-28: Chrome then resolved
   * ZERO candidates on every page, so it does not leak queries, it collapses
   * the whole rule. The wrong spelling looks correct and fails silently, which
   * is why the assertion is on the component rather than on behavior.
   */
  assert.ok(
    exclusions("/blog").includes("search:(.+)"),
    "the query exclusion is not a search-component pattern",
  );
});
