import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

import { recordsForPapers } from "~/lib/search/records.mjs";
import { replaceSearchRecords } from "~/lib/search/replace.server";
import { search } from "~/lib/search/search.server";
import Search, { loader as searchLoader } from "~/routes/search";

import { renderRoute, routeContext } from "./route-helpers";


/* The knowledge base facet of the site's search (docs/KNOWLEDGE-BASE.md, step 8, finding A2): one search across the knowledge
 * bases, with each hit's base read from its address and counted as a facet, and ?base= or base: narrowing to one. */

// The search reads only D1, so the test runner's env is the search's.
const searchEnv = env as unknown as Parameters<typeof search>[0];
const WORD = "zymograd";
const records = [
  { uid: "test:protocol", url: "/research/protocols/zymograd-plating", title: "Zymograd plating", body: `${WORD} plating protocol` },
  { uid: "test:recipe", url: "/recipes/zymograd-bread", title: "Zymograd bread", body: `${WORD} bread recipe` },
  { uid: "test:lab", url: "/research/lab/reagents/zymograd", title: "Zymograd", body: `${WORD} reagent` },
  { uid: "test:other", url: "/research/zymograd-notes", title: "Zymograd notes", body: `${WORD} notes` },
];

beforeAll(async () => {
  for (const r of records) await env.DB.batch(replaceSearchRecords(env.DB, r.uid, recordsForPapers([r])));
});

const urls = (hits: Array<{ url: string }>) => hits.map((h) => h.url).sort();

describe("the knowledge base facet", () => {
  it("counts each hit under its knowledge base, in the bases' order, and leaves out a hit in none", async () => {
    const result = await search(searchEnv, { q: WORD });
    expect(result.total).toBe(4);
    expect(result.facets.bases).toEqual([
      { value: "protocols", label: "Protocols", count: 1 },
      { value: "recipes", label: "Recipes", count: 1 },
      { value: "lab", label: "Lab registry", count: 1 },
    ]);
  });

  it("narrows to one base by ?base= or a typed base:, and an id no base has finds nothing", async () => {
    expect(urls((await search(searchEnv, { q: WORD, base: "protocols" })).hits)).toEqual(["/research/protocols/zymograd-plating"]);
    expect(urls((await search(searchEnv, { q: `${WORD} base:lab` })).hits)).toEqual(["/research/lab/reagents/zymograd"]);
    expect(urls((await search(searchEnv, { q: `${WORD} base:recipes base:lab` })).hits)).toEqual(["/recipes/zymograd-bread", "/research/lab/reagents/zymograd"]);
    expect((await search(searchEnv, { q: WORD, base: "nonsense" })).total).toBe(0);
  });

  it("is a filter on its own: base:recipes with no words lists the base's records", async () => {
    expect(urls((await search(searchEnv, { q: "base:recipes" })).hits)).toEqual(["/recipes/zymograd-bread"]);
  });

  it("shows on the page as a facet of links, and as a chip that removes it", async () => {
    const loaderData = (await searchLoader({ request: new Request(`https://example.com/search?q=${WORD}`), params: {}, context: routeContext() } as never)).data;
    const html = renderRoute("/search", Search, { loaderData }, `/search?q=${WORD}`);
    expect(html).toContain("<h2>Knowledge base</h2>");
    expect(html).toContain(`href="/search?q=${WORD}&amp;base=protocols"`);
    const narrowed = (await searchLoader({ request: new Request(`https://example.com/search?q=${WORD}&base=lab`), params: {}, context: routeContext() } as never)).data;
    const chip = renderRoute("/search", Search, { loaderData: narrowed }, `/search?q=${WORD}&base=lab`);
    expect(chip).toContain("in: Lab registry");
    // Narrowed to one base, the facet would offer only that base again, so it is left out.
    expect(chip).not.toContain("<h2>Knowledge base</h2>");
  });
});
