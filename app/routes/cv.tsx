import { Fragment, type ReactNode } from "react";

import { Enhance } from "~/components/enhance";
import { PageShell } from "~/components/page-shell";
import { contentPageMarkdownPath } from "~/lib/content-pages.mjs";
import { CV, CV_PAGE, CV_PDF_PATH, cvFacts, formatDollars, type CvEntry } from "~/lib/cv/entries.mjs";
import { renderCvCharts } from "~/lib/cv/render-charts";
import {
  AREAS,
  ROLES,
  SORTS,
  TYPES,
  areaLabel,
  facetCounts,
  groupEntries,
  headline,
  activeCount,
  isFiltered,
  matches,
  parseState,
  roleLabel,
  summaryText,
  yearOptions,
} from "~/lib/cv/view.mjs";
import { jsonLd as serializeJsonLd } from "~/lib/json-ld.mjs";
import { italicizeOrganisms } from "~/lib/scientific-names";
import {
  SITE_ORIGIN,
  breadcrumbJsonLd,
  isSiteOwner,
  pageMeta,
  personId,
  publicHtmlHeaders,
  publicationsJsonLd,
} from "~/lib/seo";

import type { Route } from "./+types/cv";

import "~/styles/enarratio.css";
import "~/styles/cv.css";

/*
 * THE CV (app/data/cv.ts, resolved by app/lib/cv/entries.mjs). The whole CV is in the HTML: the query
 * string only decides which entries carry `hidden`, how they are grouped and what the counts and charts
 * say, so a shared filter URL renders the same page with script off, and the form is a plain GET.
 * app/enhance/cv.ts runs the same functions (app/lib/cv/view.mjs) on every input.
 */

const ENTRIES = CV.entries;
const FACTS = cvFacts(ENTRIES);
const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));
const YEARS = yearOptions(FACTS);
const PATH = CV_PAGE.path;

// headers() is written out here because check:headers reads each public route's own source.
export function headers() {
  return new Headers(publicHtmlHeaders());
}

export function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const state = parseState(url.searchParams);
  const shown = FACTS.filter((f) => matches(f, state));
  return {
    state,
    shownIds: shown.map((f) => f.id),
    groups: groupEntries(FACTS, state.sort),
    counts: headline(shown),
    facets: facetCounts(FACTS, state),
    charts: renderCvCharts(FACTS, state),
  };
}

export function meta() {
  return [
    ...pageMeta({ title: CV_PAGE.seoTitle, description: CV_PAGE.description, path: PATH }),
    {
      tagName: "link",
      rel: "alternate",
      type: "text/markdown",
      href: `${SITE_ORIGIN}${contentPageMarkdownPath(PATH)}`,
    },
    { tagName: "link", rel: "alternate", type: "application/pdf", href: `${SITE_ORIGIN}${CV_PDF_PATH}` },
  ];
}

/** The page about the Person, and a ScholarlyArticle per paper the site holds, joined by the Person's @id. */
function cvJsonLd() {
  const records = ENTRIES.flatMap((e) => (e.paper?.record ? [e.paper.record] : []));
  return [
    breadcrumbJsonLd(SITE_ORIGIN, [[CV_PAGE.title, PATH]]),
    {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "@id": `${SITE_ORIGIN}${PATH}`,
      url: `${SITE_ORIGIN}${PATH}`,
      name: `${CV_PAGE.title}, ${CV.person.name}`,
      description: CV_PAGE.description,
      about: { "@id": personId(SITE_ORIGIN) },
    },
    ...publicationsJsonLd(SITE_ORIGIN, records),
  ];
}

const JSON_LD = serializeJsonLd(cvJsonLd());

const isOwner = (name: string) => isSiteOwner(name) || name === "D. Edwards";

function Names({ names }: { names: string[] }) {
  return (
    <>
      {names.map((name, i) => (
        <Fragment key={`${name}-${i}`}>
          {i > 0 ? ", " : ""}
          {isOwner(name) ? <strong className="cv-me">{name}</strong> : name}
        </Fragment>
      ))}
    </>
  );
}

/** The first three authors, and Dustin where he falls later; the full list is in the details below. */
function ShortAuthors({ authors }: { authors: string[] }) {
  if (authors.length <= 4) return <Names names={authors} />;
  const at = authors.findIndex(isOwner);
  const lead = authors.slice(0, 3);
  const owner = at >= 3 ? authors[at] : undefined;
  const rest = authors.length - lead.length - (owner ? 1 : 0);
  return (
    <>
      <Names names={lead} />
      {owner ? (
        <>
          , ... <strong className="cv-me">{owner}</strong>
        </>
      ) : null}{" "}
      and {rest} more
    </>
  );
}

