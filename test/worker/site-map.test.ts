import { beforeAll, describe, expect, it } from "vitest";

import { SITE_ORIGIN } from "~/lib/seo";
import { lineText } from "~/lib/site-map.mjs";
import SiteMap, { headers as siteMapHeaders, loader as siteMapLoader } from "~/routes/site-map";
import { loader as sitemapLoader } from "~/routes/sitemap";

import { renderRoute, routeContext } from "./route-helpers";
import { seedPages, seedProcedures, seedPublications } from "./seed";
import { testEnv } from "./test-env";

/* sitemap.xml and /site-map are drawn from one list (app/lib/site-urls.server.ts). These hold the two to the same
 * rows, a draft page out of both and a published one in both, and the counted kinds to one line each on the page. */

const ORIGIN = "https://example.com";
const args = (path: string) => ({ request: new Request(`${ORIGIN}${path}`), context: routeContext(), params: {} }) as never;

async function xmlPaths() {
  const res = (await sitemapLoader(args("/sitemap.xml"))) as Response;
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => (m[1] ?? "").slice(SITE_ORIGIN.length) || "/");
}

type Loaded = { data: { sections: Array<{ id: string; heading: string; lines: Array<{ to: string; label: string; count?: number; plain?: boolean }> }> }; init: ResponseInit | null };
const pageData = async () => (await siteMapLoader(args("/site-map"))) as unknown as Loaded;

let papers = 0;

/** Runs `body` with /accessibility's row set back to a draft, then publishes it again. */
async function draft(body: () => Promise<void>) {
  const status = (s: string) => testEnv.DB.prepare("UPDATE pages SET status = ?1 WHERE path = '/accessibility'").bind(s).run();
  await status("draft");
  try {
    await body();
  } finally {
    await status("published");
  }
}

beforeAll(async () => {
  papers = await seedPublications();
  await seedPages();
  await seedProcedures();
});

describe("the site map and sitemap.xml", () => {
  it("sitemap.xml lists /site-map and the published /accessibility, and leaves it out while it is a draft", async () => {
    const paths = await xmlPaths();
    expect(paths).toContain("/site-map");
    expect(paths).toContain("/privacy");
    expect(paths).toContain("/accessibility");
    await draft(async () => expect(await xmlPaths()).not.toContain("/accessibility"));
  });

  it("sitemap.xml lists the CV's PDF, and every lastmod is a real day no later than today", async () => {
    const res = (await sitemapLoader(args("/sitemap.xml"))) as Response;
    const xml = await res.text();
    expect(xml).toContain(`<loc>${SITE_ORIGIN}/dustin-edwards-cv.pdf</loc>`);
    const today = new Date().toISOString().slice(0, 10);
    const days = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1] ?? "");
    expect(days.filter((day) => !/^\d{4}-\d{2}-\d{2}$/.test(day) || day > today)).toEqual([]);
  });

  it("every link on the page is an address sitemap.xml lists, and a draft is on neither", async () => {
    const links = async () => (await pageData()).data.sections.flatMap((s) => s.lines.filter((l) => !l.plain).map((l) => l.to));
    const xml = new Set(await xmlPaths());
    expect((await links()).filter((to) => !xml.has(to))).toEqual([]);
    expect(await links()).toContain("/accessibility");
    await draft(async () => expect(await links()).not.toContain("/accessibility"));
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
    expect(site?.lines.map((l) => l.to)).toEqual(["/", "/contact", "/site-map", "/colophon", "/privacy", "/terms", "/accessibility"]);
  });

  it("renders every section as a heading and every line as a link, and carries the sitemap's cache tags", async () => {
    const { data } = await pageData();
    const html = renderRoute("/site-map", SiteMap, { loaderData: data });
    expect(html).toContain("<h1 class=\"page-title cap-layout-grid\">Site map</h1>");
    for (const section of data.sections) expect(html).toContain(`id="site-map-${section.id}"`);
    expect(html).toMatch(/<a [^>]*href="\/research\/publications"[^>]*>Publications \(\d+\)<\/a>/);
    // No two links with different text go to one address (WCAG 2.4.4): Tags is text, not a second /writing link.
    const body = html.slice(html.indexOf('<div class="site-map">'), html.indexOf("site-shell-footer"));
    expect(body.length).toBeGreaterThan(100);
    const hrefs = [...body.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([^<]*)<\/a>/g)];
    const texts = new Map<string, Set<string>>();
    for (const [, href, text] of hrefs) texts.set(href ?? "", (texts.get(href ?? "") ?? new Set()).add(text ?? ""));
    expect([...texts].filter(([href, set]) => href.startsWith("/") && href !== "/" && set.size > 1).map(([href]) => href)).toEqual([]);
    expect(hrefs.length).toBeGreaterThan(10);
    const headers = siteMapHeaders({ loaderHeaders: new Headers() } as never);
    expect(headers.get("Cache-Tag")).toContain("content-pages");
    expect(headers.get("Cache-Tag")).toContain("registry");
  });
});
