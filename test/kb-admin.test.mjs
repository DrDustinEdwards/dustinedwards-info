import test from "node:test";
import assert from "node:assert/strict";

import { KB_ADMIN_PATH, NEEDS_INFO, baseEntries, kbTabs, needsInfo, resolveTab, tabHref } from "../app/kb/admin.mjs";

/* The admin Knowledge Base page's pure half (app/kb/admin.mjs): which tab an address names, the counts, the search over a
 * base, and the Needs info list drawn from entries and registry items. Rows here are minimal; the real ones come from D1. */

const entry = (over = {}) => ({
  slug: "phage-isolation",
  path: "/research/protocols/phage-isolation",
  profile: "protocol",
  title: "Phage Isolation",
  description: "Enrichment from soil.",
  draft: false,
  version: null,
  updated: "2026-10-01",
  gaps: [],
  ...over,
});

test("an unknown or absent tab falls back to the first base; a base id and needs-info are kept", () => {
  assert.equal(resolveTab(null), "protocols");
  assert.equal(resolveTab("nope"), "protocols");
  assert.equal(resolveTab("recipes"), "recipes");
  assert.equal(resolveTab(NEEDS_INFO), NEEDS_INFO);
});

test("a tab's address keeps the search for a base and drops it for Needs info", () => {
  assert.equal(tabHref("recipes", "soup"), `${KB_ADMIN_PATH}?tab=recipes&q=soup`);
  assert.equal(tabHref(NEEDS_INFO, "soup"), `${KB_ADMIN_PATH}?tab=${NEEDS_INFO}`);
});

test("every tab is counted from the rows it lists, zero included", () => {
  const entries = [entry(), entry({ slug: "b", profile: "recipe" })];
  const tabs = kbTabs(entries, [{ what: "x", kindLabel: "Protocols", href: "/", field: "f", reason: "r" }]);
  assert.deepEqual(
    tabs.map((t) => [t.id, t.count]),
    [["protocols", 1], ["how-tos", 0], ["recipes", 1], [NEEDS_INFO, 1]],
  );
});

test("a base lists only its profile, searched over title, description and slug with case and accents folded", () => {
  const entries = [
    entry({ slug: "zinc", title: "Zinc Extraction", description: "Column-free." }),
    entry({ slug: "pcr", title: "COI primers", description: "Préparation of barcodes." }),
    entry({ slug: "soup", title: "Soup", profile: "recipe" }),
  ];
  assert.deepEqual(baseEntries(entries, "protocols").map((e) => e.slug), ["pcr", "zinc"]);
  assert.deepEqual(baseEntries(entries, "protocols", "PREPARATION").map((e) => e.slug), ["pcr"]);
  assert.deepEqual(baseEntries(entries, "protocols", "zinc").map((e) => e.slug), ["zinc"]);
  assert.deepEqual(baseEntries(entries, NEEDS_INFO), []);
});

test("Needs info lists every entry gap, then every registry gap with its reason and where to read the item", () => {
  const entries = [entry({ gaps: [{ field: "version", reason: "No version has been assigned." }] })];
  const items = [
    { kind: "equipment", id: "nanodrop", name: "NanoDrop", status: "published", fields: { manufacturer: "MISSING: no record says." } },
    { kind: "primer", id: "lco1490", name: "LCO1490", status: "published", fields: { sequence: "GGTC", published_doi: "MISSING: paywalled." } },
    { kind: "reagent", id: "water", name: "Water", status: "published", fields: { supplier: "Promega" } },
  ];
  assert.deepEqual(needsInfo(entries, items), [
    { what: "Phage Isolation", kindLabel: "Protocol", href: "/research/protocols/phage-isolation", field: "version", reason: "No version has been assigned." },
    { what: "NanoDrop", kindLabel: "Equipment", href: "/research/lab/equipment", field: "manufacturer", reason: "no record says." },
    { what: "LCO1490", kindLabel: "Primer", href: "/research/lab/primers/lco1490", field: "published_doi", reason: "paywalled." },
  ]);
});
