import { Link, data } from "react-router";

import { PageShell } from "~/components/page-shell";
import { getEnv } from "~/lib/context";
import { EDGE_CACHE_HEADER, SITE, pageMeta, publicHtmlHeaders, scheduledEdgeCacheControl } from "~/lib/seo";
import { SITE_MAP_PATH, lineText, siteMapSections } from "~/lib/site-map.mjs";
import { SITE_URLS_CACHE_TAGS, gatherSiteUrls } from "~/lib/site-urls.server";

import type { Route } from "./+types/site-map";

import "~/styles/site-map.css";

/**
 * The site map for people: every public page by its title, grouped by the header's sections, drawn from the
 * one URL list sitemap.xml is drawn from (app/lib/site-urls.server.ts), so a page listed in one is listed in the
 * other. At /site-map because /sitemap.xml is the machines' document.
 */
export async function loader({ context }: Route.LoaderArgs) {
  const { urls, nextPublishAt } = await gatherSiteUrls(getEnv(context));
  return data(
    { sections: siteMapSections(urls) },
    { headers: { [EDGE_CACHE_HEADER]: scheduledEdgeCacheControl(new Date(), nextPublishAt) } },
  );
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  // Every save that changes the list must reach this page, so it carries the sitemap's tags.
  return new Headers(publicHtmlHeaders(SITE_URLS_CACHE_TAGS, loaderHeaders.get(EDGE_CACHE_HEADER) ?? undefined));
}

export function meta() {
  return pageMeta({
    title: `Site map | ${SITE.name}`,
    description: "Every page on this site by its title, grouped as the header menu groups them.",
    path: SITE_MAP_PATH,
  });
}

export default function SiteMap({ loaderData }: Route.ComponentProps) {
  return (
    <PageShell>
      <h1 className="page-title">Site map</h1>
      <div className="site-map">
        {loaderData.sections.map((section) => (
          <section key={section.id} className="site-map-section" aria-labelledby={`site-map-${section.id}`}>
            <h2 className="site-map-heading" id={`site-map-${section.id}`}>
              {section.heading}
            </h2>
            <ul className="site-map-list">
              {section.lines.map((line) => (
                <li key={`${line.to} ${line.label}`}>
                  <Link to={line.to}>{lineText(line)}</Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageShell>
  );
}
