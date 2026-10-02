import { data } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { DictionaryEntry } from "~/components/dictionary-entry";
import { Enhance } from "~/components/enhance";
import { PageShell } from "~/components/page-shell";
import { PhageRoster } from "~/components/phage-roster";
import { PhageTools } from "~/components/phage-tool";
import { getPublishedEntryByPath } from "~/db/dictionary";
import { getPageByPath, getPublishedPageTitles } from "~/db/pages";
import { listRoster } from "~/db/roster";
import { getAdminSession } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import {
  contentPageCardPath,
  contentPageMarkdownPath,
  contentPageTrail,
} from "~/lib/content-pages.mjs";
import { definedTermJsonLd, type DictionaryEntry as Entry } from "~/lib/dictionary-entries.mjs";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { CONTENT_PAGE_HTML_TAGS } from "~/lib/pages/route";
import type { PageRecord } from "~/lib/pages/compile.mjs";
import { toolsOnPage } from "~/lib/phage-tools.mjs";
import { ROSTER_PAGE_PATH } from "~/lib/roster/compile.mjs";
import { SITE, SITE_ORIGIN, breadcrumbJsonLd, pageMeta, personId, publicHtmlHeaders } from "~/lib/seo";

import type { Route } from "./+types/content-page";

// prose.css is route-scoped: a page using `.prose` without importing it renders unstyled.
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
type ContentPage = PageRecord;

/**
 * The page's own node, typed from the page, so a WebSite is not emitted as an application. Each property
 * is one the page's frontmatter or its markdown states; a fact the repo does not hold is left out, never
 * filled in. A code repository belongs to SoftwareSourceCode in schema.org, so an application that has
 * one gets a second node for its source, joined to it by targetProduct.
 */
function pageJsonLd(page: ContentPage): object[] {
  if (!page.schemaType) return [];
  const pageUrl = `${SITE_ORIGIN}${page.path}`;
  const person = { "@type": "Person", "@id": personId(SITE_ORIGIN), name: SITE.name, url: SITE_ORIGIN };
  const isDataset = page.schemaType === "Dataset";
  const node = {
    "@context": "https://schema.org",
    "@type": page.schemaType,
    "@id": `${pageUrl}#${page.schemaType.toLowerCase()}`,
    // A dataset is named by what it holds; the page's short title ("Our phages") names the page.
    name: isDataset ? page.seoTitle : page.title,
    description: page.description,
    url: page.productUrl ?? pageUrl,
    ...(page.productUrl ? { mainEntityOfPage: pageUrl } : {}),
    ...(isDataset ? { creator: person } : { author: person }),
    ...(page.schemaType === "SoftwareSourceCode" && page.codeRepository
      ? { codeRepository: page.codeRepository }
      : {}),
    ...(page.applicationCategory ? { applicationCategory: page.applicationCategory } : {}),
    ...(page.programmingLanguage ? { programmingLanguage: page.programmingLanguage } : {}),
    ...(page.runtimePlatform ? { runtimePlatform: page.runtimePlatform } : {}),
    ...(page.license ? { license: page.license } : {}),
    ...(page.dataset
      ? {
          // Public on this page with no sign-in, which is all the property claims.
          isAccessibleForFree: true,
          variableMeasured: page.dataset.variableMeasured,
          ...(page.dataset.temporalCoverage ? { temporalCoverage: page.dataset.temporalCoverage } : {}),
          ...(page.spatialCoverage ? { spatialCoverage: { "@type": "Place", name: page.spatialCoverage } } : {}),
          // The markdown twin carries the same table, so it is the download.
          distribution: {
            "@type": "DataDownload",
            encodingFormat: "text/markdown",
            contentUrl: `${SITE_ORIGIN}${contentPageMarkdownPath(page.path)}`,
          },
        }
      : {}),
  };
  if (page.schemaType !== "SoftwareApplication" || !page.codeRepository) return [node];
  return [
    node,
    {
      "@context": "https://schema.org",
      "@type": "SoftwareSourceCode",
      "@id": `${pageUrl}#softwaresourcecode`,
      name: page.title,
      codeRepository: page.codeRepository,
      author: person,
      targetProduct: { "@id": node["@id"] },
    },
  ];
}

/** The page's structured data: the trail it shows, its own node or nodes, and its dictionary entry. */
function contentPageJsonLd(page: ContentPage, trail: Array<[string, string]>, entry: Entry | null) {
  return [
    // Only a trail the page shows: the visible one renders from two steps, and Google reads no fewer.
    ...(trail.length >= 2 ? [breadcrumbJsonLd(SITE_ORIGIN, trail)] : []),
    ...pageJsonLd(page),
    ...(entry ? [definedTermJsonLd(entry, SITE_ORIGIN)] : []),
  ];
}

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
  if (row.status === "draft" && !(await getAdminSession(env, request))) throw data(null, { status: 404 });
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
function cardUrl(page: ContentPage) {
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
      {/* The phage table is complete as served; this adds its sort and filter (app/enhance/phages.ts). */}
      {page.path === "/research/phages" ? <Enhance module="phages" /> : null}
      {roster ? (
        <div className="prose">
          <PhageRoster cohorts={roster} />
        </div>
      ) : null}
    </PageShell>
  );
}
