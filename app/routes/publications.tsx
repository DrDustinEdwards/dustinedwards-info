import { Form, Link } from "react-router";

import { EvidenceRow } from "~/components/evidence-row";
import { FilterLink } from "~/components/filter-link";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import {
  PUBLICATIONS,
  TOPICS,
  type Publication,
  type PublicationType,
  type TopicId,
} from "~/data/publications";
import { getCitationCounts, type CitationEntry } from "~/lib/citations.server";
import { jsonLd } from "~/lib/json-ld.mjs";
import { coinsTitle } from "~/lib/publications/coins.mjs";
import { decodeEntities } from "~/lib/publications/entities.mjs";
import { PUBLICATIONS_PATH, doiSlug, paperPath } from "~/lib/publications/paths.mjs";
import { italicizeOrganisms } from "~/lib/scientific-names";
import {
  isSiteOwner,
  pageMeta,
  publicationsJsonLd,
  publicHtmlHeaders,
  PUBLICATIONS_DESCRIPTION,
  PUBLICATIONS_URL,
  SITE,
  SITE_ORIGIN,
} from "~/lib/seo";
import type { Route } from "./+types/publications";

import "~/styles/evidence-row.css";
import "~/styles/listing.css";
import "~/styles/publications.css";

const SORTS = [
  { value: "year-desc", label: "Newest first" },
  { value: "year-asc", label: "Oldest first" },
  { value: "title", label: "Title A to Z" },
] as const;

type SortKey = (typeof SORTS)[number]["value"];

const TOPIC_IDS = new Set<string>(TOPICS.map((t) => t.id));

/** Conference abstracts stay in the data file, which the CV also reads, and are excluded here. */
const SHOWCASE_TYPES = new Set<PublicationType>([
  "article",
  "review",
  "chapter",
  "teaching-resource",
]);

const SHOWCASE = PUBLICATIONS.filter((p) => SHOWCASE_TYPES.has(p.type));

const TOPIC_META: Record<TopicId, { title: string; description: string }> = {
  "human-simian-retroviruses": {
    title: "Human and simian retroviruses",
    description:
      "How the HTLV-1 accessory proteins p12, p8 and p30 support infection and persistence, plus the auxiliary proteins of simian T-lymphotropic virus type 3.",
  },
  "avian-retroviruses": {
    title: "Avian retroviruses",
    description:
      "Molecular surveillance and genome sequencing of reticuloendotheliosis virus in wild turkeys, ducks, and an endangered Attwater's prairie chicken.",
  },
  bacteriophages: {
    title: "Bacteriophages",
    description:
      "Complete genomes of Microbacterium, Mycobacterium and Arthrobacter bacteriophages, plus a study of how healthcare providers view phage therapy.",
  },
  "science-education": {
    title: "Science education",
    description:
      "Course-based undergraduate research as a way to teach science: classroom assessment, faculty identity, the iREC model, and scientific writing rubrics.",
  },
};

