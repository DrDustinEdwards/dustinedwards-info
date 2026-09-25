import { Form, Link } from "react-router";

import { AskMount } from "~/components/ask-panel";
import { Enhance } from "~/components/enhance";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { getEnv, getExecutionContext } from "~/lib/context";
import { prefersType } from "~/lib/negotiate.mjs";
import { hasFilters } from "~/lib/search/query.mjs";
import { askAvailable } from "~/lib/search/ask.server";
import { recordZeroResult } from "~/lib/search/zero-result.server";
import {
  parseSort,
  search,
  zeroState,
  type MatchReason,
  type SearchHit,
} from "~/lib/search/search.server";
import {
  NO_STORE_CACHE_CONTROL,
  HTML_VARY_ACCEPT,
  cacheTags,
  SHARED_CACHE_CONTROL,
  SITE,
  SITE_ORIGIN,
  pageMeta,
} from "~/lib/seo";
import type { Route } from "./+types/search";

import "~/styles/blog-search.css";
import "~/styles/search-page.css";
import "~/styles/ask.css";
import "~/styles/search-facets.css";

const PAGE_SIZE = 10;

function readParams(url: URL) {
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  return {
    q: url.searchParams.get("q") ?? "",
    type: url.searchParams.get("type"),
    tag: url.searchParams.get("tag"),
    year: url.searchParams.get("year"),
    sort: parseSort(url.searchParams.get("sort")),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** Middleware: a document route's loader cannot return a raw Response. */
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
          askAvailable: askAvailable(getEnv(context)),
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
          // Never stored; do not "optimize" this back to a shared cache-control. /search varies on Accept and
          // Cookie, and once this JSON variant is stored the edge answers cookie-bearing requests from the
          // cookieless variant, so a `theme=dark` reader gets the light document.
          "cache-control": NO_STORE_CACHE_CONTROL,
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

  const asked = !result.parsed.isEmpty || hasFilters(result.parsed);
  const suggestions = asked && result.total === 0 ? await zeroState(env, result.parsed) : null;

  /* After the response via `waitUntil`, failure logged: demand signal is worth less than the page rendering. */
  if (asked && result.total === 0 && !result.parsed.isEmpty) {
    getExecutionContext(context).waitUntil(
      recordZeroResult(env, params.q).catch((error: unknown) => {
        console.error("zero-result record failed", error);
      }),
    );
  }

  // The loader that renders classic results must never wait on the AI layer.
  return { params, result, suggestions, askAvailable: askAvailable(env) };
}

export function headers() {
  return new Headers({
    // `Accept` stays: this URL also serves JSON.
    "Cache-Control": SHARED_CACHE_CONTROL,
    "Cache-Tag": cacheTags(),
    Vary: HTML_VARY_ACCEPT,
  });
}

export function meta({ loaderData }: Route.MetaArgs) {
  const q = loaderData?.params.q;
  const title = q ? `Search: ${q} | ${SITE.name}` : `Search | ${SITE.name}`;
  return [
    ...pageMeta({
      title,
      description: `Search the writing and pages on ${SITE.name}'s site.`,
      path: "/search",
    }),
    { name: "robots", content: "noindex, follow" },
  ];
}

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
  if (params.sort === "date") next.set("sort", "date");
  return `/search?${next.toString()}`;
}

function pageHref(params: ReturnType<typeof readParams>, page: number) {
  const next = new URLSearchParams();
  if (params.q) next.set("q", params.q);
  if (params.type) next.set("type", params.type);
  if (params.tag) next.set("tag", params.tag);
  if (params.year) next.set("year", params.year);
  if (params.sort === "date") next.set("sort", "date");
  if (page > 1) next.set("page", String(page));
  return `/search?${next.toString()}`;
}

function sortHref(params: ReturnType<typeof readParams>, sort: "relevance" | "date") {
  const next = new URLSearchParams();
  if (params.q) next.set("q", params.q);
  if (params.type) next.set("type", params.type);
  if (params.tag) next.set("tag", params.tag);
  if (params.year) next.set("year", params.year);
  // Relevance is the absent value: two spellings of the default would be two cache entries of one page.
  if (sort === "date") next.set("sort", "date");
  return `/search?${next.toString()}`;
}

/** Keyed by the union with no fallback: a reason without a label is a typecheck failure, not a raw value shown to readers. */
const WHY_LABEL: Record<MatchReason, string> = {
  title: "title",
  tag: "tag",
  body: "body",
  filter: "filter",
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
            <span className="search-why-field">{WHY_LABEL[reason]}</span>
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
  const { params, result, suggestions, askAvailable } = loaderData;
  const { facets } = result;
  const pageCount = Math.max(1, Math.ceil(result.total / result.pageSize));
  // `isEmpty` means no matchable text, not no request: a bare year or tag is answered by the browse path.
  const hasQuery = !result.parsed.isEmpty || hasFilters(result.parsed);

  return (
    <>
      <SiteHeader />
      <main className="search-page" id="main" tabIndex={-1}>
        <h1 className="search-heading">Search</h1>

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
          {params.type ? <input type="hidden" name="type" value={params.type} /> : null}
          {params.tag ? <input type="hidden" name="tag" value={params.tag} /> : null}
          {params.year ? <input type="hidden" name="year" value={params.year} /> : null}
          {params.sort === "date" ? <input type="hidden" name="sort" value="date" /> : null}
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

        <Enhance module="search" />

        {askAvailable && (params.q ?? "").trim().length > 0 ? (
          <AskMount question={params.q ?? ""} />
        ) : null}

        {/* Only on the text path: the browse path is date-ordered in SQL, because a filter carries no relevance signal. */}
        {hasQuery && result.total > 1 && !result.parsed.isEmpty ? (
          <nav className="search-sort" aria-label="Sort results">
            <span className="search-sort-label" id="search-sort-label">
              Sort
            </span>
            <ul aria-labelledby="search-sort-label">
              <li>
                <Link
                  to={sortHref(params, "relevance")}
                  className="search-chip"
                  aria-current={params.sort === "relevance" ? "true" : undefined}
                >
                  Relevance
                </Link>
              </li>
              <li>
                <Link
                  to={sortHref(params, "date")}
                  className="search-chip"
                  aria-current={params.sort === "date" ? "true" : undefined}
                >
                  Newest
                </Link>
              </li>
            </ul>
          </nav>
        ) : null}

        {hasQuery && result.total > 0 ? (
          <div className="search-body">
            <ol className="search-results">
              {result.hits.map((hit) => (
                <Result key={hit.uid} hit={hit} />
              ))}
            </ol>

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
      <ShellFooter />
    </>
  );
}