function Tags({ entry }: { entry: CvEntry }) {
  const parts: string[] = [];
  if (entry.role) parts.push(roleLabel(entry.role));
  for (const area of entry.areas) parts.push(areaLabel(area));
  if (parts.length === 0) return null;
  return <p className="cv-tags">{parts.join(" · ")}</p>;
}

function CopyButton({ kind, label, entry }: { kind: "plain" | "bibtex" | "ris"; label: string; entry: CvEntry }) {
  const paper = entry.paper;
  if (!paper) return null;
  const src = kind === "bibtex" ? paper.bibtexPath : kind === "ris" ? paper.risPath : null;
  return (
    <button
      type="button"
      className="cv-copy"
      data-cv-copy={kind}
      data-cv-src={src ?? undefined}
      data-cv-for={entry.id}
      hidden
    >
      {label}
    </button>
  );
}

function PaperDetails({ entry }: { entry: CvEntry }) {
  const paper = entry.paper;
  if (!paper) return null;
  const n = paper.authors.length;
  return (
    <details className="cv-paper-more">
      <summary>
        {paper.hasAbstract ? "Abstract, citation" : "Citation"} and {n === 1 ? "author" : `all ${n} authors`}
      </summary>
      <div className="cv-paper-panel">
        <ul className="cv-links">
          {paper.pagePath ? (
            <li>
              <a href={paper.pagePath}>{paper.hasAbstract ? "Abstract" : "Paper page"}</a>
            </li>
          ) : null}
          {entry.links.map((link) => (
            <li key={link.href}>
              <a href={link.href}>{link.label}</a>
            </li>
          ))}
          {paper.pdfPath ? (
            <li>
              <a href={paper.pdfPath}>PDF</a>
            </li>
          ) : null}
        </ul>
        <p className="cv-panel-label">Citation</p>
        <p className="cv-cite" id={`${entry.id}-cite`}>
          {paper.citation}
        </p>
        {paper.bibtex ? (
          <template id={`${entry.id}-bibtex`}>{paper.bibtex}</template>
        ) : null}
        {paper.ris ? <template id={`${entry.id}-ris`}>{paper.ris}</template> : null}
        <p className="cv-cite-actions">
          <CopyButton kind="plain" label="Copy citation" entry={entry} />
          <CopyButton kind="bibtex" label="Copy BibTeX" entry={entry} />
          <CopyButton kind="ris" label="Copy RIS" entry={entry} />
          {paper.bibtexPath ? <a href={paper.bibtexPath}>BibTeX file</a> : null}
          {paper.risPath ? <a href={paper.risPath}>RIS file</a> : null}
        </p>
        <p className="cv-panel-label">Authors</p>
        <p className="cv-authors-full">
          <Names names={paper.authors} />
        </p>
      </div>
    </details>
  );
}

