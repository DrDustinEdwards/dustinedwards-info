import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { LIBRARY_BASES } from "../app/kb/libraries.mjs";
import { LAB_PATH } from "../app/kb/registry/catalog.mjs";
import { CONTENT_PAGE_PATHS, CONTENT_PAGES_OWN_ROUTE } from "../app/lib/content-pages.mjs";

import { declaredRouteModules } from "../scripts/lib/features/anchors.mjs";

const read = (/** @type {string} */ rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

/** STATIC_PAGES' paths, read off the source: the module imports through the app's `~` alias, which plain node cannot. */
function staticPaths() {
  const source = read("../app/lib/site-urls.server.ts");
  const block = source.slice(
    source.indexOf("export const STATIC_PAGES"),
    source.indexOf("] as const;"),
  );
  return [...block.matchAll(/path: "([^"]+)"/g)].map((m) => m[1]);
}

/**
 * Public page routes the sitemap leaves out on purpose, each with its reason. Anything else routes.ts declares
 * as a page must be listed by gatherSiteUrls, so a new page cannot be left out of both maps by forgetting.
 */
const EXEMPT = new Map([
  ["/ads/random", "a 302 to a random ad of the noindex ad gallery, never a destination"],
  ["/gone", "the 410 page for removed WordPress addresses, never a destination"],
  ["/search", "a results page, different for every query"],
  ["/search/ask", "a streamed answer, not a page"],
  ["/theme", "the theme switch's form target"],
  ["/webmention", "the webmention endpoint"],
  ["/login", "forwards to /admin"],
  ["/health", "the uptime probe's JSON, not a page"],
]);

await test("every public page route is in the sitemap's list or exempted by name with a reason", async () => {
  const listed = new Set([
    ...staticPaths(),
    ...CONTENT_PAGE_PATHS,
    ...CONTENT_PAGES_OWN_ROUTE,
    ...LIBRARY_BASES.map((base) => base.library),
    LAB_PATH,
  ]);
  const routes = [...(await declaredRouteModules()).keys()].filter(
    (path) =>
      !/[:*]/.test(path) && !/\.[a-z]+$/.test(path) && !/^\/(admin|lab-bench|api)(\/|$)/.test(path),
  );
  const missing = routes.filter((path) => !listed.has(path) && !EXEMPT.has(path));
  assert.deepEqual(
    missing,
    [],
    "a page route neither listed by app/lib/site-urls.server.ts nor exempted here",
  );
  const stale = [...EXEMPT.keys()].filter((path) => !routes.includes(path));
  assert.deepEqual(stale, [], "an exemption for a route routes.ts no longer declares");
});
