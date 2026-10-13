import { beforeAll, describe, expect, it } from "vitest";

import { SITE_ORIGIN } from "~/lib/seo";
import { lineText } from "~/lib/site-map.mjs";
import SiteMap, { headers as siteMapHeaders, loader as siteMapLoader } from "~/routes/site-map";
import { loader as sitemapLoader } from "~/routes/sitemap";

import { renderRoute, routeContext } from "./route-helpers";
import { seedPages, seedProcedures, seedPublications } from "./seed";
import { testEnv } from "./test-env";

/* sitemap.xml and /site-map are drawn from one list (app/lib/site-urls.server.ts). These hold the two to the same
 * rows, a draft page out of both, and the counted kinds to one line each on the page. */

const ORIGIN = "https://example.com";
const args = (path: string) => ({ request: new Request(`${ORIGIN}${path}`), context: routeContext(), params: {} }) as never;

async function xmlPaths() {
  const res = (await sitemapLoader(args("/sitemap.xml"))) as Response;
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => (m[1] ?? "").slice(SITE_ORIGIN.length) || "/");
}

type Loaded = { data: { sections: Array<{ id: string; heading: string; lines: Array<{ to: string; label: string; count?: number }> }> }; init: ResponseInit | null };
const pageData = async () => (await siteMapLoader(args("/site-map"))) as unknown as Loaded;

let papers = 0;

beforeAll(async () => {
  papers = await seedPublications();
  await seedPages();
  await seedProcedures();
});

describe("the site map and sitemap.xml", () => {
  it("sitemap.xml lists /site-map, and leaves the draft /accessibility out", async () => {
    const paths = await xmlPaths();
    expect(paths).toContain("/site-map");
    expect(paths).toContain("/privacy");
    const row = await testEnv.DB.prepare("SELECT status FROM pages WHERE path = '/accessibility'").first<{ status: string }>();
    expect(row?.status).toBe("draft");
    expect(paths).not.toContain("/accessibility");
  });

  it("every link on the page is an address sitemap.xml lists, and the draft is on neither", async () => {
    const xml = new Set(await xmlPaths());
    const { data } = await pageData();
    const links = data.sections.flatMap((s) => s.lines.map((l) => l.to));
    expect(links.filter((to) => !xml.has(to))).toEqual([]);
    expect(links).not.toContain("/accessibility");
  });

  it("groups by the header's sections, then Site, and counts papers and procedures on their index's line", async () => {
    const { data } = await pageData();
    const headings = data.sections.map((s) => s.heading);
    const order = ["Research", "Teaching", "Software", "Writing", "About", "Site"];
    expect(headings).toEqual(order.filter((h) => headings.includes(h)));
    expect(data.sections.at(-1)?.heading).toBe("Site");
    const research = data.sections.find((s) => s.id === "research");
    expect(research?.lines[0]?.to).toBe("/research");
    const publications = research?.lines.find((l) => l.to === "/research/publications");
    expect(publications && lineText(publications)).toBe(`Publications (${papers})`);
    // No paper has a line of its own.
    expect(research?.lines.some((l) => l.to.startsWith("/research/publications/"))).toBe(false);
    const site = data.sections.find((s) => s.id === "site");
    expect(site?.lines.map((l) => l.to)).toEqual(["/", "/contact", "/site-map", "/colophon", "/privacy", "/terms"]);
  });

  it("renders every section as a heading and every line as a link, and carries the sitemap's cache tags", async () => {
    const { data } = await pageData();
    const html = renderRoute("/site-map", SiteMap, { loaderData: data });
    expect(html).toContain("<h1 class=\"page-title\">Site map</h1>");
    for (const section of data.sections) expect(html).toContain(`id="site-map-${section.id}"`);
    expect(html).toMatch(/<a [^>]*href="\/research\/publications"[^>]*>Publications \(\d+\)<\/a>/);
    const headers = siteMapHeaders({ loaderHeaders: new Headers() } as never);
    expect(headers.get("Cache-Tag")).toContain("content-pages");
    expect(headers.get("Cache-Tag")).toContain("registry");
  });
});
