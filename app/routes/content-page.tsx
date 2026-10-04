import { data } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { DictionaryEntry } from "~/components/dictionary-entry";
import { PageShell } from "~/components/page-shell";
import { PhageRoster } from "~/components/phage-roster";
import { PhageTools } from "~/components/phage-tool";
import { getPublishedEntryByPath } from "~/db/dictionary";
import { getPageByPath, getPublishedPageTitles } from "~/db/pages";
import { listRoster } from "~/db/roster";
import { isAdminViewer } from "~/lib/access.server";
import { getEnv } from "~/lib/context";
import {
  contentPageCardPath,
  contentPageMarkdownPath,
  contentPageTrail,
} from "~/lib/content-pages.mjs";
import type { PageRecord } from "~/lib/pages/compile.mjs";
import { contentPageJsonLd } from "~/lib/pages/page-json-ld";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { CONTENT_PAGE_HTML_TAGS } from "~/lib/pages/route";
import { toolsOnPage } from "~/lib/phage-tools.mjs";
import { ROSTER_PAGE_PATH } from "~/lib/roster/compile.mjs";
import { SITE_ORIGIN, pageMeta, publicHtmlHeaders } from "~/lib/seo";

import type { Route } from "./+types/content-page";

// prose.css is route-scoped: a page using `.prose` without importing it renders unstyled.
import "~/styles/enarratio.css";
import "~/styles/prose.css";

/**
 * Every Research, Teaching and Software page (app/lib/content-pages.mjs): the research/* splat, and
 * /teaching and /software through their own modules. Drawn from the page's D1 row at request time
 * (docs/PAGES.md), so an edit saved through the operator API is live without a deploy; the HTML in the
 * row was rendered by the site's pipeline with the URL allowlist already applied, so the Worker carries
 * no markdown renderer and nothing third-party reaches the page. A draft is served only to the signed-in
 * admin; that request carries a cookie, and the Worker never stores a cookie-bearing response.
 * The markdown twin is the sibling route in content-page[.md].ts.
 */
export function headers() {
  return new Headers(publicHtmlHeaders(CONTENT_PAGE_HTML_TAGS));
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const row = await getPageByPath(env, pathname);
  // A path with no row: not a page, or a page the content sync has not written yet.
  if (!row) throw data(null, { status: 404 });
  if (row.status === "draft" && !(await isAdminViewer(env, request))) throw data(null, { status: 404 });
  const page = row.record;
  // The page it sits under, by title, for the trail above it (the course above its FAQ).
  const parent = page.path.slice(0, page.path.lastIndexOf("/"));
  const titles = await getPublishedPageTitles(env, parent ? [parent] : []);
  // The lead a named Software page opens with, drawn from D1 beside the page (docs/DICTIONARY.md): an entry
  // edit is live at the next request, and a page with no published entry has none.
  const entry = await getPublishedEntryByPath(env, page.path);
  const trail = contentPageTrail(page, (path) => titles.get(path));
  // The program page carries the roster, drawn from D1 beside the page (docs/ROSTER.md); no other page reads it.
  const roster = page.path === ROSTER_PAGE_PATH ? await listRoster(env) : null;
  // A calculator page computes from its query string, so Calculate works as a plain GET with script off.
  return { page, trail, entry, roster, draft: row.status === "draft", search: toolsOnPage(page.path).length > 0 ? url.search : "" };
}

/** The page's own social card where build:og draws one (CARDED_PAGE_ROOTS), else the site card. */
function cardUrl(page: PageRecord) {
  const path = contentPageCardPath(page);
  return path ? `${SITE_ORIGIN}${path}` : undefined;
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const { page, draft } = loaderData;
  return [
    ...pageMeta({ title: page.seoTitle, description: page.description, path: page.path, image: cardUrl(page) }),
    {
      tagName: "link",
      rel: "alternate",
      type: "text/markdown",
      href: `${SITE_ORIGIN}${contentPageMarkdownPath(page.path)}`,
    },
    ...(draft ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

export default function ContentPageRoute({ loaderData }: Route.ComponentProps) {
  const { page, trail, entry, roster, draft, search } = loaderData;
  return (
    <PageShell
      trail={
        <>
          {contentPageJsonLd(page, trail, entry).map((block, i) => (
            <script
              key={i}
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: serializeJsonLd(block) }}
            />
          ))}
        </>
      }
    >
      <Breadcrumb trail={trail} />
      <h1 className="page-title">{page.title}</h1>
      {draft ? <p>Draft: only you can see this page.</p> : null}
      {entry ? <DictionaryEntry entry={entry} /> : null}
      <PhageTools path={page.path} search={search} />
      <div className="prose" dangerouslySetInnerHTML={{ __html: page.html }} />
      {roster ? (
        <div className="prose">
          <PhageRoster cohorts={roster} />
        </div>
      ) : null}
    </PageShell>
  );
}
