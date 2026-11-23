import { kvPageRecord, trackRenderedPageDates } from "@drdustinedwards/site-helpers/lastmod";
import { SITE_ORIGIN } from "~/lib/site-origin.mjs";

// The day each page of /sitemap.xml last changed that no row or source file dates: a deploy's shallow checkout has no git
// history for the routes behind /contact, /colophon, /features and the /systems pages. The daily page-dates job reads each
// as Markdown, the way a Markdown copy is made, with Prelum's trackRenderedPageDates, and
// keeps the day its text last changed in one KV key. gatherSiteUrls (site-urls.server.ts) reads it back.
export const PAGE_DATES_KEY = "sitemap:page-dates";

/** The page's HTML as the Renderer entrypoint renders it (the one the gateway asks), or null when it is not a page. */
async function renderPage(ctx: ExecutionContext, path: string): Promise<string | null> {
  const response = await ctx.exports.Renderer.fetch(
    new Request(`${SITE_ORIGIN}${path}`, { headers: { Accept: "text/html" } }),
  );
  return response.ok && (response.headers.get("Content-Type") ?? "").includes("text/html")
    ? response.text()
    : null;
}

/** The daily job: date every page of the sitemap that has no date of its own. */
export async function runPageDates(
  env: Env,
  ctx: ExecutionContext,
): Promise<{ rowsProcessed: number }> {
  const { gatherSiteUrls } = await import("~/lib/site-urls.server");
  const { urls } = await gatherSiteUrls(env, { tracked: false });
  const { record } = await trackRenderedPageDates({
    paths: urls.filter((url) => !url.lastmod).map((url) => url.path),
    origin: SITE_ORIGIN,
    render: (path) => renderPage(ctx, path),
    ...kvPageRecord(env.APP_KV, PAGE_DATES_KEY),
  });
  return { rowsProcessed: Object.keys(record).length };
}
