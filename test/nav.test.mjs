import test from "node:test";
import assert from "node:assert/strict";

import { declaredRouteModules } from "../scripts/lib/features/anchors.mjs";
import { MENUS, NAV, ROUTED_PATHS, isLive, liveMenu } from "../app/lib/nav.ts";

/** Every href a resolved menu renders, head and beside links included. */
function hrefs(menu) {
  return [
    menu.head.to,
    ...(menu.beside ?? []).map((link) => link.to),
    ...menu.columns.flatMap((column) => column.sections.flatMap((section) => section.links.map((link) => link.to))),
  ];
}

test("every page a menu links to outside the markdown set is a route app/routes.ts declares", async () => {
  const routes = await declaredRouteModules();
  assert.deepEqual(
    ROUTED_PATHS.filter((path) => !routes.has(path)),
    [],
  );
});

test("every link the menus render has a page: listed markdown, a declared route, or another site", async () => {
  const routes = await declaredRouteModules();
  for (const item of NAV) {
    assert.ok(routes.has(item.to), `${item.to} is not a declared route`);
    if (!item.menu) continue;
    for (const href of hrefs(item.menu)) {
      if (href.startsWith("https://")) continue;
      assert.ok(routes.has(href.split("#")[0]), `${item.label}: ${href} has no route`);
    }
  }
});

// Which items open as menus, what each panel lists and how long its copy runs are header layout, a
// design default, so nothing here pins them. What stays is that every link resolves and the live logic.

test("a page not yet written stays out, and its link appears once the page exists", () => {
  const unwritten = new Set(["/teaching/virus-isolation"]);
  const before = liveMenu(MENUS.teaching, (to) => isLive(to) && !unwritten.has(to));
  assert.ok(before && !hrefs(before).includes("/teaching/virus-isolation"));
  const after = liveMenu(MENUS.teaching);
  assert.ok(after && hrefs(after).includes("/teaching/virus-isolation"));
});

test("About shows CV and Contact before any interest page exists", () => {
  const about = liveMenu(MENUS.about);
  assert.ok(about);
  const links = hrefs(about);
  assert.ok(links.includes("/about"));
  assert.ok(links.includes("/contact"));
  assert.ok(links.some((to) => to.startsWith("https://docs.google.com/")));
  assert.ok(!links.some((to) => to.startsWith("/interests/")));
});

test("an anchor is live only when its heading is listed, never on its page alone", () => {
  assert.equal(isLive("/teaching"), true);
  assert.equal(isLive("/teaching#join-the-lab"), true);
  assert.equal(isLive("/teaching#courses"), false);
  assert.equal(isLive("/research/publications#2024"), false);
});

test("the Software panel lists the three products and not Germomics", () => {
  const software = liveMenu(MENUS.software);
  assert.ok(software);
  const labels = software.columns.flatMap((column) =>
    column.sections.flatMap((section) => section.links.map((link) => link.label)),
  );
  assert.deepEqual(labels, ["Foxhound", "Foxing", "Foxing Edu"]);
});

test("the Research panel's facts are right and the guide is at its canonical address", () => {
  const research = liveMenu(MENUS.research);
  assert.ok(research);
  const links = research.columns.flatMap((column) => column.sections.flatMap((section) => section.links));
  const byLabel = new Map(links.map((link) => [link.label, link]));
  // Facts, not layout: each is checked only when the panel still carries the item.
  if (byLabel.has("Retroviruses")) assert.equal(byLabel.get("Retroviruses")?.description, "HTLV-1, REV and LPDV");
  if (byLabel.has("Phage discovery guide")) assert.equal(byLabel.get("Phage discovery guide")?.to, "/teaching/phage-discovery");
  if (byLabel.has("COI primers")) assert.equal(byLabel.get("COI primers")?.aside, "LCO1490 · HCO2198");
});
