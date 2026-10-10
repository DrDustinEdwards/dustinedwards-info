import { env } from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";

import AdminKnowledgeBase, { loader } from "~/routes/admin.kb";

import { renderRoute, routeContext } from "./route-helpers";
import { seedProcedures, seedRegistry } from "./seed";

/** What the loader hands the page: the payload inside its data() answer. */
type LoaderData = Awaited<ReturnType<typeof loader>>["data"];

/* The admin's Knowledge Base page (docs/KNOWLEDGE-BASE.md, step 2), read from the rows build:content compiles: a tab per
 * base counted from the rows, a base's list and its search, and Needs info with every recorded gap. It has no action. */

const page = async (search = "") => {
  const url = `https://example.com/admin/kb${search}`;
  const result = await loader({ request: new Request(url), params: {}, context: routeContext() } as never);
  // The loader answers with data(): the payload is its `data`.
  const loaderData = (result as unknown as { data: LoaderData }).data;
  return { loaderData, html: renderRoute("/admin/kb", AdminKnowledgeBase, { loaderData }, `/admin/kb${search}`) };
};

beforeAll(async () => {
  await env.DB.prepare("DELETE FROM registry").run();
  await seedRegistry();
  await seedProcedures();
});

describe("the admin Knowledge Base page", () => {
  it("opens on Protocols, with a counted tab per base and Needs info", async () => {
    const { loaderData, html } = await page();
    const protocols = (await env.DB.prepare("SELECT COUNT(*) AS n FROM procedures WHERE profile = 'protocol'").first<{ n: number }>())?.n;
    expect(loaderData.tab).toBe("protocols");
    expect(loaderData.tabs.map((t) => t.label)).toEqual(["Protocols", "Software how-tos", "Recipes", "Needs info"]);
    expect(loaderData.tabs[0]?.count).toBe(protocols);
    expect(loaderData.rows).toHaveLength(protocols ?? -1);
    expect(html).toContain('href="/research/protocols/phage-dna-extraction"');
    expect(html).toContain('aria-current="page"');
  });

  it("narrows a base by its search, and says so when nothing matches", async () => {
    const { loaderData } = await page("?tab=protocols&q=gapdh");
    expect(loaderData.rows.map((r) => r.slug)).toEqual(["pan-avian-gapdh"]);
    const none = await page("?tab=protocols&q=no-such-protocol");
    expect(none.loaderData.rows).toEqual([]);
    expect(none.html).toContain("Nothing in protocols matches");
  });

  it("an empty base says it has nothing yet", async () => {
    const { html } = await page("?tab=recipes");
    expect(html).toContain("No recipes yet.");
  });

  it("Needs info lists the entries' and the registry's recorded gaps, with their reasons", async () => {
    const { loaderData, html } = await page("?tab=needs-info");
    const kinds = new Set(loaderData.gaps.map((g) => g.kindLabel));
    expect(kinds.has("Protocol")).toBe(true);
    expect(kinds.has("Equipment")).toBe(true);
    expect(loaderData.tabs.find((t) => t.id === "needs-info")?.count).toBe(loaderData.gaps.length);
    // Every equipment record's manufacturer is a recorded gap today (docs/REGISTRY.md).
    expect(loaderData.gaps.filter((g) => g.kindLabel === "Equipment" && g.field === "manufacturer")).toHaveLength(11);
    // Each item's "View page" opens its own page (docs/KNOWLEDGE-BASE.md, A1).
    expect(html).toContain('href="/research/lab/equipment/nanodrop"');
  });
});
