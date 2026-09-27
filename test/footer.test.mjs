import test from "node:test";
import assert from "node:assert/strict";

import { declaredRouteModules } from "../scripts/lib/features/anchors.mjs";
import { FOOTER_COLUMNS, PRIVATE_TOOLS, footerHrefs } from "../app/lib/footer.ts";
import { OWNER_PROFILES } from "../app/lib/seo.ts";

test("every internal footer link is a route app/routes.ts declares", async () => {
  const routes = await declaredRouteModules();
  const missing = footerHrefs()
    .filter((link) => !link.external)
    .map((link) => link.to)
    .filter((to) => !routes.has(to.split("#")[0]));
  assert.deepEqual(missing, [], "a footer link with no route answers 404");
});

test("the columns are the first pass's five, with no Students column and no old /phage-discovery", () => {
  assert.deepEqual(
    FOOTER_COLUMNS.map((column) => column.heading),
    ["Research", "Teaching", "Writing", "Profiles", "Site"],
  );
  const hrefs = footerHrefs().map((link) => link.to);
  assert.ok(!hrefs.includes("/phage-discovery"));
  assert.ok(hrefs.includes("/teaching/phage-discovery"));
  // The site's own contact page, not the faculty page.
  assert.ok(hrefs.includes("/contact"));
  assert.ok(!hrefs.some((to) => to.includes("faculty.tarleton.edu")));
});

test("profile links are plain text, and rel=me marks exactly the owner's profiles", () => {
  const profiles = FOOTER_COLUMNS.find((column) => column.id === "profiles");
  assert.ok(profiles);
  assert.deepEqual(
    profiles.items.map((item) => ("label" in item ? item.label : "")),
    ["Google Scholar", "ORCID", "PubMed", "X"],
  );
  const me = footerHrefs().filter((link) => link.me).map((link) => link.to);
  assert.deepEqual([...me].sort(), [...OWNER_PROFILES].sort());
});

test("the private tools are Carrel, Admin and Console, with Admin on this site's sign-in", () => {
  assert.deepEqual(
    PRIVATE_TOOLS.map((tool) => [tool.label, tool.icon]),
    [
      ["Carrel", "lamp"],
      ["Admin", "padlock"],
      ["Console", "capsid"],
    ],
  );
  assert.equal(PRIVATE_TOOLS.find((tool) => tool.label === "Admin")?.to, "/login");
});
