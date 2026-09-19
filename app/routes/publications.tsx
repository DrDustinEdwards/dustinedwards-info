import { Form, Link } from "react-router";

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
import { doiSlug, paperPath } from "~/lib/publications/paths.mjs";
import { italicizeOrganisms } from "~/lib/scientific-names";
import {
  isSiteOwner,
  pageMeta,
  publicationsJsonLd,
  publicHtmlHeaders,
  PUBLICATIONS_DESCRIPTION,
  PUBLICATIONS_URL,
  SITE,
} from "~/lib/seo";
import type { Route } from "./+types/publications";

import "~/styles/publications.css";

const SORTS = [
  { value: "year-desc", label: "Newest first" },
  { value: "year-asc", label: "Oldest first" },
  { value: "title", label: "Title A to Z" },
] as const;

type SortKey = (typeof SORTS)[number]["value"];

const TOPIC_IDS = new Set<string>(TOPICS.map((t) => t.id));

/**
 * The data file is also the source for the CV, which does list conference
 * abstracts, so those records stay in the file and are excluded here rather than
 * deleted. An abstract is the meeting version of a paper already listed.
 */
const SHOWCASE_TYPES = new Set<PublicationType>([
  "article",
  "review",
  "chapter",
  "teaching-resource",
]);

const SHOWCASE = PUBLICATIONS.filter((p) => SHOWCASE_TYPES.has(p.type));

/**
 * Descriptions are written, not templated. A generated line like "Publications in
 * {topic}" is the same thin metadata with a variable in it, so each sentence
 * describes the actual work and the four pages differ in content rather than in a
 * number.
 */
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

/**
 * Applied to both sides of every comparison. Nobody types an em dash into a
 * search box but Crossref titles carry them. The stored strings are never
 * rewritten; this is comparison-time only.
 */