/** Comparison-time only: Crossref titles carry em dashes nobody types into a search box. */
function fold(value: string) {
  return value
    .toLowerCase()
    // U+2010 to U+2015 hyphen and dash family, U+2212 minus, plain hyphen.
    // Written as escapes so the literal characters never appear in source.
    .replace(/[\u2010-\u2015\u2212-]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Decoded first, so the haystack is the text on the page, ampersands included. */
function haystack(p: Publication) {
  return fold(decodeEntities([p.title, p.journal ?? "", ...p.authors].join(" ")));
}

function sortItems(items: Publication[], sort: SortKey) {
  const byTitle = (a: Publication, b: Publication) =>
    a.title.localeCompare(b.title);
  return [...items].sort((a, b) => {
    if (sort === "title") return byTitle(a, b);
    if (sort === "year-asc") return a.year - b.year || byTitle(a, b);
    return b.year - a.year || byTitle(a, b);
  });
}

export function meta({ loaderData }: Route.MetaArgs) {
  const title = loaderData?.pageTitle ?? `Publications, ${SITE.name}`;
  const description = loaderData?.pageDescription ?? PUBLICATIONS_DESCRIPTION;

  return [
    ...pageMeta({
      title,
      description,
      path: loaderData?.canonicalPath ?? PUBLICATIONS_URL,
    }),
    ...(loaderData?.noindex ? [{ name: "robots", content: "noindex, follow" }] : []),
  ];
}

/** Without headers the gateway stamps `private, no-store`, making the most static page uncacheable. */
export function headers() {
  return publicHtmlHeaders();
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const topics = params.getAll("topic").filter((t): t is TopicId => TOPIC_IDS.has(t));
  const q = (params.get("q") ?? "").trim();
  const sortParam = params.get("sort");
  const sort: SortKey =
    SORTS.some((s) => s.value === sortParam) ? (sortParam as SortKey) : "year-desc";
  // Any other value is absent rather than truthy, so `?selected=banana` shows the full list.
  const selectedParam = (params.get("selected") ?? "").toLowerCase();
  const selectedOnly = selectedParam === "1" || selectedParam === "true";

  // Chip counts run against everything except the topic filter, so a count only promises what a click returns.
  const needle = fold(q);
  const base = SHOWCASE.filter(
    (p) =>
      (!selectedOnly || p.selected) && (!needle || haystack(p).includes(needle)),
  );

  const items = sortItems(
    topics.length
      ? base.filter((p) => p.topics.some((t) => topics.includes(t)))
      : base,
    sort,
  );

  const linkParams = () => {
    const next = new URLSearchParams();
    if (q) next.set("q", q);
    if (sort !== "year-desc") next.set("sort", sort);
    if (selectedOnly) next.set("selected", "1");
    return next;
  };
  const href = (list: TopicId[]) => {
    const next = linkParams();
    for (const t of list) next.append("topic", t);
    const s = next.toString();
    return s ? `/publications?${s}` : "/publications";
  };

  const chips = TOPICS.map((topic) => {
    const active = topics.includes(topic.id);
    return {
      id: topic.id,
      label: topic.label,
      description: topic.description,
      count: base.filter((p) => p.topics.includes(topic.id)).length,
      active,
      href: href(
        active ? topics.filter((t) => t !== topic.id) : [...topics, topic.id],
      ),
    };
  });

  const selectedCount = SHOWCASE.filter((p) => p.selected).length;
  const filtered = topics.length > 0 || q !== "" || selectedOnly;

  const span = {
    papers: items.length,
    firstYear: items.length > 0 ? Math.min(...items.map((p) => p.year)) : null,
    lastYear: items.length > 0 ? Math.max(...items.map((p) => p.year)) : null,
    venues: new Set(items.map((p) => p.journal).filter(Boolean)).size,
  };

  // Only the four bare single-topic URLs self-canonical: the rest are subsets or orderings, and q is unbounded.
  const KNOWN_PARAMS = new Set(["topic", "q", "sort", "selected"]);
  const hasUnknownParam = [...params.keys()].some((k) => !KNOWN_PARAMS.has(k));
  const soleTopic: TopicId | null =
    topics.length === 1 &&
    params.getAll("topic").length === 1 &&
    !params.has("q") &&
    !params.has("sort") &&
    !params.has("selected") &&
    !hasUnknownParam
      ?
        (topics[0] ?? null)
      : null;

  /* A path, not an absolute URL: deriving it from `url.origin` is how a preview host becomes canonical. */
  const canonicalPath = soleTopic
    ? `${PUBLICATIONS_URL}?topic=${soleTopic}`
    : PUBLICATIONS_URL;
  const pageTitle = soleTopic
    ? `${TOPIC_META[soleTopic].title}, ${SITE.name}`
    : `Publications, ${SITE.name}`;
  const pageDescription = soleTopic
    ? TOPIC_META[soleTopic].description
    : PUBLICATIONS_DESCRIPTION;
  const noindex = items.length === 0;

  // KV read only: a stale entry refreshes after the response, so the page never waits on OpenAlex.
  const citations = await getCitationCounts(context, items.map((p) => p.doi));

  return {
    /* The canonical origin, never the request's: this page is shared-cached, so a preview host's JSON-LD would be served to everyone. */
    origin: SITE_ORIGIN,
    citations,
    items,
    chips,
    topics,
    q,
    sort,
    selectedOnly,
    selectedCount,
    selectedHref: (() => {
      const next = linkParams();
      next.delete("selected");
      if (!selectedOnly) next.set("selected", "1");
      for (const t of topics) next.append("topic", t);
      const s = next.toString();
      return s ? `/publications?${s}` : "/publications";
    })(),
    filtered,
    span,
    total: SHOWCASE.length,
    canonicalPath,
    pageTitle,
    pageDescription,
    noindex,
  };
}

function AuthorName({ name }: { name: string }) {
  return isSiteOwner(name) ? <strong className="pub-author-me">{name}</strong> : <>{name}</>;
}

function Names({ names }: { names: string[] }) {
  return (
    <>
      {names.map((name, i) => (
        <span key={name + i}>
          {i > 0 ? ", " : ""}
          <AuthorName name={name} />
        </span>
      ))}
    </>
  );
}

/** Author order varies, so when he falls outside the first three the summary shows two, an ellipsis, then his entry. */
function AuthorList({ authors }: { authors: string[] }) {
  if (authors.length === 0) return null;
  if (authors.length <= 3) {
    return (
      <p className="pub-authors">
        <Names names={authors} />
      </p>
    );
  }

  const ownerIndex = authors.findIndex(isSiteOwner);
  const ownerName = ownerIndex >= 3 ? authors[ownerIndex] : undefined;
  const lead = authors.slice(0, ownerName ? 2 : 3);
  const shown = lead.length + (ownerName ? 1 : 0);

  return (
    <details className="pub-authors pub-authors-more">
      <summary>
        <Names names={lead} />
        {ownerName ? (
          <>
            <span className="muted">, ... </span>
            <AuthorName name={ownerName} />
          </>
        ) : null}
        <span className="muted"> and {authors.length - shown} more</span>
      </summary>
      <p className="pub-authors-full">
        <Names names={authors} />
      </p>
    </details>
  );
}

function citation(p: Publication) {
  return decodeEntities(
    [p.journal, String(p.year), p.volume, p.pages].filter(Boolean).join(", "),
  );
}

function Entry({ p, cited }: { p: Publication; cited?: CitationEntry }) {
  const slug = doiSlug(p.doi);
  return (
    <article className="paper-row">
      <p className="paper-marks">
        {p.type !== "article" ? <span className="paper-kind">{p.type}</span> : null}
        {p.isOpenAccess ? <span className="paper-open">open access</span> : null}
      </p>
      <div className="paper-body">
        {/* Display only. The stored title stays plain for search and JSON-LD. */}
        <h3 className="paper-row-title">
          <Link to={paperPath(slug)}>{italicizeOrganisms(decodeEntities(p.title))}</Link>
        </h3>
        <AuthorList authors={p.authors} />
        <p className="paper-venue">{citation(p)}</p>
        <p className="paper-row-links">
          {p.access === "self-hosted" && p.pdfPath ? <a href={p.pdfPath}>PDF</a> : null}
          <a href={`https://doi.org/${p.doi}`}>DOI</a>
          {p.pmcUrl ? <a href={p.pmcUrl}>PMC</a> : null}
          {p.externalUrl && (p.type === "teaching-resource" || p.type === "abstract") ? (
            <a href={p.externalUrl}>Resource</a>
          ) : null}
          {p.preprintDoi ? (
            <a href={`https://doi.org/${p.preprintDoi}`}>Preprint</a>
          ) : null}
          <a href={`${PUBLICATIONS_PATH}/${slug}.bib`}>BibTeX</a>
          <a href={`${PUBLICATIONS_PATH}/${slug}.ris`}>RIS</a>
          {cited && cited.count >= 1 && cited.url ? (
            <a
              className="paper-cited-link"
              href={cited.url}
              title={`OpenAlex, retrieved ${cited.fetchedAt}`}
            >
              Cited by {cited.count}
            </a>
          ) : null}
        </p>
        {/* COinS on the index only: Highwire `citation_*` tags describe the one document they sit in. */}
        <span className="Z3988" title={coinsTitle(p)} />
        {p.abstract ? (
          <details className="paper-abstract-peek">
            <summary>Abstract</summary>
            <p>{italicizeOrganisms(decodeEntities(p.abstract))}</p>
          </details>
        ) : null}
      </div>
    </article>
  );
}

function bibliographyFacts(span: {
  papers: number;
  firstYear: number | null;
  lastYear: number | null;
  venues: number;
}) {
  return [
    `${span.papers} paper${span.papers === 1 ? "" : "s"}`,
    span.firstYear && span.lastYear
      ? span.firstYear === span.lastYear
        ? String(span.firstYear)
        : `${span.firstYear} to ${span.lastYear}`
      : null,
    span.venues > 0 ? `${span.venues} venue${span.venues === 1 ? "" : "s"}` : null,
  ];
}

export default function Publications({ loaderData }: Route.ComponentProps) {
  const {
    origin,
    items,
    chips,
    topics,
    q,
    sort,
    selectedOnly,
    selectedCount,
    selectedHref,
    filtered,
    span,
    total,
    citations,
  } = loaderData;

  const groupByYear = sort !== "title";
  const groups: { year: number | null; items: typeof items }[] = groupByYear
    ? items.reduce<{ year: number | null; items: typeof items }[]>((acc, p) => {
        const last = acc[acc.length - 1];
        if (last && last.year === p.year) last.items.push(p);
        else acc.push({ year: p.year, items: [p] });
        return acc;
      }, [])
    : [{ year: null, items }];

  return (
    <>
      <SiteHeader />
      <main id="main" className="tracks list-tracks" tabIndex={-1}>
        <header className="list-head">
          <h1 className="list-label">Publications</h1>
          <p className="list-dek">
            Peer-reviewed work on retroviruses, bacteriophage genomics, and how
            undergraduate research is taught. Full text is hosted here where I have the
            publisher version, with links out to the record of version otherwise.
          </p>
          <EvidenceRow facts={bibliographyFacts(span)} />
        </header>

        <nav className="list-filter" aria-label="Filter by topic">
          <span className="list-filter-label">Topics</span>
          {chips.map((chip) => (
            <FilterLink
              key={chip.id}
              to={chip.href}
              label={chip.label}
              count={chip.count}
              active={chip.active}
              title={chip.description}
            />
          ))}
          {selectedCount > 0 ? (
            <FilterLink
              to={selectedHref}
              label="Selected"
              count={selectedCount}
              active={selectedOnly}
            />
          ) : null}
        </nav>

        <Form method="get" className="list-search paper-search" role="search">
          {topics.map((t) => (
            <input key={t} type="hidden" name="topic" value={t} />
          ))}
          {selectedOnly ? <input type="hidden" name="selected" value="1" /> : null}
          <label className="paper-field">
            <span className="paper-field-label">Search</span>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Title, author, or journal"
            />
          </label>
          <label className="paper-field">
            <span className="paper-field-label">Sort</span>
            <select name="sort" defaultValue={sort}>
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Apply</button>
        </Form>

        <p className="list-feeds paper-feeds">
          <span>
            {filtered ? `${items.length} of ${total} shown` : `${total} publications`}
            {filtered ? (
              <>
                {" "}
                <Link to="/publications">Clear</Link>
              </>
            ) : null}
          </span>
          {/* Always the full list: a citation file carrying only the filtered subset is one nobody asked for. */}
          <span>
            Export all <a href="/publications.bib">BibTeX</a>{" "}
            <a href="/publications.ris">RIS</a> <a href="/publications.json">CSL JSON</a>
          </span>
        </p>

        {items.length === 0 ? (
          <p className="list-empty">No publications match this filter.</p>
        ) : (
          <div className="paper-list">
            {groups.map((group) => (
              <section
                key={group.year ?? "all"}
                {...(group.year !== null
                  ? { "aria-labelledby": `pub-year-${group.year}` }
                  : { "aria-label": "Publications" })}
              >
                {group.year !== null ? (
                  <h2 id={`pub-year-${group.year}`} className="paper-year">
                    {group.year}
                  </h2>
                ) : null}
                {group.items.map((p) => (
                  <Entry key={p.id} p={p} cited={citations[p.doi]} />
                ))}
              </section>
            ))}
          </div>
        )}

        {/* `jsonLd`, not `JSON.stringify`: only `</script` ends a script element, and these strings come from third-party registries. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(publicationsJsonLd(origin, items)) }}
        />
      </main>
      <ShellFooter />
    </>
  );
}
