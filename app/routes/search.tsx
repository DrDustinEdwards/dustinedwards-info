import { resultsText, snippetHtml } from "capsomer/behavior/search-results";
import { Pagination, pageCountOf } from "capsomer/react/pagination";
import { SearchResult, SearchResults } from "capsomer/react/search-results";
import { Link, data, redirect } from "react-router";

import { AskMount } from "~/components/ask-panel";
import { SearchForm } from "~/components/search-form";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import { nextScheduledPublishAt } from "~/db";
import { getEnv, getExecutionContext } from "~/lib/context";
import { prefersType } from "~/lib/negotiate.mjs";
import { hasFilters } from "@drdustinedwards/site-helpers/search";
import { askAvailable } from "~/lib/search/ask.server";
import { recordZeroResult } from "~/lib/search/zero-result.server";
import { SEARCH_BASES, baseLabel } from "~/kb/search-bases.mjs";
import {
  parseSort,
  search,
  zeroState,
  type MatchReason,
  type SearchHit,
} from "~/lib/search/search.server";
import {
  EDGE_CACHE_HEADER,
  NO_STORE_CACHE_CONTROL,
  HTML_VARY_ACCEPT,
  cacheTags,
  scheduledEdgeCacheControl,
  SHARED_CACHE_CONTROL,
  SITE,
  SITE_ORIGIN,
  pageMeta,
} from "~/lib/seo";
import type { Route } from "./+types/search";

import "capsomer/chips.css";
import "capsomer/status.css";
import "capsomer/pagination.css";
import "capsomer/search-results.css";
import "~/styles/search-page.css";
import "~/styles/search-form.css";
import "capsomer/field.css";
import "capsomer/button.css";
import "~/styles/ask.css";
import { errorMessage } from "@dustinedwards/site-runtime/log";

const PAGE_SIZE = 10;