function fold(value: string) {
  return value
    .toLowerCase()
    // U+2010 to U+2015 hyphen and dash family, U+2212 minus, plain hyphen.
    // Written as escapes so the literal characters never appear in source.
    .replace(/[\u2010-\u2015\u2212-]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * DECODED FIRST, so the haystack is the text on the page rather than the text in
 * the file: the one place a reader would copy a journal name from is the page,
 * where it renders with the ampersand. Abstract is deliberately not included.
 */
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

/**
 * `noindex` means an EMPTY RESULT SET. A query matching nothing is a real URL
 * with no content on it, and that is worth keeping out of an index.
 *
 * `pageMeta` RATHER THAN A HAND-BUILT ARRAY: it is the one place the card, the
 * canonical and the twitter tags are decided together, and a second list here would
 * be another copy of a set that has already drifted once.
 */
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

/**
 * A public HTML route that returns no headers is stamped `private, no-store` by
 * the gateway under hard rule 8, so omitting this would quietly make the most
 * static page on the site the only uncacheable one.
 */
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
  // Accepts "1" or "true", any casing. Any other value is absent rather than
  // truthy, so a stray `?selected=banana` shows the full list instead of an empty
  // page.
  const selectedParam = (params.get("selected") ?? "").toLowerCase();
  const selectedOnly = selectedParam === "1" || selectedParam === "true";

  // Everything except the topic filter. Chip counts run against this, so a
  // count only ever promises results that a click would actually return.
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

  // Hrefs are built here rather than in the component so the chips are plain
  // server-rendered links and the whole filter works with scripting off.
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

  // Exactly the four bare single-topic URLs self-canonical. Everything else
  // canonicals to the bare page: those views are re-orderings or subsets of the
  // index, not distinct content, and the URL space is unbounded because q is free
  // text.
  const KNOWN_PARAMS = new Set(["topic", "q", "sort", "selected"]);
  const hasUnknownParam = [...params.keys()].some((k) => !KNOWN_PARAMS.has(k));
  const soleTopic: TopicId | null =
    topics.length === 1 &&
    // An unrecognised topic value alongside a good one must not self-canonical.
    params.getAll("topic").length === 1 &&
    !params.has("q") &&
    !params.has("sort") &&
    !params.has("selected") &&
    !hasUnknownParam
      ? // `?? null` rather than a non-null assertion. The guard above proves
        // length is 1, but `noUncheckedIndexedAccess` arrived after this code
        // did and an assertion would be the one spelling that cannot be wrong
        // at compile time and can be wrong at runtime.
        (topics[0] ?? null)
      : null;

  /*
   * A PATH rather than an absolute URL, because `pageMeta` builds the absolute
   * form from `SITE_ORIGIN`. Deriving it from `url.origin` is how a page ends up
   * declaring a preview host canonical, which is the one thing a canonical must never
   * do.
   */
  const canonicalPath = soleTopic
    ? `${PUBLICATIONS_URL}?topic=${soleTopic}`
    : PUBLICATIONS_URL;
  const pageTitle = soleTopic
    ? `${TOPIC_META[soleTopic].title}, ${SITE.name}`
    : `Publications, ${SITE.name}`;
  const pageDescription = soleTopic
    ? TOPIC_META[soleTopic].description
    : PUBLICATIONS_DESCRIPTION;
  // An empty page is worse than no page. Covers ?selected=1 while nothing is
  // marked selected, and any query that matches nothing.
  const noindex = items.length === 0;

  // KV read only. A cold or stale entry refreshes after the response, so the
  // page never waits on OpenAlex.
  const citations = await getCitationCounts(context, items.map((p) => p.doi));

  return {
    origin: url.origin,
    citations,
    items,
    chips,
    topics,
    q,
    sort,
    selectedOnly,
    // Hidden entirely at zero rather than offering a chip that filters to nothing.
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

/**
 * Author order varies across the corpus, so a plain "first three" collapse would
 * hide his name on most of the page: when he falls outside the first three the
 * summary shows the first two, an ellipsis, then his entry. `details`, not a
 * button, so it expands without scripting.
 */
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
  /*
   * The pulled name is READ ONCE, and `pulled` is derived from whether that read
   * produced anything: deriving the flag from the value collapses two statements of
   * one condition, so there is one read and no assertion.
   */
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
  return (
    <article className="pub-entry">
      {/* Display only. The stored title stays plain for search and JSON-LD. */}
      {/* THE TITLE IS THE LINK TO THE PAPER'S OWN PAGE, so every row leads somewhere. */}
      <h3 className="pub-title">
        <Link to={paperPath(doiSlug(p.doi))}>
          {italicizeOrganisms(decodeEntities(p.title))}
        </Link>
      </h3>
      <AuthorList authors={p.authors} />
      <p className="pub-meta">
        {citation(p)}
        {p.type !== "article" ? <span className="pub-type">{p.type}</span> : null}
        {p.isOpenAccess ? <span className="pub-badge">Open access</span> : null}
      </p>
      <p className="pub-links">
        {p.access === "self-hosted" && p.pdfPath ? (
          <a href={p.pdfPath}>PDF</a>
        ) : null}
        <a href={`https://doi.org/${p.doi}`}>DOI</a>
        {p.pmcUrl ? <a href={p.pmcUrl}>PMC</a> : null}
        {p.externalUrl && (p.type === "teaching-resource" || p.type === "abstract") ? (
          <a href={p.externalUrl}>Resource</a>
        ) : null}
        {p.preprintDoi ? (
          <a href={`https://doi.org/${p.preprintDoi}`}>Preprint</a>
        ) : null}
        {/*
         * Only at 1 or more, so a zero is never rendered as though it were a real count.
         * A link rather than plain text because the work page carries the provenance a
         * title attribute cannot show on a touch device. The URL comes from the response,
         * never constructed.
         */}
        {cited && cited.count >= 1 && cited.url ? (
          <a
            className="pub-cited"
            href={cited.url}
            title={`OpenAlex, retrieved ${cited.fetchedAt}`}
          >
            Cited by {cited.count}
          </a>
        ) : null}
      </p>
      {/*
       * COinS, INDEX ONLY: Highwire `citation_*` tags describe the document they sit
       * in, and a page is one document, so 33 records cannot each have a
       * `citation_title`. This is what fills that gap. The per-paper pages carry the
       * citation tags instead, so it is deliberately not repeated there. Ruling 63.
       */}
      <span className="Z3988" title={coinsTitle(p)} />
      {p.abstract ? (
        <details className="pub-abstract">
          <summary>Abstract</summary>
          <p>{italicizeOrganisms(decodeEntities(p.abstract))}</p>
        </details>
      ) : null}
    </article>
  );
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
      {/*
       * `id="main"` is root's unconditional skip-link target. Without it the skip link
       * moves focus nowhere.
       */}
      <main id="main" className="page" tabIndex={-1}>
        <div className="page-inner">
          <h1 className="page-title">Publications</h1>
          <p className="page-intro">
            Peer-reviewed work on retroviruses, bacteriophage genomics, and how
            undergraduate research is taught. Full text is hosted here where I
            have the publisher version, with links out to the record of version
            otherwise.
          </p>

          <div className="pub-controls">
            <nav className="pub-chips" aria-label="Filter by topic">
              {chips.map((chip) => (
                <Link
                  key={chip.id}
                  to={chip.href}
                  className={`pub-chip${chip.active ? " pub-chip-active" : ""}`}
                  aria-pressed={chip.active}
                  title={chip.description}
                >
                  {chip.label} <span className="pub-chip-count">{chip.count}</span>
                </Link>
              ))}
              {selectedCount > 0 ? (
                <Link
                  to={selectedHref}
                  className={`pub-chip${selectedOnly ? " pub-chip-active" : ""}`}
                  aria-pressed={selectedOnly}
                >
                  Selected <span className="pub-chip-count">{selectedCount}</span>
                </Link>
              ) : null}
            </nav>

            {/* GET form, so search and sort both survive scripting being off. */}
            <Form method="get" className="pub-form" role="search">
              {topics.map((t) => (
                <input key={t} type="hidden" name="topic" value={t} />
              ))}
              {selectedOnly ? <input type="hidden" name="selected" value="1" /> : null}
              <label className="pub-field">
                <span className="pub-field-label">Search</span>
                <input
                  type="search"
                  name="q"
                  defaultValue={q}
                  placeholder="Title, author, or journal"
                />
              </label>
              <label className="pub-field">
                <span className="pub-field-label">Sort</span>
                <select name="sort" defaultValue={sort}>
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn-ghost pub-apply">
                Apply
              </button>
            </Form>
          </div>

          <p className="pub-count muted">
            {filtered ? `${items.length} of ${total} publications` : `${total} publications`}
            {filtered ? (
              <>
                {" "}
                <Link to="/publications" className="pub-clear">
                  Clear
                </Link>
              </>
            ) : null}
          </p>

          {/*
           * Always the FULL list regardless of the current filter: a citation file that
           * silently carried only what a chip happened to be showing would be a subset nobody
           * asked for.
           */}
          <p className="pub-exports muted">
            Export all: <a href="/publications.bib">BibTeX</a>{" "}
            <a href="/publications.ris">RIS</a>{" "}
            <a href="/publications.json">CSL JSON</a>
          </p>

          {items.length === 0 ? (
            <p className="muted">No publications match this filter.</p>
          ) : (
            groups.map((group) => (
              <section
                key={group.year ?? "all"}
                {...(group.year !== null
                  ? { "aria-labelledby": `pub-year-${group.year}` }
                  : { "aria-label": "Publications" })}
              >
                {group.year !== null ? (
                  <h2 id={`pub-year-${group.year}`} className="pub-year-heading">
                    {group.year}
                  </h2>
                ) : null}
                {group.items.map((p) => (
                  <Entry key={p.id} p={p} cited={citations[p.doi]} />
                ))}
              </section>
            ))
          )}
        </div>
        {/*
         * `jsonLd`, NOT a bare `JSON.stringify`: a `<script>` element's contents are
         * raw text and the only thing that ends one is the literal `</script`. This route
         * is the highest-risk emitter on the site, because it is the only one whose strings
         * come from THIRD PARTY registries. `check:policy` refuses the bypass.
         */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(publicationsJsonLd(origin, items)) }}
        />
      </main>
      <ShellFooter />
    </>
  );
}
