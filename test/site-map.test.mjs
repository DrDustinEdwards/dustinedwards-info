import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { LIBRARY_BASES } from "../app/kb/libraries.mjs";
import { LAB_PATH } from "../app/kb/registry/catalog.mjs";
import { CONTENT_PAGE_PATHS, CONTENT_PAGES_OWN_ROUTE } from "../app/lib/content-pages.mjs";
import { SITE_MAP_PATH, lineText, sectionOf, siteMapSections } from "../app/lib/site-map.mjs";
import { declaredRouteModules } from "../scripts/lib/features/anchors.mjs";

const read = (/** @type {string} */ rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

/** STATIC_PAGES' paths, read off the source: the module imports through the app's `~` alias, which plain node cannot. */
function staticPaths() {
  const source = read("../app/lib/site-urls.server.ts");
  const block = source.slice(source.indexOf("export const STATIC_PAGES"), source.indexOf("] as const;"));
  return [...block.matchAll(/path: "([^"]+)"/g)].map((m) => m[1]);
}

const tally = (/** @type {string} */ key, /** @type {string} */ label, /** @type {string} */ to, merge = true) => ({ key, label, to, merge });

await test("both the XML sitemap and the site map page are drawn from the one shared list", () => {
  const xml = read("../app/routes/sitemap.ts");
  const page = read("../app/routes/site-map.tsx");
  for (const [name, source] of [["sitemap.ts", xml], ["site-map.tsx", page]]) {
    assert.match(source, /gatherSiteUrls\(getEnv\(context\)\)/, `${name} calls gatherSiteUrls`);
    // No second list: neither route reads the tables itself.
    assert.doesNotMatch(source, /from "~\/db/, `${name} reads D1 only through gatherSiteUrls`);
  }
});

await test("the site map page is in sitemap.xml, at the address routes.ts gives it", async () => {
  assert.equal(SITE_MAP_PATH, "/site-map");
  assert.ok(staticPaths().includes(SITE_MAP_PATH));
  assert.ok((await declaredRouteModules()).has(SITE_MAP_PATH));
});

/**
 * Public page routes the sitemap leaves out on purpose, each with its reason. Anything else routes.ts declares
 * as a page must be listed by gatherSiteUrls, so a new page cannot be left out of both maps by forgetting.
 */
const EXEMPT = new Map([
  ["/gone", "the 410 page for removed WordPress addresses, never a destination"],
  ["/search", "a results page, different for every query"],
  ["/search/ask", "a streamed answer, not a page"],
  ["/theme", "the theme switch's form target"],
  ["/webmention", "the webmention endpoint"],
  ["/login", "forwards to /admin"],
  ["/health", "the uptime probe's JSON, not a page"],
  ["/csp-report", "the CSP and Reporting API sink, a POST endpoint"],
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
    (path) => !/[:*]/.test(path) && !/\.[a-z]+$/.test(path) && !/^\/(admin|lab-bench|api)(\/|$)/.test(path),
  );
  const missing = routes.filter((path) => !listed.has(path) && !EXEMPT.has(path));
  assert.deepEqual(missing, [], "a page route neither listed by app/lib/site-urls.server.ts nor exempted here");
  const stale = [...EXEMPT.keys()].filter((path) => !routes.includes(path));
  assert.deepEqual(stale, [], "an exemption for a route routes.ts no longer declares");
});

await test("a path goes to the section that owns its root, and anything else to Site", () => {
  assert.equal(sectionOf("/research/tools/titer"), "research");
  assert.equal(sectionOf("/systems"), "software");
  assert.equal(sectionOf("/software/how-tos"), "software");
  assert.equal(sectionOf("/recipes"), "about");
  assert.equal(sectionOf("/cv"), "about");
  assert.equal(sectionOf("/writing/tags/x"), "writing");
  assert.equal(sectionOf("/"), "site");
  assert.equal(sectionOf("/privacy"), "site");
  assert.equal(sectionOf("/researcher"), "site", "a root matches whole segments only");
});

await test("papers, registry items, procedures, posts and tags collapse to one counted line each", () => {
  const none = null;
  const papers = tally("papers", "Publications", "/research/publications");
  const posts = tally("posts", "Articles", "/writing");
  const tags = tally("tags", "Tags", "/writing", false);
  const protocols = tally("procedures:protocols", "Protocols", "/research/protocols");
  const sections = siteMapSections([
    { path: "/", lastmod: none, title: "Home" },
    { path: "/writing", lastmod: none, title: "Articles" },
    { path: "/research/publications", lastmod: none, title: "Publications" },
    { path: "/research", lastmod: none, title: "Research" },
    { path: "/research/protocols", lastmod: none, title: "Protocol library" },
    { path: "/research/publications/a/", lastmod: none, title: "Paper A", tally: papers },
    { path: "/research/publications/b/", lastmod: none, title: "Paper B", tally: papers },
    { path: "/research/protocols/x", lastmod: none, title: "X", tally: protocols },
    { path: "/writing/one", lastmod: none, title: "One", tally: posts },
    { path: "/writing/two", lastmod: none, title: "Two", tally: posts },
    { path: "/writing/tags/a", lastmod: none, title: "a", tally: tags },
    { path: "/writing/tags/b", lastmod: none, title: "b", tally: tags },
    { path: "/writing/tags/c", lastmod: none, title: "c", tally: tags },
    { path: "/writing/series/s", lastmod: none, title: "A series" },
    { path: "/privacy", lastmod: none, title: "Privacy" },
  ]);
  const shown = Object.fromEntries(sections.map((s) => [s.id, s.lines.map((line) => [lineText(line), line.plain ? "(text)" : line.to])]));
  assert.deepEqual(shown, {
    // The hub first, then the list's order (a count with no index of its own last); the counts sit on the index's own line.
    research: [
      ["Research", "/research"],
      ["Publications (2)", "/research/publications"],
      ["Protocol library (1)", "/research/protocols"],
    ],
    // Tags have no index of their own, so their count is its own line, as plain text. Series are pages.
    writing: [
      ["Articles (2)", "/writing"],
      ["A series", "/writing/series/s"],
      ["Tags (3)", "(text)"],
    ],
    site: [
      ["Home", "/"],
      ["Privacy", "/privacy"],
    ],
  });
});

await test("a counted kind whose index is not listed still gets its line", () => {
  const sections = siteMapSections([
    { path: "/recipes/bread", lastmod: null, title: "Bread", tally: tally("procedures:recipes", "Recipes", "/recipes") },
  ]);
  assert.deepEqual(sections, [{ id: "about", heading: "About", to: "/about", lines: [{ to: "/recipes", label: "Recipes", count: 1 }] }]);
});
