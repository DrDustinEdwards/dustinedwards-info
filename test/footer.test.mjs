import test from "node:test";
import assert from "node:assert/strict";

import { declaredRouteModules } from "../scripts/lib/features/anchors.mjs";
import { readFileSync } from "node:fs";

import { familyLinks } from "capsomer/behavior/family-footer";
import { PUBLISHED_PAGES } from "../app/lib/published-pages.generated.mjs";
import { readPublishedPages } from "../scripts/lib/published-pages.mjs";

await test("every internal footer link is a route app/routes.ts declares", async () => {
  const routes = await declaredRouteModules();
  const missing = familyLinks(PUBLISHED_PAGES)
    .filter((link) => !link.external)
    .map((link) => link.to)
    .filter((to) => !routes.has(to.split("#")[0]));
  assert.deepEqual(missing, [], "a footer link with no route answers 404");
});

await test("a page file marked draft is not in the published list", () => {
  const draft = readFileSync(new URL("../content/pages/accessibility.md", import.meta.url), "utf8");
  const isDraft = /^draft: true$/m.test(draft);
  assert.equal(readPublishedPages().includes("/accessibility"), !isDraft);
});
