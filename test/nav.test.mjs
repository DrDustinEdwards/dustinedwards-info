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

test("Research and Teaching open as menus and About is a plain link until an interest exists", () => {
  const byLabel = new Map(NAV.map((item) => [item.label, item]));
  assert.equal(byLabel.get("Research")?.menu?.id, "research");
  assert.equal(byLabel.get("Teaching")?.menu?.id, "teaching");
  assert.equal(byLabel.get("About")?.menu, undefined);
});

test("a page not yet written stays out, and its link appears once the page exists", () => {
  const teaching = liveMenu(MENUS.teaching);
  assert.ok(teaching);
  for (const missing of ["/teaching/study-skills", "/teaching#join-the-lab", "/teaching#teaching-philosophy"]) {
    assert.ok(!hrefs(teaching).includes(missing), `${missing} is in the menu before its page`);
    assert.equal(isLive(missing), false);
  }

  const written = new Set(["/teaching#join-the-lab"]);
  const later = liveMenu(MENUS.teaching, (to) => isLive(to) || written.has(to));
  assert.ok(later && hrefs(later).includes("/teaching#join-the-lab"));
});

test("an anchor is live only when its heading is listed, never on its page alone", () => {
  assert.equal(isLive("/teaching"), true);
  assert.equal(isLive("/teaching#join-the-lab"), false);
  assert.equal(isLive("/research/publications#2024"), false);
});

test("About launches its panel with the first interest, and keeps CV while Contact waits for its page", () => {
  const withRecipes = liveMenu(MENUS.about, (to) => isLive(to) || to === "/interests/recipes");
  assert.ok(withRecipes);
  assert.deepEqual(hrefs(withRecipes).slice(1), [
    "https://docs.google.com/document/d/123n-n-ViE-OyUUqIjEY4byMVVUvfK8BjdNCNt-Gm7GQ/export?format=pdf",
    "/interests/recipes",
  ]);
});

test("the Research panel carries the Retroviruses correction and the searched labels", () => {
  const research = liveMenu(MENUS.research);
  assert.ok(research);
  const links = research.columns.flatMap((column) => column.sections.flatMap((section) => section.links));
  const byLabel = new Map(links.map((link) => [link.label, link]));
  assert.equal(byLabel.get("Retroviruses")?.description, "HIV, HTLV, REV and LPDV");
  assert.equal(byLabel.get("Phage discovery guide")?.to, "/teaching/phage-discovery");
  assert.equal(byLabel.get("COI primers")?.aside, "LCO1490 · HCO2198");
  for (const label of ["Phage isolation and purification", "Phage DNA extraction", "Publications"]) {
    assert.ok(byLabel.has(label), label);
  }
  // Six words at most, per the brief.
  const long = links.filter((link) => (link.description ?? "").split(/\s+/).length > 6);
  assert.deepEqual(long, []);
  assert.equal(byLabel.get("Phage discovery guide")?.description, "Finding a new phage, step-by-step");
});
