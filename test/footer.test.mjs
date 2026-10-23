import test from "node:test";
import assert from "node:assert/strict";

import { declaredRouteModules } from "../scripts/lib/features/anchors.mjs";
import { readFileSync } from "node:fs";

import { SITE_LINKS, SOCIAL_LINKS, footerHrefs, siteLinks } from "../app/lib/footer.ts";
import { PUBLISHED_PAGES } from "../app/lib/published-pages.generated.mjs";
import { readPublishedPages } from "../scripts/lib/published-pages.mjs";
import { OWNER_PROFILES } from "../app/lib/seo.ts";

await test("every internal footer link is a route app/routes.ts declares", async () => {
  const routes = await declaredRouteModules();
  const missing = footerHrefs()
    .filter((link) => !link.external)
    .map((link) => link.to)
    .filter((to) => !routes.has(to.split("#")[0]));
  assert.deepEqual(missing, [], "a footer link with no route answers 404");
});

// Link integrity (search standing), rel=me honesty, and AI access staying invisible.

await test("the footer never links the retired /phage-discovery address", () => {
  const hrefs = footerHrefs().map((link) => link.to);
  assert.ok(!hrefs.includes("/phage-discovery"));
});

await test("nothing in the footer is for machines only (job_5670dd43eef2): agents find these through the head and robots.txt", () => {
  const hrefs = footerHrefs().map((link) => link.to);
  for (const machineOnly of ["/llms.txt", "/llms-full.txt"]) {
    assert.ok(!hrefs.includes(machineOnly), machineOnly);
  }
  assert.ok(!hrefs.some((to) => to.endsWith(".md")), "a markdown twin linked from the footer");
});

await test("rel=me marks exactly the owner's profiles, and never a social link", () => {
  assert.ok(SOCIAL_LINKS.every((link) => !link.me));
  const me = footerHrefs().filter((link) => link.me).map((link) => link.to);
  assert.deepEqual([...me].sort(), [...OWNER_PROFILES].sort());
});

// Dustin, 2026-10-11: the brand block, then Workspace and Site, then the copyright line. These pin his decision.

await test("Accessibility is listed only while its page is published; the other Site links always are", () => {
  const without = siteLinks([]).map((link) => link.to);
  assert.deepEqual(without, ["/contact", "/site-map", "/colophon", "/privacy", "/terms"]);
  assert.ok(siteLinks(["/accessibility"]).some((link) => link.to === "/accessibility"));
  // The footer as built agrees with the page files as they are now.
  assert.deepEqual([...PUBLISHED_PAGES], readPublishedPages(), "published-pages.generated.mjs is stale: run build:content");
  assert.equal(SITE_LINKS.some((link) => link.to === "/accessibility"), PUBLISHED_PAGES.includes("/accessibility"));
});

await test("a page file marked draft is not in the published list", () => {
  const draft = readFileSync(new URL("../content/pages/accessibility.md", import.meta.url), "utf8");
  const isDraft = /^draft: true$/m.test(draft);
  assert.equal(readPublishedPages().includes("/accessibility"), !isDraft);
});