function readParams(url: URL) {
  const page = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  return {
    q: url.searchParams.get("q") ?? "",
    type: url.searchParams.get("type"),
    base: url.searchParams.get("base"),
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
            tags: result.parsed.filters.tag,
            types: result.parsed.filters.type,
            bases: result.parsed.filters.base,
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
            snippet: snippetHtml(hit.snippet),
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

  const [result, nextPublishAt] = await Promise.all([
    search(env, { ...params, pageSize: PAGE_SIZE }),
    nextScheduledPublishAt(env),
  ]);

  // Out of range goes to the last real page, as the blog's listings do.
  const pageCount = pageCountOf(result.total, result.pageSize);
  if (params.page > pageCount) throw redirect(searchHref(params, { page: pageCount }));

  const asked = !result.parsed.isEmpty || hasFilters(result.parsed);
  const suggestions = asked && result.total === 0 ? await zeroState(env, result.parsed) : null;

  /* After the response via `waitUntil`, failure logged: demand signal is worth less than the page rendering. */
  if (asked && result.total === 0 && !result.parsed.isEmpty) {
    getExecutionContext(context).waitUntil(
      recordZeroResult(env, params.q).catch((error: unknown) => {
        console.error(
          JSON.stringify({ alert: "zero-result-record-failed", detail: errorMessage(error) }),
        );
      }),
    );
  }

  // The loader that renders classic results must never wait on the AI layer.
  return data(
    { params, result, suggestions, askAvailable: askAvailable(env) },
    { headers: { [EDGE_CACHE_HEADER]: scheduledEdgeCacheControl(new Date(), nextPublishAt) } },
  );
}

export function headers({ loaderHeaders }: Route.HeadersArgs) {
  const headers = new Headers({
    // `Accept` stays: this URL also serves JSON.
    "Cache-Control": SHARED_CACHE_CONTROL,
    "Cache-Tag": cacheTags(),
    Vary: HTML_VARY_ACCEPT,
  });
  const edge = loaderHeaders.get(EDGE_CACHE_HEADER);
  if (edge) headers.set(EDGE_CACHE_HEADER, edge);
  return headers;
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

type SearchParams = ReturnType<typeof readParams>;
type FacetKey = "type" | "base" | "tag" | "year";

/**
 * The current search with some parts changed. A change of filter or sort drops the page, since
 * the old page number means nothing in the new list; only a pager link passes one.
 */
function searchHref(
  params: SearchParams,
  change: Partial<Pick<SearchParams, FacetKey | "sort" | "page">> = {},
) {
  const merged = { ...params, page: 1, ...change };
  const next = new URLSearchParams();
  if (merged.q) next.set("q", merged.q);
  if (merged.type) next.set("type", merged.type);
  if (merged.base) next.set("base", merged.base);
  if (merged.tag) next.set("tag", merged.tag);
  if (merged.year) next.set("year", merged.year);
  // Relevance is the absent value: two spellings of the default would be two cache entries of one page.
  if (merged.sort === "date") next.set("sort", "date");
  if (merged.page > 1) next.set("page", String(merged.page));
  return `/search?${next.toString()}`;
}

/** A filter in force, as a chip whose link is the same search without it. */
function ActiveFilterChip({
  params,
  facet,
  label,
}: {
  params: SearchParams;
  facet: FacetKey;
  label: string;
}) {
  return (
    <Link to={searchHref(params, { [facet]: null })} className="cap-chip" aria-current="true">
      {label} <span aria-hidden="true">x</span>
      <span className="cap-sr-only">remove filter</span>
    </Link>
  );
}

/** One facet's choices, each a link narrowing the search to it, with its count. */
function FacetSection({
  params,
  facet,
  heading,
  values,
  floor,
}: {
  params: SearchParams;
  facet: FacetKey;
  heading: string;
  values: Array<{ value: string | number; label?: string; count: number }>;
  floor: string;
}) {
  return (
    <section>
      <h2>{heading}</h2>
      <nav className="cap-chips" aria-label={heading}>
        {values.map((entry) => (
          <Link
            key={entry.value}
            to={searchHref(params, { [facet]: String(entry.value) })}
            className="cap-chip"
          >
            {entry.label ?? entry.value}{" "}
            <span className="cap-chip-count">
              {entry.count}
              {floor}
            </span>
          </Link>
        ))}
      </nav>
    </section>
  );
}

/** Keyed by the union with no fallback: a reason without a label is a typecheck failure, not a raw value shown to readers. */
const WHY_LABEL: Record<MatchReason, string> = {
  title: "title",
  tag: "tag",
  body: "body",
  filter: "filter",
};

function Result({ hit }: { hit: SearchHit }) {
  const published = hit.publishAt ? new Date(hit.publishAt * 1000) : null;
  return (
    <SearchResult
      href={hit.url}
      title={hit.title}
      kind={hit.type}
      context={
        hit.anchor ? (
          <>
            in <Link to={hit.docUrl}>{hit.docTitle}</Link>
          </>
        ) : undefined
      }
      snippet={hit.snippet}
      why={
        <>
          matched on {hit.why.map((reason) => WHY_LABEL[reason]).join(", ")}
          {published ? (
            <>
              {" "}
              / <time dateTime={published.toISOString()}>{published.getUTCFullYear()}</time>
            </>
          ) : null}
        </>
      }
    />
  );
}

/** A search that matched nothing: said plainly, with nearby tags and recent writing to go to instead. */
function ZeroState({
  raw,
  suggestions,
}: {
  raw: string;
  suggestions: NonNullable<Route.ComponentProps["loaderData"]["suggestions"]>;
}) {
  return (
    <div className="cap-search-empty">
      <p>
        Nothing matched <strong>{raw}</strong>.
      </p>
      {suggestions.nearestTags.length > 0 ? (
        <section aria-labelledby="search-related-tags">
          <h2 id="search-related-tags">Related tags</h2>
          <nav className="cap-chips" aria-label="Related tags">
            {suggestions.nearestTags.map((tag) => (
              <Link key={tag} to={`/search?tag=${encodeURIComponent(tag)}`} className="cap-chip">
                {tag}
              </Link>
            ))}
          </nav>
        </section>
      ) : null}
      {suggestions.recentPosts.length > 0 ? (
        <section aria-labelledby="search-recent-writing">
          <h2 id="search-recent-writing">Recent writing</h2>
          <ul>
            {suggestions.recentPosts.map((post) => (
              <li key={post.url}>
                <Link to={post.url}>{post.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Capsomer's steps pager. A truncated match set has no true total, so it reads "Page n" with no "of m". */
function ResultsPagination({
  params,
  page,
  pageCount,
  truncated,
}: {
  params: SearchParams;
  page: number;
  pageCount: number;
  truncated: boolean;
}) {
  return (
    <Pagination
      form="steps"
      label="Search results pages"
      page={page}
      pageCount={truncated ? 0 : pageCount}
      hasNext={page < pageCount}
      hrefFor={(n) => searchHref(params, { page: n })}
      renderLink={({ href, ...rest }) => <Link to={href} {...rest} />}
    />
  );
}

export default function SearchPage({ loaderData }: Route.ComponentProps) {
  const { params, result, suggestions, askAvailable } = loaderData;
  const { facets } = result;
  const pageCount = pageCountOf(result.total, result.pageSize);
  /* A truncated match set makes every count a floor, so it says so rather than reading as exact. */
  const floor = result.truncated ? "+" : "";
  // `isEmpty` means no matchable text, not no request: a bare year or tag is answered by the browse path.
  const hasQuery = !result.parsed.isEmpty || hasFilters(result.parsed);

  return (
    <>
      <SiteHeader />
      <main className="cap-page search-page" id="main" tabIndex={-1}>
        <h1 className="page-title cap-layout-grid">Search</h1>

        <SearchForm defaultValue={params.q}>
          {params.type ? <input type="hidden" name="type" value={params.type} /> : null}
          {params.base ? <input type="hidden" name="base" value={params.base} /> : null}
          {params.tag ? <input type="hidden" name="tag" value={params.tag} /> : null}
          {params.year ? <input type="hidden" name="year" value={params.year} /> : null}
          {params.sort === "date" ? <input type="hidden" name="sort" value="date" /> : null}
          <p className="search-hint">
            Operators: <code>tag:</code>, <code>type:</code>, <code>base:</code> (
            {SEARCH_BASES.map((b) => b.id).join(", ")}), a bare year, and &quot;quoted
            phrases&quot;.
          </p>
        </SearchForm>

        {params.type || params.base || params.tag || params.year ? (
          <nav className="cap-chips search-active-filters" aria-label="Active filters">
            {params.type ? (
              <ActiveFilterChip params={params} facet="type" label={`type: ${params.type}`} />
            ) : null}
            {params.base ? (
              <ActiveFilterChip
                params={params}
                facet="base"
                label={`in: ${baseLabel(params.base.toLowerCase())}`}
              />
            ) : null}
            {params.tag ? (
              <ActiveFilterChip params={params} facet="tag" label={`tag: ${params.tag}`} />
            ) : null}
            {params.year ? (
              <ActiveFilterChip params={params} facet="year" label={params.year} />
            ) : null}
          </nav>
        ) : null}

        <template data-island="search" />

        {askAvailable && (params.q ?? "").trim().length > 0 ? (
          <AskMount question={params.q ?? ""} />
        ) : null}

        {/* The count is rendered even empty (a live region must exist before its text changes, or the live search's
            count is never announced), and the list is always there as a place for the live search to write to. */}
        <SearchResults
          count={
            hasQuery
              ? `${resultsText(result.total, { more: result.truncated })}${
                  result.parsed.year !== null ? ` from ${result.parsed.year}` : ""
                }`
              : ""
          }
          /* Only on the text path: the browse path is date-ordered in SQL, because a filter carries no relevance signal. */
          sort={
            hasQuery && result.total > 1 && !result.parsed.isEmpty ? (
              <nav className="cap-chips" aria-label="Sort results">
                <Link
                  to={searchHref(params, { sort: "relevance" })}
                  className="cap-chip"
                  aria-current={params.sort === "relevance" ? "true" : undefined}
                >
                  Relevance
                </Link>
                <Link
                  to={searchHref(params, { sort: "date" })}
                  className="cap-chip"
                  aria-current={params.sort === "date" ? "true" : undefined}
                >
                  Newest
                </Link>
              </nav>
            ) : null
          }
          facets={
            hasQuery && result.total > 0 ? (
              <>
                {facets.types.length > 1 ? (
                  <FacetSection
                    params={params}
                    facet="type"
                    heading="Type"
                    values={facets.types}
                    floor={floor}
                  />
                ) : null}

                {/* One search across the knowledge bases (docs/KNOWLEDGE-BASE.md, A2); each library keeps its own facets. */}
                {facets.bases.length > 1 ? (
                  <FacetSection
                    params={params}
                    facet="base"
                    heading="Knowledge base"
                    values={facets.bases}
                    floor={floor}
                  />
                ) : null}

                {facets.tags.length > 0 ? (
                  <FacetSection
                    params={params}
                    facet="tag"
                    heading="Tag"
                    values={facets.tags}
                    floor={floor}
                  />
                ) : null}

                {facets.years.length > 0 ? (
                  <FacetSection
                    params={params}
                    facet="year"
                    heading="Year"
                    values={facets.years}
                    floor={floor}
                  />
                ) : null}
              </>
            ) : undefined
          }
          empty={
            hasQuery && result.total === 0 && suggestions ? (
              <ZeroState raw={result.parsed.raw} suggestions={suggestions} />
            ) : undefined
          }
          pager={
            <ResultsPagination
              params={params}
              page={result.page}
              pageCount={pageCount}
              truncated={result.truncated}
            />
          }
        >
          {hasQuery && result.total > 0
            ? result.hits.map((hit) => <Result key={hit.uid} hit={hit} />)
            : null}
        </SearchResults>
      </main>
      <ShellFooter />
    </>
  );
}
