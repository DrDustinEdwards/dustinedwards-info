import { JsonLd } from "capsomer/react/json-ld";
import { DraftNotice } from "capsomer/react/draft-notice";
import { Catalog } from "capsomer/react/catalog";
import { TabLink, TabsNav } from "capsomer/react/tabs";
import {
  catalogDownloads,
  catalogRedirect,
  parseCatalogParams,
  queryCatalog,
} from "capsomer/behavior/catalog";
import { redirect } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { LibraryCite } from "~/components/library-cite";
import { LibraryOverview } from "~/components/library-overview";
import { PageShell } from "~/components/page-shell";
import { getPageByPath } from "~/db/pages";
import { listPublishedRecordsOfProfile } from "~/db/procedures";
import { listRegistry } from "~/db/registry";
import { draftGate, draftRobots } from "@dustinedwards/site-runtime/draft-gate";
import { isAdminViewer } from "~/lib/access.server";
import { getEnv } from "~/lib/context";
import { contentPageMarkdownPath } from "~/lib/content-pages.mjs";
import { thing } from "@drdustinedwards/site-helpers/schema";
import { CONTENT_PAGE_HTML_TAGS } from "~/lib/pages/route";
import {
  LIBRARY,
  LIBRARY_PATH,
  libraryCitation,
  libraryItems,
  libraryOverview,
  libraryTabs,
  type LibraryItem,
} from "~/kb/procedures/library.mjs";
import { methodLabel } from "~/kb/procedures/taxonomy.mjs";
import { registryTabs } from "~/kb/registry/catalog.mjs";
import { REGISTRY_CACHE_TAG } from "~/kb/registry/route";
import { PROCEDURES_CACHE_TAG } from "~/kb/procedures/route";
import { SITE, SITE_ORIGIN, pageMeta, publicHtmlHeaders, type Trail } from "~/lib/seo";

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
import "capsomer/step-indicator.css";
import "~/styles/prose.css";
import "~/styles/site-catalog.css";
import "~/styles/library.css";
import { RENDERED } from "~/lib/content/render-version";
import { PROSE } from "~/lib/prose-context";
import { markup } from "capsomer/behavior/trusted-html";

/**
 * The protocol library at /research/protocols (docs/PROCEDURES.md): the page's own introduction, then every
 * published protocol as a searchable, filterable, sortable catalog. The rows are the procedure records in D1, so a
 * protocol saved through the operator API appears here at the next request with no deploy and no second list to
 * keep. The catalog is a GET form: with script off every control still works, and every state is an address.
 */
export function headers() {
  return new Headers(
    publicHtmlHeaders(`${CONTENT_PAGE_HTML_TAGS},${PROCEDURES_CACHE_TAG},${REGISTRY_CACHE_TAG}`),
  );
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const { row, draft } = await draftGate(await getPageByPath(env, LIBRARY_PATH), () =>
    isAdminViewer(env, request),
  );
  // A state written in another order, or with a default spelled out, goes to its one address.
  const canonical = catalogRedirect(LIBRARY, url, { keepUnknown: true });
  if (canonical) throw redirect(canonical, 301);
  const items = libraryItems(await listPublishedRecordsOfProfile(env, "protocol"));
  // The registry's kinds are tabs beside the calculators, counted from its rows (docs/REGISTRY.md).
  const registry = registryTabs(await listRegistry(env, { published: true }));
  return { page: row.record, draft, items, registry, search: url.search };
}

const TRAIL: Trail = [
  ["Research", "/research"],
  ["Protocols", LIBRARY_PATH],
];

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const { page, draft } = loaderData;
  return [
    ...pageMeta({
      title: page.seoTitle,
      description: page.description,
      path: page.path,
      pageType: "CollectionPage",
      trail: TRAIL,
    }),
    {
      tagName: "link",
      rel: "alternate",
      type: "text/markdown",
      href: `${SITE_ORIGIN}${contentPageMarkdownPath(page.path)}`,
    },
    ...draftRobots(draft),
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
  // The introduction is the prose before the page's first heading; the sections follow the library.
  const split = page.html.indexOf("<h2");
  const intro = split === -1 ? page.html : page.html.slice(0, split);
  const rest = split === -1 ? "" : page.html.slice(split);
  const result = queryCatalog(LIBRARY, items, parseCatalogParams(LIBRARY, search));
  // Prelum's page node, by its `@id`, with the list it holds.
  const collection = thing("CollectionPage", {
    "@id": `${SITE_ORIGIN}${LIBRARY_PATH}#webpage`,
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
  });
  return (
    <PageShell trail={<JsonLd data={collection} />}>
      <Breadcrumb trail={TRAIL} />
      <h1 className="page-title cap-layout-grid" id="library-title">
        {page.title}
      </h1>
      <DraftNotice show={draft} />
      <div className="prose" {...PROSE} {...RENDERED} dangerouslySetInnerHTML={markup(intro)} />
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
        downloads={catalogDownloads(LIBRARY, result)}
        citation={libraryCitation({
          name: SITE.name,
          affiliation: SITE.affiliation,
          origin: SITE_ORIGIN,
        })}
      />
      {rest ? (
        <div className="prose" {...PROSE} {...RENDERED} dangerouslySetInnerHTML={markup(rest)} />
      ) : null}
      <template data-island="catalog" />
    </PageShell>
  );
}
