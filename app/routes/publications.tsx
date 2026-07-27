import { Form, Link } from "react-router";

import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import {
  PUBLICATIONS,
  TOPICS,
  type Publication,
  type TopicId,
} from "~/data/publications";
import { publicationsJsonLd, PUBLICATIONS_DESCRIPTION, SITE } from "~/lib/seo";
import type { Route } from "./+types/publications";

const SORTS = [
  { value: "year-desc", label: "Newest first" },
  { value: "year-asc", label: "Oldest first" },
  { value: "title", label: "Title A to Z" },
] as const;

type SortKey = (typeof SORTS)[number]["value"];

const TOPIC_IDS = new Set<string>(TOPICS.map((t) => t.id));

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

/** Fields the text query runs against. Abstract is deliberately not included. */
function haystack(p: Publication) {
  return fold([p.title, p.journal ?? "", ...p.authors].join(" "));
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
  return [
    { title: `Publications, ${SITE.name}` },
    {
      name: "description",
      content: loaderData?.description ?? PUBLICATIONS_DESCRIPTION,
    },
  ];
}

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const params = url.searchParams;

  const topics = params.getAll("topic").filter((t): t is TopicId => TOPIC_IDS.has(t));
  const q = (params.get("q") ?? "").trim();
  const sortParam = params.get("sort");
  const sort: SortKey =
    SORTS.some((s) => s.value === sortParam) ? (sortParam as SortKey) : "year-desc";
  const selectedOnly = params.get("selected") === "1";

  // Everything except the topic filter. Chip counts run against this, so a
  // count only ever promises results that a click would actually return.
  const needle = fold(q);
  const base = PUBLICATIONS.filter(
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

  const selectedCount = PUBLICATIONS.filter((p) => p.selected).length;
  const filtered = topics.length > 0 || q !== "" || selectedOnly;

  return {
    origin: url.origin,
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
    total: PUBLICATIONS.length,
    description: filtered
      ? `${items.length} of ${PUBLICATIONS.length} publications by ${SITE.name}.`
      : PUBLICATIONS_DESCRIPTION,
  };
}

/** Dustin is last author on some papers, so match on surname plus initial. */
function isSiteOwner(name: string) {
  const parts = name.trim().split(/\s+/);
  const surname = parts[parts.length - 1] ?? "";
  const given = parts[0] ?? "";
  return surname.toLowerCase() === "edwards" && given.toUpperCase().startsWith("D");
}

function AuthorName({ name }: { name: string }) {
  return isSiteOwner(name) ? <strong className="pub-author-me">{name}</strong> : <>{name}</>;
}

function AuthorList({ authors }: { authors: string[] }) {
  if (authors.length === 0) return null;
  if (authors.length <= 3) {
    return (
      <p className="pub-authors">
        {authors.map((name, i) => (
          <span key={name + i}>
            {i > 0 ? ", " : ""}
            <AuthorName name={name} />
          </span>
        ))}
      </p>
    );
  }
  // details, not a button, so the list expands without scripting.
  return (
    <details className="pub-authors pub-authors-more">
      <summary>
        {authors.slice(0, 3).map((name, i) => (
          <span key={name + i}>
            {i > 0 ? ", " : ""}
            <AuthorName name={name} />
          </span>
        ))}
        <span className="muted"> and {authors.length - 3} more</span>
      </summary>
      <p className="pub-authors-full">
        {authors.map((name, i) => (
          <span key={name + i}>
            {i > 0 ? ", " : ""}
            <AuthorName name={name} />
          </span>
        ))}
      </p>
    </details>
  );
}

function citation(p: Publication) {
  return [p.journal, String(p.year), p.volume, p.pages].filter(Boolean).join(", ");
}

function Entry({ p }: { p: Publication }) {
  return (
    <article className="pub-entry">
      <h3 className="pub-title">{p.title}</h3>
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
      </p>
      {p.abstract ? (
        <details className="pub-abstract">
          <summary>Abstract</summary>
          <p>{p.abstract}</p>
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
      <main className="page">
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
                  <Entry key={p.id} p={p} />
                ))}
              </section>
            ))
          )}
        </div>
        <script
          type="application/ld+json"
          // schema.org data for search and language models
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(publicationsJsonLd(origin, items)),
          }}
        />
      </main>
      <SiteFooter />
    </>
  );
}
