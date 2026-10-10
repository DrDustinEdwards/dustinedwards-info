import assert from "node:assert/strict";
import test from "node:test";

import { BASES } from "../app/kb/bases.mjs";
import { LIBRARY_BASES, baseAtLibrary, baseCatalog, baseMarkdown, libraryTrail } from "../app/kb/libraries.mjs";

/* The Recipes and Software how-tos libraries' declarations (app/kb/libraries.mjs): where each is, the trail to it, the
 * facets each is found by, and what an empty one says. */

test("each base but Protocols has a library at its own address; the how-tos and their entries live under /software", () => {
  assert.deepEqual(LIBRARY_BASES.map((b) => b.library), ["/software/how-tos", "/recipes"]);
  assert.equal(BASES.find((b) => b.id === "how-tos")?.entryRoot, "/software/how-tos/");
  assert.equal(baseAtLibrary("/recipes/")?.id, "recipes");
  assert.equal(baseAtLibrary("/research/protocols"), null);
  assert.deepEqual(libraryTrail(/** @type {any} */ (baseAtLibrary("/software/how-tos"))), [["Software", "/software"], ["Software how-tos", "/software/how-tos"]]);
  assert.deepEqual(libraryTrail(/** @type {any} */ (baseAtLibrary("/recipes"))), [["Recipes", "/recipes"]]);
});

test("a recipe is found by category, cuisine and diet; a how-to by method and course", () => {
  const facets = (/** @type {string} */ path) => baseCatalog(/** @type {any} */ (baseAtLibrary(path))).fields.filter((f) => f.facet).map((f) => f.key);
  assert.deepEqual(facets("/recipes"), ["category", "cuisine", "diet"]);
  assert.deepEqual(facets("/software/how-tos"), ["method", "course"]);
  assert.equal(baseMarkdown(/** @type {any} */ (baseAtLibrary("/recipes")), [], "https://example.com"), "No recipes are published yet.");
});

test("search reads a record's knowledge base from its address, and base: is an operator like tag: and type:", async () => {
  const { SEARCH_BASES, baseOfUrl, baseLabel } = await import("../app/kb/search-bases.mjs");
  const { hasFilters, parseQuery } = await import("../app/lib/search/query.mjs");
  assert.deepEqual(SEARCH_BASES.map((b) => b.id), ["protocols", "how-tos", "recipes", "lab"]);
  assert.equal(baseOfUrl("/research/protocols/phage-isolation"), "protocols");
  assert.equal(baseOfUrl("/software/how-tos/run-blast"), "how-tos");
  assert.equal(baseOfUrl("/research/lab/primers/lco1490"), "lab");
  // A library's own page, and a page in no base, belong to none.
  assert.equal(baseOfUrl("/research/protocols"), null);
  assert.equal(baseOfUrl("/writing/ten-years-on-cloudflare"), null);
  assert.equal(baseLabel("how-tos"), "Software how-tos");
  const parsed = parseQuery("zinc base:Protocols tag:phage");
  assert.deepEqual([parsed.terms, parsed.bases, parsed.tags], [["zinc"], ["protocols"], ["phage"]]);
  assert.equal(hasFilters(parseQuery("base:recipes")), true);
});
