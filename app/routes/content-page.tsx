import { data } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { DictionaryEntry } from "~/components/dictionary-entry";
import { Enhance } from "~/components/enhance";
import { PageShell } from "~/components/page-shell";
import { PhageRoster } from "~/components/phage-roster";
import { PhageTools } from "~/components/phage-tool";
import {
  contentPageCardPath,
  contentPageMarkdownPath,
  contentPageTrail,
} from "~/lib/content-pages.mjs";
import { definedTermJsonLd, dictionaryEntryFor } from "~/lib/dictionary-entries.mjs";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { toolsOnPage } from "~/lib/phage-tools.mjs";
import { SITE, SITE_ORIGIN, breadcrumbJsonLd, pageMeta, personId, publicHtmlHeaders } from "~/lib/seo";

import generated from "../../content/generated/pages.json";

import type { Route } from "./+types/content-page";

// prose.css is route-scoped: a page using `.prose` without importing it renders unstyled.
import "~/styles/prose.css";

/**
 * Every Research and Teaching page (app/lib/content-pages.mjs): the research/* splat, and /teaching through
 * routes/teaching.tsx. The HTML is rendered at build time from repo markdown with the URL allowlist
 * already applied, so the Worker carries no markdown renderer and nothing third-party reaches the page.
 * The markdown twin is a static asset at the page path plus `.md` (build:content), not a second copy in
 * this bundle: pages.json keeps only what the route renders.
 */
type ContentPage = {
  path: string;
  title: string;
  seoTitle: string;
  description: string;
  html: string;
  /** Set where the frontmatter declares it (build:content); a page without one emits no typed node. */
  schemaType?: string;
  productUrl?: string;
  codeRepository?: string;
  applicationCategory?: string;
  license?: string;
  programmingLanguage?: string;
  runtimePlatform?: string;
  spatialCoverage?: string;
  /** What the page's first table says, for a Dataset. */
  dataset?: { variableMeasured: string[]; temporalCoverage: string | null; rows: number };
};

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
function contentPageJsonLd(page: ContentPage, trail: Array<[string, string]>) {
  const entry = dictionaryEntryFor(page.path);
  return [
    // Only a trail the page shows: the visible one renders from two steps, and Google reads no fewer.
    ...(trail.length >= 2 ? [breadcrumbJsonLd(SITE_ORIGIN, trail)] : []),
    ...pageJsonLd(page),
    ...(entry ? [definedTermJsonLd(entry, SITE_ORIGIN)] : []),
  ];
}

const PAGES = new Map((generated.pages as ContentPage[]).map((page) => [page.path, page]));

export function headers() {
  return new Headers(publicHtmlHeaders());
}

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const page = PAGES.get(pathname);
  // Registered only for listed paths, and the build refuses a missing file, so this is a broken build.
  if (!page) throw data(null, { status: 404 });
  // A calculator page computes from its query string, so Calculate works as a plain GET with script off.
  return { page, search: toolsOnPage(page.path).length > 0 ? url.search : "" };
}

/** The page's own social card where build:og draws one (CARDED_PAGE_ROOTS), else the site card. */
function cardUrl(page: ContentPage) {
  const path = contentPageCardPath(page);
  return path ? `${SITE_ORIGIN}${path}` : undefined;
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const { page } = loaderData;
  return [
    ...pageMeta({ title: page.seoTitle, description: page.description, path: page.path, image: cardUrl(page) }),
    {
      tagName: "link",
      rel: "alternate",
      type: "text/markdown",
      href: `${SITE_ORIGIN}${contentPageMarkdownPath(page.path)}`,
    },
  ];
}

export default function ContentPageRoute({ loaderData }: Route.ComponentProps) {
  const { page, search } = loaderData;
  const titleOf = (path: string) => PAGES.get(path)?.title;
  const trail = contentPageTrail(page, titleOf);
  const entry = dictionaryEntryFor(page.path);
  return (
    <PageShell
      trail={
        <>
          {contentPageJsonLd(page, trail).map((block, i) => (
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
      {entry ? <DictionaryEntry entry={entry} /> : null}
      <PhageTools path={page.path} search={search} />
      <div className="prose" dangerouslySetInnerHTML={{ __html: page.html }} />
      {/* The phage table is complete as served; this adds its sort and filter (app/enhance/phages.ts). */}
      {page.path === "/research/phages" ? <Enhance module="phages" /> : null}
      {page.path === "/teaching/phage-discovery" ? (
        <div className="prose">
          <PhageRoster />
        </div>
      ) : null}
    </PageShell>
  );
}
