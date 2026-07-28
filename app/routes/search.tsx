import { Form, Link } from "react-router";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import { getEnv } from "~/lib/context";
import { prefersType } from "~/lib/negotiate";
import { search, zeroState, type SearchHit } from "~/lib/search/search.server";
import { PUBLIC_CACHE_CONTROL, SITE, SITE_ORIGIN } from "~/lib/seo";
import type { Route } from "./+types/search";

const PAGE_SIZE = 10;

/**
 * Reads the query parameters this route understands.
 *
 * `type`, `tag` and `year` are separate parameters as well as query operators,
 * so a facet chip can be an ordinary link rather than a second filter language
 * that only the form knows how to speak. Both feed the same parse.
 */
function readParams(url: URL) {
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  return {
    q: url.searchParams.get("q") ?? "",
    type: url.searchParams.get("type"),
    tag: url.searchParams.get("tag"),
    year: url.searchParams.get("year"),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/**
 * JSON negotiation runs as middleware, not in the loader.
 *
 * A document route's loader cannot return a raw Response: React Router hands it
 * to the component as `loaderData` and the first property read 500s. Measured
 * on this repo 2026-07-28. Middleware is the layer allowed to short-circuit,
 * which is the same mechanism `/blog/:slug` uses for its markdown twin and the
 * same one the /admin gate uses.
 *
 * The JSON representation is the SAME query against the SAME index. It is an
 * agent affordance, not a second search, and it is documented in llms.txt.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    if (!prefersType(request, "application/json")) return next();

    const url = new URL(request.url);
    const params = readParams(url);
    const result = await search(getEnv(context), { ...params, pageSize: PAGE_SIZE });

    return new Response(
      JSON.stringify(
        {
          query: result.parsed.raw,
          parsed: {
            terms: result.parsed.terms,
            phrases: result.parsed.phrases,
            tags: result.parsed.tags,
            types: result.parsed.types,
            year: result.parsed.year,
          },
          total: result.total,
          page: result.page,
          pageSize: result.pageSize,
          truncated: result.truncated,
          tookMs: result.tookMs,
          facets: result.facets,
          results: result.hits.map((hit) => ({
            url: `${SITE_ORIGIN}${hit.url}`,
            type: hit.type,
            title: hit.title,
            documentTitle: hit.docTitle,
            anchor: hit.anchor,
            tags: hit.tags,
            publishedAt: hit.publishAt ? new Date(hit.publishAt * 1000).toISOString() : null,
            snippet: hit.snippet,
            matchedOn: hit.why,
          })),
        },
        null,
        2,
      ),
      {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": PUBLIC_CACHE_CONTROL,
          // The body depends on Accept, so caches must key on it.
          vary: "Accept",
        },
      },
    );
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const params = readParams(url);
  const env = getEnv(context);

  const result = await search(env, { ...params, pageSize: PAGE_SIZE });

  // Only ask for suggestions when there is a query that found nothing. A blank
  // /search is a search box, not a failure, and does not need consoling.
  const suggestions =
    !result.parsed.isEmpty && result.total === 0 ? await zeroState(env, result.parsed) : null;

  return { params, result, suggestions };
}

export function headers() {
  return new Headers({
    "Cache-Control": PUBLIC_CACHE_CONTROL,
    Vary: "Accept",
  });
}

export function meta({ loaderData }: Route.MetaArgs) {
  const q = loaderData?.params.q;
  const title = q ? `Search: ${q} | ${SITE.name}` : `Search | ${SITE.name}`;
  return [
    { title },
    { name: "description", content: `Search the writing and pages on ${SITE.name}'s site.` },
    // A search results page is not something a search engine should index.
    { name: "robots", content: "noindex, follow" },
  ];
}

/** Builds a URL that keeps the current query and changes one facet. */
function facetHref(
  params: ReturnType<typeof readParams>,
  key: "type" | "tag" | "year",
  value: string | null,
) {
  const next = new URLSearchParams();
  if (params.q) next.set("q", params.q);
  const current = { type: params.type, tag: params.tag, year: params.year };
  current[key] = value;
  for (const [k, v] of Object.entries(current)) {
    if (v) next.set(k, v);
  }
  // Changing a filter always returns to the first page. Staying on page 4 of a
  // narrower result set is how a filter appears to return nothing.
  return `/search?${next.toString()}`;
}

function pageHref(params: ReturnType<typeof readParams>, page: number) {
  const next = new URLSearchParams();
  if (params.q) next.set("q", params.q);
  if (params.type) next.set("type", params.type);
  if (params.tag) next.set("tag", params.tag);
  if (params.year) next.set("year", params.year);
  if (page > 1) next.set("page", String(page));
  return `/search?${next.toString()}`;
}

const WHY_LABEL: Record<string, string> = {
  title: "title",
  tag: "tag",
  body: "body",
};

function Result({ hit }: { hit: SearchHit }) {
  return (
    <li className="search-result">
      <div className="search-result-head">
        <span className="search-type" data-type={hit.type}>
          {hit.type}
        </span>
        <h2 className="search-result-title">
          <Link to={hit.url}>{hit.title}</Link>
        </h2>
      </div>

      {/* A section hit says which document it came from, so a deep link into
          the middle of a post is not mistaken for a separate page. */}
      {hit.anchor ? (
        <p className="search-result-context">
          in <Link to={hit.docUrl}>{hit.docTitle}</Link>
        </p>
      ) : null}

      {/* Safe as HTML: the snippet was escaped before its <mark> markers were
          substituted in. See renderSnippet in search.server.ts. */}
      <p
        className="search-snippet"
        dangerouslySetInnerHTML={{ __html: hit.snippet }}
      />

      <p className="search-why">
        matched on{" "}
        {hit.why.map((reason, i) => (
          <span key={reason}>
            {i > 0 ? ", " : ""}
            <span className="search-why-field">{WHY_LABEL[reason] ?? reason}</span>
          </span>
        ))}
        {hit.publishAt ? (
          <>
            {" "}
            <span className="search-why-sep">/</span>{" "}
            <time dateTime={new Date(hit.publishAt * 1000).toISOString()}>
              {new Date(hit.publishAt * 1000).getUTCFullYear()}
            </time>
          </>
        ) : null}
      </p>
    </li>
  );
}

export default function SearchPage({ loaderData }: Route.ComponentProps) {
  const { params, result, suggestions } = loaderData;
  const { facets } = result;
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  const hasQuery = !result.parsed.isEmpty;

  return (
    <>
      <SiteHeader />
      <main className="search-page" id="main">
        <h1 className="search-heading">Search</h1>

        {/* A plain GET form. No client script is involved in producing results:
            the HTML that arrives is already the answer. */}
        <Form method="get" action="/search" role="search" className="search-form">
          <label className="search-label" htmlFor="q">
            Search this site
          </label>
          <div className="search-input-row">
            <input
              type="search"
              id="q"
              name="q"
              defaultValue={params.q}
              placeholder="Try: d1, tag:cloudflare, 2026, or a quoted phrase"
              autoComplete="off"
              className="search-input"
            />
            <button type="submit" className="search-submit">
              Search
            </button>
          </div>
          {/* Active filters ride along as hidden fields so submitting a new
              query from a filtered page keeps the filter. */}
          {params.type ? <input type="hidden" name="type" value={params.type} /> : null}
          {params.tag ? <input type="hidden" name="tag" value={params.tag} /> : null}
          {params.year ? <input type="hidden" name="year" value={params.year} /> : null}
          <p className="search-hint">
            Operators: <code>tag:</code>, <code>type:</code>, a bare year, and
            &quot;quoted phrases&quot;.
          </p>
        </Form>

        {hasQuery ? (
          <p className="search-count" aria-live="polite">
            {result.total === 0
              ? "No results"
              : `${result.total}${result.truncated ? "+" : ""} result${
                  result.total === 1 ? "" : "s"
                }`}
            {result.parsed.year !== null ? ` from ${result.parsed.year}` : ""}
          </p>
        ) : null}

        {/* Active filters, each removable. Shown before the facets so what is
            currently narrowing the list is never further away than what could. */}
        {params.type || params.tag || params.year ? (
          <ul className="search-active-filters">
            {params.type ? (
              <li>
                <Link to={facetHref(params, "type", null)} className="search-chip is-active">
                  type: {params.type} <span aria-hidden="true">x</span>
                  <span className="sr-only">remove filter</span>
                </Link>
              </li>
            ) : null}
            {params.tag ? (
              <li>
                <Link to={facetHref(params, "tag", null)} className="search-chip is-active">
                  tag: {params.tag} <span aria-hidden="true">x</span>
                  <span className="sr-only">remove filter</span>
                </Link>
              </li>
            ) : null}
            {params.year ? (
              <li>
                <Link to={facetHref(params, "year", null)} className="search-chip is-active">
                  {params.year} <span aria-hidden="true">x</span>
                  <span className="sr-only">remove filter</span>
                </Link>
              </li>
            ) : null}
          </ul>
        ) : null}

        {hasQuery && result.total > 0 ? (
          <div className="search-body">
            <ol className="search-results">
              {result.hits.map((hit) => (
                <Result key={hit.uid} hit={hit} />
              ))}
            </ol>

            {/* Facets are links, never click handlers, and their counts come
                from the same query that produced the list, so a chip only ever
                promises results a click would actually return. */}
            <aside className="search-facets" aria-label="Filter results">
              {facets.types.length > 1 ? (
                <section>
                  <h2>Type</h2>
                  <ul>
                    {facets.types.map((facet) => (
                      <li key={facet.value}>
                        <Link
                          to={facetHref(params, "type", facet.value)}
                          className="search-chip"
                        >
                          {facet.value} <span className="search-chip-count">{facet.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {facets.tags.length > 0 ? (
                <section>
                  <h2>Tag</h2>
                  <ul>
                    {facets.tags.map((facet) => (
                      <li key={facet.value}>
                        <Link to={facetHref(params, "tag", facet.value)} className="search-chip">
                          {facet.value} <span className="search-chip-count">{facet.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {facets.years.length > 0 ? (
                <section>
                  <h2>Year</h2>
                  <ul>
                    {facets.years.map((facet) => (
                      <li key={facet.value}>
                        <Link
                          to={facetHref(params, "year", String(facet.value))}
                          className="search-chip"
                        >
                          {facet.value} <span className="search-chip-count">{facet.count}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </aside>
          </div>
        ) : null}

        {/* The zero state suggests rather than dead-ends. */}
        {hasQuery && result.total === 0 && suggestions ? (
          <div className="search-zero">
            <p>
              Nothing matched <strong>{result.parsed.raw}</strong>.
            </p>
            {suggestions.nearestTags.length > 0 ? (
              <section>
                <h2>Related tags</h2>
                <ul className="search-chip-row">
                  {suggestions.nearestTags.map((tag) => (
                    <li key={tag}>
                      <Link to={`/search?tag=${encodeURIComponent(tag)}`} className="search-chip">
                        {tag}
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {suggestions.recentPosts.length > 0 ? (
              <section>
                <h2>Recent writing</h2>
                <ul className="search-recent">
                  {suggestions.recentPosts.map((post) => (
                    <li key={post.url}>
                      <Link to={post.url}>{post.title}</Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}

        {pageCount > 1 ? (
          <nav className="search-pagination" aria-label="Search results pages">
            {result.page > 1 ? (
              <Link rel="prev" to={pageHref(params, result.page - 1)}>
                Previous
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
            <span>
              Page {result.page} of {pageCount}
            </span>
            {result.page < pageCount ? (
              <Link rel="next" to={pageHref(params, result.page + 1)}>
                Next
              </Link>
            ) : (
              <span aria-hidden="true" />
            )}
          </nav>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
