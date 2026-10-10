import { env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

import KbLibrary, { loader as libraryLoader } from "~/routes/kb-library";
import { loader as csvLoader } from "~/routes/kb-library[.csv]";
import { loader as jsonLoader } from "~/routes/kb-library[.json]";
import { loader as twinLoader } from "~/routes/kb-library[.md]";
import { loader as protocolsJsonLoader } from "~/routes/protocols[.json]";
import { loader as sitemapLoader } from "~/routes/sitemap";

import { SITE_ORIGIN } from "~/lib/seo";

import { renderRoute, routeContext } from "./route-helpers";
import { seedPages, seedProcedures, seedRegistry } from "./seed";

/* The Recipes and Software how-tos libraries (docs/KNOWLEDGE-BASE.md, step 8): a 404 while the base has no published
 * entry, then the catalog of its entries with its twin, downloads and a place in the sitemap. A recipe and a how-to are
 * written here as rows, as sync:content would write them, from a protocol's record with its profile's own facts. */

const ORIGIN = "https://example.com";
const request = (path: string) => new Request(`${ORIGIN}${path}`);
const status = (p: Promise<unknown>) =>
  p.then(
    (r) => (r instanceof Response ? r.status : 200),
    (thrown: unknown) => (thrown instanceof Response ? thrown.status : ((thrown as { init?: { status?: number } }).init?.status ?? -1)),
  );

async function addRow(slug: string, profile: "recipe" | "computational", path: string, facts: Record<string, unknown>) {
  const base = await env.DB.prepare("SELECT record, markdown FROM procedures WHERE slug = 'phage-isolation'").first<{ record: string; markdown: string }>();
  const record = { ...JSON.parse(base?.record ?? "{}"), slug, profile, path, title: facts.title, description: facts.description, ...facts };
  await env.DB.prepare(
    `INSERT INTO procedures (slug, path, profile, title, description, status, version, updated, record, markdown, source_path, source_blob_sha)
     VALUES (?1, ?2, ?3, ?4, ?5, 'published', NULL, '2026-10-01', ?6, ?7, ?8, 'x')`,
  )
    .bind(slug, path, profile, facts.title, facts.description, JSON.stringify(record), base?.markdown ?? "", `content/procedures/${slug}.md`)
    .run();
}

beforeAll(async () => {
  await seedRegistry();
  await seedPages();
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM procedures").run();
  await seedProcedures();
});

describe("a library with no published entry", () => {
  it("is not a page yet: the library, its twin and its downloads answer 404, and the sitemap leaves it out", async () => {
    for (const path of ["/recipes", "/software/how-tos"]) {
      expect(await status(libraryLoader({ request: request(path), params: {}, context: routeContext() } as never))).toBe(404);
      expect(await status(twinLoader({ request: request(`${path}.md`), params: {}, context: routeContext() } as never))).toBe(404);
      expect(await status(jsonLoader({ request: request(`${path}.json`), params: {}, context: routeContext() } as never))).toBe(404);
      expect(await status(csvLoader({ request: request(`${path}.csv`), params: {}, context: routeContext() } as never))).toBe(404);
    }
    const sitemap = await (await sitemapLoader({ request: request("/sitemap.xml"), params: {}, context: routeContext() } as never)).text();
    expect(sitemap).not.toContain(`${SITE_ORIGIN}/recipes<`);
    expect(sitemap).not.toContain(`${SITE_ORIGIN}/software/how-tos<`);
  });

  it("shows the signed-in admin the empty library, unindexed, saying it goes public with its first entry", async () => {
    // A local request is the admin's (access.server.ts), as on the dev server.
    const loaderData = await libraryLoader({ request: new Request("http://localhost/recipes"), params: {}, context: routeContext() } as never);
    const html = renderRoute("/recipes", KbLibrary, { loaderData });
    expect(html).toContain("Only you can see this page: no recipe is published yet.");
    expect(html).toContain("0 recipes from the");
    // Its downloads are not there yet, so it offers none.
    expect(html).not.toContain("Download and cite");
  });
});

describe("the Recipes library", () => {
  beforeEach(async () => {
    await addRow("tomato-soup", "recipe", "/recipes/tomato-soup", {
      title: "Tomato soup",
      description: "A weeknight soup.",
      servings: 4,
      cuisine: "Italian",
      category: "Soup",
      diet: ["vegetarian"],
      prepTime: "10 min",
      cookTime: "30 min",
      updated: "2026-10-01",
    });
  });

  it("lists every published recipe with its facts, filters by them, and is in the sitemap", async () => {
    const loaderData = await libraryLoader({ request: request("/recipes"), params: {}, context: routeContext() } as never);
    const html = renderRoute("/recipes", KbLibrary, { loaderData });
    expect(html).toContain('<h1 class="page-title" id="library-title">Recipes</h1>');
    expect(html).toContain('href="/recipes/tomato-soup"');
    expect(html).toContain("Prep 10 min, cook 30 min");
    expect(html).toContain("1 recipe from the");
    // No protocol is in it, and the breadcrumb is the library's own.
    expect(html).not.toContain("/research/protocols/");
    const filtered = await libraryLoader({ request: request("/recipes?category=Bread"), params: {}, context: routeContext() } as never);
    expect(renderRoute("/recipes", KbLibrary, { loaderData: filtered }, "/recipes?category=Bread")).not.toContain('href="/recipes/tomato-soup"');
    const sitemap = await (await sitemapLoader({ request: request("/sitemap.xml"), params: {}, context: routeContext() } as never)).text();
    expect(sitemap).toContain(`<loc>${SITE_ORIGIN}/recipes</loc>`);
  });

  it("gives machines the same rows: the markdown twin, the JSON and the CSV", async () => {
    const twin = (await twinLoader({ request: request("/recipes.md"), params: {}, context: routeContext() } as never)) as Response;
    expect(twin.headers.get("link")).toContain("/recipes>");
    expect(await twin.text()).toContain(`| [Tomato soup](${SITE_ORIGIN}/recipes/tomato-soup) | Soup | Italian | vegetarian | 4 | Prep 10 min, cook 30 min | 2026-10-01 |`);
    const json = (await (await jsonLoader({ request: request("/recipes.json"), params: {}, context: routeContext() } as never)).json()) as { count: number; recipes: Array<Record<string, unknown>> };
    expect(json.count).toBe(1);
    expect(json.recipes[0]).toMatchObject({ id: "tomato-soup", category: "Soup", servings: 4 });
    const csv = await (await csvLoader({ request: request("/recipes.csv?diet=vegetarian"), params: {}, context: routeContext() } as never)).text();
    expect(csv.split("\r\n")[1]).toMatch(/^tomato-soup,Tomato soup,/);
  });
});

describe("the Software how-tos library", () => {
  it("lists a published how-to under /software, and the protocol library no longer counts it", async () => {
    await addRow("run-blast", "computational", "/software/how-tos/run-blast", { title: "Run BLAST", description: "Search a phage genome.", methods: ["annotation"] });
    const loaderData = await libraryLoader({ request: request("/software/how-tos"), params: {}, context: routeContext() } as never);
    const html = renderRoute("/software/how-tos", KbLibrary, { loaderData });
    expect(html).toContain('href="/software/how-tos/run-blast"');
    expect(html).toContain('href="/software"');
    const protocols = (await (await protocolsJsonLoader({ request: request("/research/protocols.json"), params: {}, context: routeContext() } as never)).json()) as { protocols: Array<{ id: string }> };
    expect(protocols.protocols.map((p) => p.id)).not.toContain("run-blast");
  });
});
