import { Catalog } from "capsomer/react/catalog";
import { TabLink, TabsNav } from "capsomer/react/tabs";
import { parseCatalogParams, queryCatalog } from "capsomer/behaviour/catalog";
import { data, redirect } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { Enhance } from "~/components/enhance";
import { LibraryCite } from "~/components/library-cite";
import { LibraryOverview } from "~/components/library-overview";
import { PageShell } from "~/components/page-shell";
import { getPageByPath } from "~/db/pages";
import { listPublishedLibraryRecords } from "~/db/procedures";
import { listRegistry } from "~/db/registry";
import { isAdminViewer } from "~/lib/access.server";
import { getEnv } from "~/lib/context";
import { contentPageMarkdownPath } from "~/lib/content-pages.mjs";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { CONTENT_PAGE_HTML_TAGS } from "~/lib/pages/route";
import { LIBRARY, LIBRARY_PATH, libraryCitation, libraryDownloads, libraryItems, libraryOverview, libraryRedirect, libraryTabs, type LibraryItem } from "~/kb/procedures/library.mjs";
import { methodLabel } from "~/kb/procedures/taxonomy.mjs";
import { registryTabs } from "~/kb/registry/catalog.mjs";
import { REGISTRY_CACHE_TAG } from "~/kb/registry/route";
import { PROCEDURES_CACHE_TAG } from "~/kb/procedures/route";
import { SITE, SITE_ORIGIN, breadcrumbJsonLd, pageMeta, publicHtmlHeaders } from "~/lib/seo";

import type { Route } from "./+types/protocols";

// Route-scoped: the catalog's tokens and components are Capsomer's, and only this page uses them.
import "capsomer/tokens.css";
import "capsomer/field.css";
import "capsomer/button.css";
import "capsomer/table.css";
import "capsomer/chips.css";
import "capsomer/empty.css";
import "capsomer/pagination.css";
import "capsomer/catalog.css";
import "capsomer/tabs.css";
import "~/styles/prose.css";
import "~/styles/site-catalog.css";
import "~/styles/library.css";

/**
 * The protocol library at /research/protocols (docs/PROCEDURES.md): the page's own introduction, then every
 * published protocol as a searchable, filterable, sortable catalog. The rows are the procedure records in D1, so a
 * protocol saved through the operator API appears here at the next request with no deploy and no second list to
 * keep. The catalog is a GET form: with script off every control still works, and every state is an address.
 */
export function headers() {
  return new Headers(publicHtmlHeaders(`${CONTENT_PAGE_HTML_TAGS},${PROCEDURES_CACHE_TAG},${REGISTRY_CACHE_TAG}`));
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const row = await getPageByPath(env, LIBRARY_PATH);
  if (!row) throw data(null, { status: 404 });
  if (row.status === "draft" && !(await isAdminViewer(env, request))) throw data(null, { status: 404 });
  // A state written in another order, or with a default spelled out, goes to its one address.
  const canonical = libraryRedirect(url);
  if (canonical) throw redirect(canonical, 301);
  const items = libraryItems(await listPublishedLibraryRecords(env));
  // The registry's kinds are tabs beside the calculators, counted from its rows (docs/REGISTRY.md).
  const registry = registryTabs(await listRegistry(env, { published: true }));
  return { page: row.record, draft: row.status === "draft", items, registry, search: url.search };
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const { page, draft } = loaderData;
  return [
    ...pageMeta({ title: page.seoTitle, description: page.description, path: page.path }),
    { tagName: "link", rel: "alternate", type: "text/markdown", href: `${SITE_ORIGIN}${contentPageMarkdownPath(page.path)}` },
    ...(draft ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

/** The catalog's quick links, drawn from each protocol's own path: its printable bench sheet and its markdown twin. */
const cells = {
  method: (item: LibraryItem) => item.methods.map(methodLabel).join(", "),
  links: (item: LibraryItem) => (
    <span className="library-links">
      <a href={`${item.path}/sheet`}>Bench sheet</a>
      <a href={`${item.path}.md`}>Markdown</a>
    </span>
  ),
};

export default function ProtocolLibraryRoute({ loaderData }: Route.ComponentProps) {
  const { page, draft, items, registry, search } = loaderData;
  const trail: Array<[string, string]> = [
    ["Research", "/research"],
    ["Protocols", LIBRARY_PATH],
  ];
  // The introduction is the prose before the page's first heading; the sections follow the library.
  const split = page.html.indexOf("<h2");
  const intro = split === -1 ? page.html : page.html.slice(0, split);
  const rest = split === -1 ? "" : page.html.slice(split);
  const result = queryCatalog(LIBRARY, items, parseCatalogParams(LIBRARY, search));
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_ORIGIN}${LIBRARY_PATH}#collectionpage`,
    name: page.title,
    description: page.description,
    url: `${SITE_ORIGIN}${LIBRARY_PATH}`,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: items.length,
      itemListElement: items.map((item, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: item.title,
        url: `${SITE_ORIGIN}${item.path}`,
      })),
    },
  };
  return (
    <PageShell
      trail={
        <>
          {[breadcrumbJsonLd(SITE_ORIGIN, trail), collection].map((block, i) => (
            <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(block) }} />
          ))}
        </>
      }
    >
      <Breadcrumb trail={trail} />
      <h1 className="page-title" id="library-title">
        {page.title}
      </h1>
      {draft ? <p>Draft: only you can see this page.</p> : null}
      <div className="prose" dangerouslySetInnerHTML={{ __html: intro }} />
      <LibraryOverview overview={libraryOverview(items)} />
      <div className="library site-catalog site-catalog-wide">
        <TabsNav aria-label="Protocols by kind of work" variant="line">
          {libraryTabs(items, result.state.filters.method ?? [], registry).map((tab) => (
            <TabLink key={tab.id} href={tab.href} current={tab.current} count={tab.count}>
              {tab.label}
            </TabLink>
          ))}
        </TabsNav>
        <Catalog
          definition={LIBRARY}
          result={result}
          labelledBy="library-title"
          title={(item) => (
            <a className="cap-table-open" href={item.path}>
              {item.title}
            </a>
          )}
          cells={cells}
        />
      </div>
      <LibraryCite
        count={result.count}
        downloads={libraryDownloads(result)}
        citation={libraryCitation({ name: SITE.name, affiliation: SITE.affiliation, origin: SITE_ORIGIN })}
      />
      {rest ? <div className="prose" dangerouslySetInnerHTML={{ __html: rest }} /> : null}
      <Enhance module="catalog" />
    </PageShell>
  );
}
