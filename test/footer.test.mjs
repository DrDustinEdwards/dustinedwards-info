import test from "node:test";
import assert from "node:assert/strict";

import { declaredRouteModules } from "../scripts/lib/features/anchors.mjs";
import { readFileSync } from "node:fs";

import { BRAND_PROFILES, PRIVATE_TOOLS, SITE_LINKS, SITE_LINKS_ALL, SOCIAL_LINKS, footerHrefs, siteLinks } from "../app/lib/footer.ts";
import { PUBLISHED_PAGES } from "../app/lib/published-pages.generated.mjs";
import { readPublishedPages } from "../scripts/lib/published-pages.mjs";
import { OWNER_PROFILES } from "../app/lib/seo.ts";

test("every internal footer link is a route app/routes.ts declares", async () => {
  const routes = await declaredRouteModules();
  const missing = footerHrefs()
    .filter((link) => !link.external)
    .map((link) => link.to)
    .filter((to) => !routes.has(to.split("#")[0]));
  assert.deepEqual(missing, [], "a footer link with no route answers 404");
});

// Link integrity (search standing), rel=me honesty, and AI access staying invisible.

test("the footer never links the retired /phage-discovery address", () => {
  const hrefs = footerHrefs().map((link) => link.to);
  assert.ok(!hrefs.includes("/phage-discovery"));
});

test("nothing in the footer is for machines only (job_5670dd43eef2): agents find these through the head and robots.txt", () => {
  const hrefs = footerHrefs().map((link) => link.to);
  for (const machineOnly of ["/llms.txt", "/llms-full.txt"]) {
    assert.ok(!hrefs.includes(machineOnly), machineOnly);
  }
  assert.ok(!hrefs.some((to) => to.endsWith(".md")), "a markdown twin linked from the footer");
});

test("rel=me marks exactly the owner's profiles, and never a social link", () => {
  assert.ok(SOCIAL_LINKS.every((link) => !link.me));
  const me = footerHrefs().filter((link) => link.me).map((link) => link.to);
  assert.deepEqual([...me].sort(), [...OWNER_PROFILES].sort());
});

// Dustin, 2026-10-11: the brand block, then Workspace and Site, then the copyright line. These pin his decision.

test("the footer has no Research, Teaching, Software or Writing column: the header carries those", () => {
  const source = readFileSync(new URL("../app/lib/footer.ts", import.meta.url), "utf8");
  assert.ok(!/FOOTER_COLUMNS/.test(source));
  const hrefs = footerHrefs().map((link) => link.to);
  for (const gone of ["/research", "/research/publications", "/teaching/phage-discovery", "/software/foxhound", "/writing"]) {
    assert.ok(!hrefs.includes(gone), gone);
  }
});

test("the brand block keeps the social marks and the profiles, adds RSS from the feed route, and nothing else", () => {
  assert.deepEqual(SOCIAL_LINKS.map((link) => link.label), ["Germomics podcast", "X"]);
  assert.deepEqual(BRAND_PROFILES.map((link) => link.label), ["Google Scholar", "PubMed", "ORCID", "RSS"]);
  const rss = BRAND_PROFILES.find((link) => link.label === "RSS");
  const routes = readFileSync(new URL("../app/routes.ts", import.meta.url), "utf8");
  // The href is the route the feed module is registered at, not a guess.
  const declared = /route\("([^"]+)", "routes\/blog\.rss\[\.xml\]\.ts"\)/.exec(routes);
  assert.ok(declared, "routes.ts registers the RSS module");
  assert.equal(rss?.to, `/${declared[1]}`);
  assert.ok(!rss?.me, "the feed is not a profile, so it carries no rel=me");
});

test("the Workspace group lists Admin, Portal and Carrel in that order, each with its icon", () => {
  assert.deepEqual(
    PRIVATE_TOOLS.map((tool) => [tool.label, tool.icon]),
    [["Admin", "gear"], ["Portal", "capsid"], ["Carrel", "lamp"]],
  );
  const portal = PRIVATE_TOOLS.find((tool) => tool.label === "Portal");
  assert.equal(portal?.name, "Capsid Portal (requires sign-in)");
  for (const tool of PRIVATE_TOOLS) assert.ok(tool.name.endsWith("(requires sign-in)"), tool.name);
  assert.equal(portal?.hover, "Capsid Portal");
});

test("the Site group is Contact, Site map, Colophon, Privacy, Terms, Accessibility", () => {
  assert.deepEqual(
    SITE_LINKS_ALL.map((link) => [link.label, link.to]),
    [
      ["Contact", "/contact"],
      ["Site map", "/site-map"],
      ["Colophon", "/colophon"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Accessibility", "/accessibility"],
    ],
  );
});

test("Accessibility is listed only while its page is published; the other Site links always are", () => {
  const without = siteLinks([]).map((link) => link.to);
  assert.deepEqual(without, ["/contact", "/site-map", "/colophon", "/privacy", "/terms"]);
  assert.ok(siteLinks(["/accessibility"]).some((link) => link.to === "/accessibility"));
  // The footer as built agrees with the page files as they are now.
  assert.deepEqual([...PUBLISHED_PAGES], readPublishedPages(), "published-pages.generated.mjs is stale: run build:content");
  assert.equal(SITE_LINKS.some((link) => link.to === "/accessibility"), PUBLISHED_PAGES.includes("/accessibility"));
});

test("a page file marked draft is not in the published list", () => {
  const draft = readFileSync(new URL("../content/pages/accessibility.md", import.meta.url), "utf8");
  const isDraft = /^draft: true$/m.test(draft);
  assert.equal(readPublishedPages().includes("/accessibility"), !isDraft);
});

test("Admin, when the footer lists it, goes to the admin, where Cloudflare Access signs in", () => {
  const admin = PRIVATE_TOOLS.find((tool) => tool.label === "Admin");
  if (admin) assert.equal(admin.to, "/admin");
});

test("the copyright year is computed at render, never hard-coded", () => {
  const source = readFileSync(new URL("../app/components/shell-footer.tsx", import.meta.url), "utf8");
  const start = source.indexOf('className="site-shell-footer-note"');
  const note = source.slice(start, source.indexOf("</p>", start));
  assert.ok(note.includes("{new Date().getFullYear()}"), note);
  assert.deepEqual(note.match(/\b20\d\d\b/g), ["2006"]);
});

test("the bottom line is the copyright and the name, nothing else", () => {
  const source = readFileSync(new URL("../app/components/shell-footer.tsx", import.meta.url), "utf8");
  const start = source.indexOf('className="site-shell-footer-note"');
  const note = source.slice(source.indexOf(">", start) + 1, source.indexOf("</p>", start)).replace(/\s+/g, " ").trim();
  assert.equal(note, "&copy; 2006&ndash;{new Date().getFullYear()} {SITE.name}");
  assert.equal((source.match(/site-shell-footer-note/g) ?? []).length, 1);
});
