import { Form, Link } from "react-router";

import { EvidenceRow } from "~/components/evidence-row";
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

  /*
   * THE EVIDENCE ROW'S THREE FACTS, over the list this request renders rather than over the whole
   * corpus: a reader who has filtered to one topic is looking at that bibliography. Counted here,
   * never typed, and the venue count is DISTINCT journals, which is the one of the three that
   * says something a reader could not get by scrolling.
   */
  const span = {
    papers: items.length,
    firstYear: items.length > 0 ? Math.min(...items.map((p) => p.year)) : null,
    lastYear: items.length > 0 ? Math.max(...items.map((p) => p.year)) : null,
    venues: new Set(items.map((p) => p.journal).filter(Boolean)).size,
  };

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

/**
 * One paper as a RULED ROW in a bibliography, which is the register this page was always in and
 * never looked like. The machine column carries what a reader scans for and cannot read off the
 * title: the kind of thing it is, and whether they can get it. Open access as a mono word, not a
 * badge; a chapter as a mono word, not a box. Neither was a chip by ruling 118's conditions, but
 * both were little bordered rectangles doing what a word does.
 */
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
        {/* THE TITLE IS THE LINK TO THE PAPER'S OWN PAGE, so every row leads somewhere. */}
        <h3 className="paper-row-title">
          <Link to={paperPath(slug)}>{italicizeOrganisms(decodeEntities(p.title))}</Link>
        </h3>
        <AuthorList authors={p.authors} />
        {/* The journal in italic serif, which is what a bibliography does and what tells a
            reader at a glance that this line is a venue rather than a sentence. */}
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
          {/*
           * THE CITATION EXPORTS ON THE ROW. They existed per paper and were reachable only from
           * the paper's own page, so a reader assembling a reading list had to open every one.
           * Plain links, because they are URLs: a reference manager can be pointed at one.
           */}
          <a href={`${PUBLICATIONS_PATH}/${slug}.bib`}>BibTeX</a>
          <a href={`${PUBLICATIONS_PATH}/${slug}.ris`}>RIS</a>
          {/*
           * Only at 1 or more, so a zero is never rendered as though it were a real count.
           * A link rather than plain text because the work page carries the provenance a
           * title attribute cannot show on a touch device. The URL comes from the response,
           * never constructed.
           */}
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
        {/*
         * COinS, INDEX ONLY: Highwire `citation_*` tags describe the document they sit
         * in, and a page is one document, so 33 records cannot each have a
         * `citation_title`. This is what fills that gap. The per-paper pages carry the
         * citation tags instead, so it is deliberately not repeated there. Ruling 63.
         */}
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

/**
 * The three facts the evidence row states, formatted from the numbers the loader counted. A null
 * is not a zero: an empty filter has no span, and `EvidenceRow` omits itself below three facts
 * rather than printing a range nothing occupies.
 */
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
      {/*
       * `id="main"` is root's unconditional skip-link target. Without it the skip link
       * moves focus nowhere.
       */}
      <main id="main" className="tracks list-tracks" tabIndex={-1}>
        <header className="list-head">
          <h1 className="list-label">Publications</h1>
          <p className="list-dek">
            Peer-reviewed work on retroviruses, bacteriophage genomics, and how
            undergraduate research is taught. Full text is hosted here where I have the
            publisher version, with links out to the record of version otherwise.
          </p>
          {/* Three counted facts about THIS list, in the slot every page carries one. */}
          <EvidenceRow facts={bibliographyFacts(span)} />
        </header>

        {/*
         * THE TOPIC FILTERS ARE TEXT LINKS. They were bordered tokens with a current state, which
         * is the chip shape whatever the border is doing; the state is weight and ink now, and
         * `aria-current` carries it into the accessibility tree either way. Still links, so the
         * URL remains the state with script or without it.
         */}
        <nav className="list-filter" aria-label="Filter by topic">
          <span className="list-filter-label">Topics</span>
          {chips.map((chip) => (
            <Link
              key={chip.id}
              to={chip.href}
              aria-current={chip.active ? "true" : undefined}
              title={chip.description}
            >
              {chip.label} <span className="filter-count">{chip.count}</span>
            </Link>
          ))}
          {selectedCount > 0 ? (
            <Link to={selectedHref} aria-current={selectedOnly ? "true" : undefined}>
              Selected <span className="filter-count">{selectedCount}</span>
            </Link>
          ) : null}
        </nav>

        {/* GET form, so search and sort both survive scripting being off. */}
        <Form method="get" className="list-search paper-search" role="search">
          {topics.map((t) => (
            <input key={t} type="hidden" name="topic" value={t} />
          ))}
          {selectedOnly ? <input type="hidden" name="selected" value="1" /> : null}
          <label className="paper-field">
            {/* Sentence case. It was tracked caps, which ruling 118 item 7 names. */}
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

        {/*
         * THE COUNT AND THE EXPORTS ARE TWO FACTS, so they are two spans separated by the row's
         * column gap rather than by punctuation, which is how the evidence row does it: a wrapped
         * line then reads as a list and not as a broken sentence.
         */}
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
          {/*
           * Always the FULL list regardless of the current filter: a citation file that
           * silently carried only what a filter happened to be showing would be a subset nobody
           * asked for. Per-paper exports are on each row.
           */}
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
                {/*
                 * THE YEAR IS THE ROW'S LEADING COLUMN, at the same rail measure the post page
                 * and the blog rows use, rather than a heading across the page. A bibliography
                 * is read down its years.
                 */}
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
