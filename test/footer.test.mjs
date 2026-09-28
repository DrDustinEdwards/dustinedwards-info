import test from "node:test";
import assert from "node:assert/strict";

import { declaredRouteModules } from "../scripts/lib/features/anchors.mjs";
import { readFileSync } from "node:fs";

import { FOOTER_COLUMNS, PRIVATE_TOOLS, SOCIAL_LINKS, footerHrefs } from "../app/lib/footer.ts";
import { OWNER_PROFILES } from "../app/lib/seo.ts";

test("every internal footer link is a route app/routes.ts declares", async () => {
  const routes = await declaredRouteModules();
  const missing = footerHrefs()
    .filter((link) => !link.external)
    .map((link) => link.to)
    .filter((to) => !routes.has(to.split("#")[0]));
  assert.deepEqual(missing, [], "a footer link with no route answers 404");
});

// Which columns, labels, icons and lines the footer carries is a design default, so nothing here pins
// them. What stays is link integrity (search standing), rel=me honesty, and AI access staying invisible.

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

test("the Software column lists the three products and not Germomics", () => {
  const column = FOOTER_COLUMNS.find((item) => item.id === "software");
  assert.ok(column);
  assert.deepEqual(
    column.items.map((item) => item.to),
    ["/software/foxhound", "/software/foxing", "/software/foxing-edu"],
  );
  assert.ok(!column.items.some((item) => /germomics/i.test(item.label + item.to)));
});

test("the footer does not link Carrel or the Capsid console", () => {
  const hrefs = footerHrefs().map((link) => link.to);
  assert.ok(!hrefs.some((to) => /carrel/i.test(to)));
  assert.ok(!hrefs.some((to) => to.includes("/console")));
});

test("Admin, when the footer lists it, goes to this site's sign-in", () => {
  const admin = PRIVATE_TOOLS.find((tool) => tool.label === "Admin");
  if (admin) assert.equal(admin.to, "/login");
});

test("the copyright year is computed at render, never hard-coded", () => {
  const source = readFileSync(new URL("../app/components/shell-footer.tsx", import.meta.url), "utf8");
  const start = source.indexOf('className="site-shell-footer-note"');
  const note = source.slice(start, source.indexOf("</p>", start));
  assert.ok(note.includes("{new Date().getFullYear()}"), note);
  assert.deepEqual(note.match(/\b20\d\d\b/g), ["2006"]);
});
