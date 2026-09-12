import { Form, Link } from "react-router";

import { SiteFooter } from "~/components/site-footer";
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
 * Types this page shows. The data file is also the source for the CV, which
 * does list conference abstracts, so those records stay in the file and are
 * excluded here instead of being deleted. An abstract is the meeting version
 * of a paper already listed, so showing both would repeat the same work.
 */
const SHOWCASE_TYPES = new Set<PublicationType>([
  "article",
  "review",
  "chapter",
  "teaching-resource",
]);

const SHOWCASE = PUBLICATIONS.filter((p) => SHOWCASE_TYPES.has(p.type));

/**
 * Head metadata for the four single-topic views, which are the only filtered
 * URLs that self-canonical.
 *
 * Descriptions are written, not templated. A generated line like "Publications
 * in {topic}" or "N of 33 publications" is the same thin metadata with a
 * variable in it, which is what the audit found and what this replaces. Each
 * sentence describes the actual work, so the four pages differ in content and
 * not just in a number.
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
 * Fold the dash family to a plain hyphen and flatten case and runs of space.
 *
 * Applied to both sides of every comparison. Nobody types an em dash into a
 * search box, but Crossref titles carry them, so "US-A Cross-Sectional" has to
 * reach the stored "US-A Cross-Sectional" spelt with U+2014. The stored strings
 * are never rewritten; this is comparison-time only.
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
 * Fields the text query runs against. Abstract is deliberately not included.
 *
 * DECODED FIRST, so the haystack is the text on the page rather than the text
 * in the file. Without it a search for `Microbiology & Biology Education`
 * cannot reach a journal stored as `Microbiology &amp; Biology Education`, and
 * the one place a reader would copy that string from is the page, where it now
 * renders with the ampersand.
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
 * Head metadata.
 *
 * ## UN-ARCHIVED 2026-09-12, and this is the seam the old comment described
 *
 * From 2026-07-27 until PR #3 deleted it, this route served `noindex, follow`
 * on every variant and dropped `rel=canonical` entirely, because a canonical
 * and a noindex are contradictory signals and a crawler shown both will act on
 * one of them without telling you which. The old comment named the two edits
 * that would reverse it: put the canonical link back, and make the robots entry
 * conditional on the loader's `noindex` again. Both are done here, so the four
 * bare single-topic URLs self-canonical and the bare page indexes.
 *
 * `noindex` now means what it always computed and never got to say: an empty
 * result set. A query matching nothing is a real URL with no content on it, and
 * that is worth keeping out of an index whether or not the route is archived.
 *
 * ## `pageMeta` RATHER THAN A HAND-BUILT ARRAY
 *
 * The original wrote its own tag list and deliberately emitted no `og:image`,
 * on the grounds that the only images in the repo were phage cohort photos. The
 * site has had a default social card since `0517cb0`, and `pageMeta` is the one
 * place the card, the canonical and the twitter tags are decided together. A
 * second hand-built list here would be a fifth copy of a set that has already
 * drifted once, which is the defect `pageMeta` was extracted to end.
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
 * Shared-cache headers, which the July route did not have because the layer did
 * not exist yet. A public HTML route that returns none is stamped
 * `private, no-store` by the gateway under hard rule 8, so omitting this would
 * quietly make the most static page on the site the only uncacheable one.
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
  // truthy, so a stray ?selected=banana shows the full list instead of an
  // empty page. Generated links always emit the canonical "1".
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

  // Canonical policy. Exactly the four bare single-topic URLs self-canonical
  // and carry their own written title and description. Everything else
  // canonicals to the bare page: multi-topic combinations, any q, any sort
  // including the default, any selected, and any unrecognised param. Those
  // views are re-orderings or subsets of the index, not distinct content, and
  // the URL space is unbounded because q is free text.
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
   * form from `SITE_ORIGIN`. Those two disagree on every request that does not
   * arrive on the canonical host: a preview URL, a `workers.dev` request while
   * the apex is live, or a local run. Deriving the canonical from `url.origin`
   * is how a page ends up declaring a preview host canonical, which is the one
   * thing a canonical must never do.
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
 * Author list, collapsed to a summary that always includes the site owner.
 *
 * Author order varies across the corpus: he is first on some papers, last on
 * every phage announcement, and 14th of 108 on a community teaching resource.
 * A plain "first three" collapse would hide his name on most of the page, so
 * when he falls outside the first three the summary shows the first two, an
 * ellipsis, then his entry. details, not a button, so it expands without
 * scripting.
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
   * THE PULLED NAME IS READ ONCE, HERE, and `pulled` is derived from whether
   * that read produced anything.
   *
   * It used to be `ownerIndex >= 3`, with `authors[ownerIndex]` read separately
   * in the markup. Those are two statements of the same condition, and under
   * `noUncheckedIndexedAccess` the second one is what the compiler objects to:
   * an index that the first statement proved good. Deriving the flag from the
   * value collapses them, so there is one read and no assertion.
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
      {/*
        THE TITLE IS THE LINK TO THE PAPER'S OWN PAGE.
        Every row leads somewhere now. Before the per-paper pages existed this
        was plain text and the only outbound links were the DOI and the PDF, so
        the index was a leaf: a reader who wanted one paper had to leave the
        site to read anything more about it. It is also what makes the paper
        pages reachable by a crawler, which Scholar requires (every article URL
        "reachable from the homepage by following at most ten simple HTML
        links"); a sitemap entry alone is a weaker signal than a real link.
      */}
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
        {/* Last in the row. Only at 1 or more, so a zero is never rendered as
            though it were a real count. It is a link rather than plain text
            because it sits among the link pills, and the OpenAlex work page
            carries the provenance that the title attribute cannot show on a
            touch device. The URL comes from the response, never constructed. */}
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
      {/* `id="main"` is root's unconditional skip-link target. Without it the
          skip link moves focus nowhere, which is what `check:invariants`
          section 12 refuses. The July markup predates that gate. */}
      <main id="main" className="page">
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

          {/* The whole list, as files. Under the count rather than in the
              controls, because they describe what is listed rather than
              changing it. Always the FULL list regardless of the current
              filter: a citation file that silently carried only what a chip
              happened to be showing would be a subset nobody asked for. */}
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
          schema.org data for search and language models.

          `jsonLd`, NOT a bare `JSON.stringify`. The July version stringified
          straight into `dangerouslySetInnerHTML`, which was how every emitter on
          the site did it before `app/lib/json-ld.mjs` was written; a `<script>`
          element's contents are raw text and the only thing that ends one is the
          literal `</script`, so an abstract or a title carrying that sequence
          closes the element early. This route is the highest-risk emitter on the
          site for exactly that, because it is the only one whose strings come
          from THIRD PARTY registries rather than from the one admin's
          frontmatter. `check:policy` refuses the bypass.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(publicationsJsonLd(origin, items)) }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