function EntryBody({ entry }: { entry: CvEntry }) {
  if (entry.type === "publication" && entry.paper) {
    const paper = entry.paper;
    return (
      <>
        <p className="cv-title">
          {paper.pagePath ? (
            <a href={paper.pagePath}>{italicizeOrganisms(entry.title)}</a>
          ) : (
            italicizeOrganisms(entry.title)
          )}
        </p>
        <p className="cv-authors">
          <ShortAuthors authors={paper.authors} />
        </p>
        <p className="cv-meta cv-venue">{paper.venue}</p>
        <Tags entry={entry} />
        <PaperDetails entry={entry} />
      </>
    );
  }
  return (
    <>
      <p className="cv-title">
        {entry.type === "grant" && entry.amount !== null ? (
          <span className="cv-amount">{formatDollars(entry.amount)}</span>
        ) : null}
        {entry.title}
      </p>
      {entry.meta.map((line, i) => (
        <p className="cv-meta" key={i}>
          {line}
        </p>
      ))}
      {entry.note ? <p className="cv-meta cv-note">{entry.note}</p> : null}
      {entry.duties.length > 0 ? (
        <details className="cv-duties">
          <summary>Responsibilities</summary>
          {entry.duties.map((duty) => (
            <div key={duty.heading} className="cv-duty">
              <p className="cv-panel-label">{duty.heading}</p>
              <ul>
                {duty.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ))}
        </details>
      ) : null}
      <Tags entry={entry} />
    </>
  );
}

const ORDER = new Map(ENTRIES.map((e, i) => [e.id, i]));

/** One or two lines each: the long lists read as a list, and the papers keep the room. */
const COMPACT = new Set(["grant", "award", "course", "service", "development"]);

function Entry({ entry, hidden }: { entry: CvEntry; hidden: boolean }) {
  return (
    <li
      className={`cv-entry cv-entry-${entry.type}${COMPACT.has(entry.type) ? " cv-compact" : ""}`}
      id={entry.id}
      data-cv-entry=""
      data-order={ORDER.get(entry.id)}
      data-type={entry.type}
      data-section={entry.section ?? undefined}
      data-areas={entry.areas.join(" ")}
      data-role={entry.role ?? undefined}
      data-year={entry.year ?? undefined}
      data-end={entry.endYear ?? undefined}
      data-students={entry.students ?? undefined}
      data-cohort={entry.cohort ? "" : undefined}
      data-amount={entry.amount ?? undefined}
      hidden={hidden}
    >
      <span className="cv-when">{entry.when}</span>
      <div className="cv-body">
        <EntryBody entry={entry} />
      </div>
    </li>
  );
}

function Stat({
  label,
  value,
  sub,
  spark,
  name,
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  spark: string;
  name: string;
}) {
  return (
    <div className="cv-stat">
      <dt>{label}</dt>
      <dd>
        <span className="cv-stat-value" data-cv-count={name}>
          {value}
        </span>
        <span className="cv-spark" data-cv-spark={name} dangerouslySetInnerHTML={{ __html: spark }} />
        {sub ? <span className="cv-stat-sub">{sub}</span> : null}
      </dd>
    </div>
  );
}

export default function CvRoute({ loaderData }: Route.ComponentProps) {
  const { state, shownIds, groups, counts, facets, charts } = loaderData;
  const shown = new Set(shownIds);
  return (
    <PageShell trail={<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD }} />}>
      <div className="cv" data-cv="">
        <header className="cv-head">
          <p className="cv-eyebrow">
            {CV_PAGE.title} · {CV.edition}
          </p>
          <h1 className="cv-name">
            {CV.person.name}, {CV.person.degree}
          </h1>
          <p className="cv-lede">
            {CV.person.title}, {CV.person.department}, {CV.person.org}.
          </p>
          <p className="cv-actions">
            <a href={CV_PDF_PATH} className="cv-action">
              Download PDF
            </a>
            <button type="button" className="cv-action" data-cv-print="" hidden>
              Print
            </button>
            <a href={contentPageMarkdownPath(PATH)} className="cv-action">
              Markdown
            </a>
            <a href="/research/publications" className="cv-action">
              All publications
            </a>
          </p>
        </header>

        <section className="cv-overview" aria-labelledby="cv-overview-title">
          <h2 id="cv-overview-title" className="sr-only">
            At a glance
          </h2>
          <dl className="cv-stats">
            <Stat label="Publications" value={String(counts.papers)} spark={charts.papers} name="papers" />
            <Stat
              label="Grants"
              value={String(counts.grants)}
              sub={<span data-cv-count="dollars">{formatDollars(counts.dollars)} awarded</span>}
              spark={charts.grants}
              name="grants"
            />
            <Stat
              label="Students mentored"
              value={String(counts.students)}
              sub="summed across listings"
              spark={charts.students}
              name="students"
            />
          </dl>
          <div className="cv-timeline">
            <p className="cv-timeline-title">Output by year</p>
            <div className="cv-timeline-plot" data-cv-timeline="" dangerouslySetInnerHTML={{ __html: charts.timeline }} />
            <p className="cv-timeline-hint" data-cv-hint="" hidden>
              Select a year&rsquo;s bar to show only that year, and select it again for every year. The key filters by type.
            </p>
          </div>
        </section>

        <form className="cv-filters" method="get" action={PATH} aria-label="Filter the CV" data-cv-form="">
          <div className="cv-filter-row cv-filter-top">
            <label className="cv-field cv-search">
              <span className="cv-label">Search</span>
              <input
                type="search"
                name="q"
                defaultValue={state.q}
                placeholder="Title, author, place, course"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
          </div>
          <details className="cv-more" open data-cv-more="">
            <summary className="cv-more-summary">
              Filters and sort <span data-cv-active="">{activeCount(state) > 0 ? `(${activeCount(state)} on)` : ""}</span>
            </summary>
          <div className="cv-more-body">
          <fieldset className="cv-facet">
            <legend className="cv-label">Type</legend>
            <div className="cv-chips">
              {TYPES.map(([id, , plural]) => (
                <label key={id} className="cv-chip">
                  <input type="checkbox" name="type" value={id} defaultChecked={state.types.includes(id)} />
                  <span className="cv-chip-text">
                    {plural}
                    <span className="cv-chip-count" data-cv-facet={`type:${id}`}>
                      {facets.types[id] ?? 0}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="cv-filter-row">
            <fieldset className="cv-facet">
              <legend className="cv-label">Research area</legend>
              <div className="cv-chips">
                {AREAS.filter(([id]) => FACTS.some((f) => f.areas.includes(id))).map(([id, label]) => (
                  <label key={id} className="cv-chip">
                    <input type="checkbox" name="area" value={id} defaultChecked={state.areas.includes(id)} />
                    <span className="cv-chip-text">
                      {label}
                      <span className="cv-chip-count" data-cv-facet={`area:${id}`}>
                        {facets.areas[id] ?? 0}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className="cv-facet cv-years">
              <legend className="cv-label">Years</legend>
              <div className="cv-years-row">
                <select name="from" defaultValue={state.from === null ? "" : String(state.from)} aria-label="From year">
                  <option value="">Earliest</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
                <span aria-hidden="true">to</span>
                <select name="to" defaultValue={state.to === null ? "" : String(state.to)} aria-label="To year">
                  <option value="">Latest</option>
                  {[...YEARS].reverse().map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>
            <label className="cv-field">
              <span className="cv-label">Role</span>
              <select name="role" defaultValue={state.role ?? ""}>
                <option value="">Any role</option>
                {ROLES.filter(([id]) => FACTS.some((f) => f.role === id)).map(([id, label]) => (
                  <option key={id} value={id} data-cv-facet={`role:${id}`} data-label={label}>
                    {label} ({facets.roles[id] ?? 0})
                  </option>
                ))}
              </select>
            </label>
            <label className="cv-field">
              <span className="cv-label">Sort</span>
              <select name="sort" defaultValue={state.sort}>
                {SORTS.map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          </div>
          </details>
          <div className="cv-filter-actions">
            <button type="submit" className="cv-apply" data-cv-apply="">
              Apply filters
            </button>
            <a href={PATH} className="cv-clear" data-cv-clear="" hidden={!isFiltered(state)}>
              Clear filters
            </a>
          </div>
        </form>

        <p className="cv-summary" role="status" data-cv-summary="">
          {summaryText(shownIds.length, FACTS.length)}
        </p>
        <p className="sr-only" role="status" data-cv-copied="" />

        <div className="cv-results" data-cv-results="">
          {groups.map((group) => {
            const visible = group.parts.reduce((n, part) => n + part.ids.filter((id) => shown.has(id)).length, 0);
            return (
              <section key={group.key} className="cv-group" data-cv-group={group.key} hidden={visible === 0}>
                <h2 className="cv-group-title">
                  {group.heading}{" "}
                  <span className="cv-group-count" data-cv-group-count="">
                    {visible}
                  </span>
                </h2>
                {group.key === "type-talk" ? (
                  <p className="cv-group-note">
                    The CV lists {CV.presentations.international} international and {CV.presentations.national} national
                    and regional presentations, {CV.presentations.from}-{CV.presentations.to}, most of them posters and
                    talks given by students with Dustin as senior author. Listed here: the invited talks, seminars and
                    roundtables he leads.
                  </p>
                ) : null}
                {group.key === "type-mentoring" ? (
                  <p className="cv-group-note">Counts only: the CV names each student, and this page never does.</p>
                ) : null}
                {group.parts.map((part) => (
                  <div
                    key={part.key}
                    className="cv-part"
                    data-cv-part={part.key}
                    hidden={!part.ids.some((id) => shown.has(id))}
                  >
                    {part.heading ? <h3 className="cv-part-title">{part.heading}</h3> : null}
                    <ol className="cv-list">
                      {part.ids.map((id) => {
                        const entry = BY_ID.get(id);
                        if (!entry) throw new Error(`cv: grouping named an unknown entry ${id}`);
                        return <Entry key={id} entry={entry} hidden={!shown.has(id)} />;
                      })}
                    </ol>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
        <p className="cv-foot">
          {FACTS.length} entries from the {CV.edition} CV. Each paper follows its journal record at Crossref and has its
          own page under <a href="/research/publications">Publications</a>.
        </p>
      </div>
      <Enhance module="cv" />
    </PageShell>
  );
}
