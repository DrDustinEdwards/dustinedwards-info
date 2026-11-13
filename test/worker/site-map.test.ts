import { beforeAll, describe, expect, it } from "vitest";

import { SITE_ORIGIN } from "~/lib/seo";
import { loader as siteMapLoader } from "~/routes/site-map";
import { loader as sitemapLoader } from "~/routes/sitemap";

import { routeContext } from "./route-helpers";
import { seedPages, seedProcedures, seedPublications } from "./seed";
import { testEnv } from "./test-env";

/* sitemap.xml and /site-map are drawn from one list (app/lib/site-urls.server.ts). These hold the two to the same
 * rows, a draft page out of both and a published one in both, and the counted kinds to one line each on the page. */

const ORIGIN = "https://example.com";
const args = (path: string) =>
  ({ request: new Request(`${ORIGIN}${path}`), context: routeContext(), params: {} }) as never;

async function xmlPaths() {
  const res = (await sitemapLoader(args("/sitemap.xml"))) as Response;
  return [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => (m[1] ?? "").slice(SITE_ORIGIN.length) || "/",
  );
}

type Loaded = {
  data: {
    sections: Array<{
      id: string;
      heading: string;
      lines: Array<{ to: string; label: string; count?: number; plain?: boolean }>;
    }>;
  };
  init: ResponseInit | null;
};
const pageData = async () => (await siteMapLoader(args("/site-map"))) as unknown as Loaded;

/** Runs `body` with /accessibility's row set back to a draft, then publishes it again. */
async function draft(body: () => Promise<void>) {
  const status = (s: string) =>
    testEnv.DB.prepare("UPDATE pages SET status = ?1 WHERE path = '/accessibility'").bind(s).run();
  await status("draft");
  try {
    await body();
  } finally {
    await status("published");
  }
}

beforeAll(async () => {
  await seedPublications();
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
    const links = async () =>
      (await pageData()).data.sections.flatMap((s) =>
        s.lines.filter((l) => !l.plain).map((l) => l.to),
      );
    const xml = new Set(await xmlPaths());
    expect((await links()).filter((to) => !xml.has(to))).toEqual([]);
    expect(await links()).toContain("/accessibility");
    await draft(async () => expect(await links()).not.toContain("/accessibility"));
  });
});
