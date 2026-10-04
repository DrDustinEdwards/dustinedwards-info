// The structured data a content page carries: its trail, its own node typed from the page, and its dictionary entry.
// Shared by the research/* page route and the routes that draw a page's own piece themselves (the phage table).
import type { PageRecord } from "~/lib/pages/compile.mjs";
import { contentPageMarkdownPath } from "~/lib/content-pages.mjs";
import { definedTermJsonLd, type DictionaryEntry as Entry } from "~/lib/dictionary-entries.mjs";
import { SITE, SITE_ORIGIN, breadcrumbJsonLd, personId } from "~/lib/seo";

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
export function contentPageJsonLd(page: ContentPage, trail: Array<[string, string]>, entry: Entry | null) {
  return [
    // Only a trail the page shows: the visible one renders from two steps, and Google reads no fewer.
    ...(trail.length >= 2 ? [breadcrumbJsonLd(SITE_ORIGIN, trail)] : []),
    ...pageJsonLd(page),
    ...(entry ? [definedTermJsonLd(entry, SITE_ORIGIN)] : []),
  ];
}

