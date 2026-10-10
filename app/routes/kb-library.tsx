import { Catalog } from "capsomer/react/catalog";
import { parseCatalogParams, queryCatalog } from "capsomer/behaviour/catalog";
import { data, redirect } from "react-router";

import { Breadcrumb } from "~/components/breadcrumb";
import { Enhance } from "~/components/enhance";
import { LibraryCite } from "~/components/library-cite";
import { PageShell } from "~/components/page-shell";
import { listPublishedRecordsOfProfile } from "~/db/procedures";
import { isAdminViewer } from "~/lib/access.server";
import { getEnv } from "~/lib/context";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { countOf } from "~/kb/procedures/library.mjs";
import { methodLabel } from "~/kb/procedures/taxonomy.mjs";
import { PROCEDURES_CACHE_TAG } from "~/kb/procedures/route";
import {
  baseAtLibrary,
  baseCatalog,
  baseCitation,
  baseDownloads,
  baseItems,
  baseRedirect,
  libraryTrail,
  nounOf,
  type BaseItem,
} from "~/kb/libraries.mjs";
import {
  SITE,
  SITE_ORIGIN,
  breadcrumbJsonLd,
  pageMeta,
  publicHtmlHeaders,
} from "~/lib/seo";

import type { Route } from "./+types/kb-library";

// Route-scoped, as on the protocol library: the catalog's tokens and components are Capsomer's.
import "capsomer/tokens.css";
import "capsomer/field.css";
import "capsomer/button.css";
import "capsomer/table.css";
import "capsomer/chips.css";
import "capsomer/empty.css";
import "capsomer/pagination.css";
import "capsomer/catalog.css";
import "~/styles/prose.css";
import "~/styles/site-catalog.css";
import "~/styles/library.css";

/**
 * A knowledge base's library (docs/KNOWLEDGE-BASE.md, step 8): Recipes at /recipes and Software how-tos at
 * /software/how-tos, each every published entry of its base as a searchable, filterable catalog drawn from the
 * procedure rows in D1, so an entry saved appears at the next request. A library with no published entry is not a page
 * yet: the public gets a 404 and the signed-in admin sees it empty, until the first entry is published.
 */
export function headers() {
  return new Headers(publicHtmlHeaders(PROCEDURES_CACHE_TAG));
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const base = baseAtLibrary(url.pathname);
  if (!base) throw data(null, { status: 404 });
  const items = baseItems(
    base,
    await listPublishedRecordsOfProfile(env, base.profile),
  );
  const empty = items.length === 0;
  if (empty && !(await isAdminViewer(env, request)))
    throw data(null, { status: 404 });
  const canonical = baseRedirect(base, url);
  if (canonical) throw redirect(canonical, 301);
  return { base, items, empty, search: url.search };
}

/** What the library is, in one line, from its base and its rows. */
function lead(
  base: NonNullable<ReturnType<typeof baseAtLibrary>>,
  items: BaseItem[],
) {
  const noun = nounOf(base);
  const dates = items
    .map((p) => p.updated)
    .filter(Boolean)
    .sort();
  return `${countOf(items.length, noun)} from the ${SITE.name} Lab${dates.length ? `, newest updated ${dates.at(-1)}` : ""}.`;
}

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData) return [];
  const { base, items, empty } = loaderData;
  return [
    ...pageMeta({
      title: `${base.name} | ${SITE.name}`,
      description: lead(base, items),
      path: base.library,
    }),
    {
      tagName: "link",
      rel: "alternate",
      type: "text/markdown",
      href: `${SITE_ORIGIN}${base.library}.md`,
    },
    ...(empty ? [{ name: "robots", content: "noindex" }] : []),
  ];
}

const cells = {
  method: (item: BaseItem) => item.methods.map(methodLabel).join(", "),
  category: (item: BaseItem) => item.category,
};

export default function KbLibraryRoute({ loaderData }: Route.ComponentProps) {
  const { base, items, empty, search } = loaderData;
  const catalog = baseCatalog(base);
  const trail = libraryTrail(base);
  const result = queryCatalog(
    catalog,
    items,
    parseCatalogParams(catalog, search),
  );
  const collection = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_ORIGIN}${base.library}#collectionpage`,
    name: base.name,
    description: lead(base, items),
    url: `${SITE_ORIGIN}${base.library}`,
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
          {[breadcrumbJsonLd(SITE_ORIGIN, trail), collection].map(
            (block, i) => (
              <script
                key={i}
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: serializeJsonLd(block) }}
              />
            ),
          )}
        </>
      }
    >
      <Breadcrumb trail={trail} />
      <h1 className="page-title" id="library-title">
        {base.name}
      </h1>
      {empty ? (
        <p className="procedure-draft">
          Only you can see this page: no {base.singular.toLowerCase()} is
          published yet. It goes public with the first one.
        </p>
      ) : null}
      <p className="library-counts">{lead(base, items)}</p>
      <div className="library site-catalog site-catalog-wide">
        <Catalog
          definition={catalog}
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
      {/* An empty library's downloads are not there yet (its twin and downloads answer 404 too). */}
      {empty ? null : (
        <LibraryCite
          count={result.count}
          noun={nounOf(base)}
          downloads={baseDownloads(base, result)}
          citation={baseCitation(base, {
            name: SITE.name,
            affiliation: SITE.affiliation,
            origin: SITE_ORIGIN,
          })}
        />
      )}
      <Enhance module="catalog" />
    </PageShell>
  );
}
