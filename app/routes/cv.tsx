import { CheckChips } from "capsomer/react/chips";
import { SearchField, SpanField } from "capsomer/react/field";
import { JsonLd } from "capsomer/react/json-ld";
import { ButtonLink } from "capsomer/react/link";
import { Fragment, useState, type ReactNode } from "react";

import { PageShell } from "~/components/page-shell";
import { readCv } from "~/db/cv";
import { contentPageCardPath, contentPageMarkdownPath } from "~/lib/content-pages.mjs";
import { getEnv } from "~/lib/context";
import {
  CV_PAGE,
  CV_PDF_PATH,
  cvFacts,
  formatDollars,
  type Cv,
  type CvEntry,
} from "~/lib/cv/entries.mjs";
import { CV_HTML_TAGS } from "~/lib/cv/route";
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
import { thing } from "@drdustinedwards/site-helpers/schema";
import { italicizeOrganisms } from "~/lib/scientific-names";
import {
  SITE_ORIGIN,
  isSiteOwner,
  pageMeta,
  personId,
  publicHtmlHeaders,
  publicationsJsonLd,
  shareCard,
} from "~/lib/seo";

import type { Route } from "./+types/cv";

import "capsomer/tokens.css";
import "capsomer/status.css";
import "capsomer/copy.css";
import "capsomer/button.css";
import "capsomer/chips.css";
import "capsomer/field.css";
import "capsomer/select.css";
import "capsomer/enarratio.css";
import "capsomer/chart-frame.css";
import "~/styles/cv.css";
import { markup } from "capsomer/behavior/trusted-html";

/*
 * THE CV (content/cv/, drawn from D1 at request time and resolved by app/lib/cv/entries.mjs, docs/CV.md). A CV
 * edit saved through Carrel is live on the next request, with no build or deploy. The whole CV is in the HTML: the query
 * string only decides which entries carry `hidden`, how they are grouped and what the counts and charts
 * say, so a shared filter URL renders the same page with script off, and the form is a plain GET.
 * app/enhance/cv.ts runs the same functions (app/lib/cv/view.mjs) on every input.
 */

const PATH = CV_PAGE.path;
/** The CV's own social card (CARDED_PAGE_ROOTS), which build:og draws from the same title and description. */
const CARD_PATH = contentPageCardPath(CV_PAGE);
const CARD = CARD_PATH ? shareCard(`${SITE_ORIGIN}${CARD_PATH}`, CV_PAGE.seoTitle) : undefined;

export function headers() {
  return new Headers(publicHtmlHeaders(CV_HTML_TAGS));
}

/*
 * The CV is drawn per request, and the page's script reads it back out of the DOM (data attributes on each
 * entry), so the server and the browser never hold two copies. The route does not hydrate, so none of this
 * reaches the browser as data: the loader hands the component the resolved CV to render and nothing more.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const cv = await readCv(getEnv(context));
  const facts = cvFacts(cv.entries);
  const url = new URL(request.url);
  const state = parseState(url.searchParams);
  const shown = facts.filter((f) => matches(f, state));
  return {
    cv,
    facts,
    jsonLd: cvJsonLd(cv),
    state,
    shownIds: shown.map((f) => f.id),
    groups: groupEntries(facts, state.sort),
    counts: headline(shown),
    facets: facetCounts(facts, state),
    charts: renderCvCharts(facts, state),
  };
}

export function meta() {
  return [
    ...pageMeta({
      title: CV_PAGE.seoTitle,
      description: CV_PAGE.description,
      path: PATH,
      image: CARD,
      trail: [[CV_PAGE.title, PATH]],
    }),
    {
      tagName: "link",
      rel: "alternate",
      type: "text/markdown",
      href: `${SITE_ORIGIN}${contentPageMarkdownPath(PATH)}`,
    },
    {
      tagName: "link",
      rel: "alternate",
      type: "application/pdf",
      href: `${SITE_ORIGIN}${CV_PDF_PATH}`,
    },
  ];
}

/**
 * The page about the Person, and a ScholarlyArticle per paper the site holds, joined by the Person's @id.
 * The page's `@id` is Prelum's page node, which carries its trail, so the two are one page.
 */
function cvJsonLd(cv: Cv) {
  const records = cv.entries.flatMap((e) => (e.paper?.record ? [e.paper.record] : []));
  return [
    thing("WebPage", {
      "@id": `${SITE_ORIGIN}${PATH}#webpage`,
      url: `${SITE_ORIGIN}${PATH}`,
      name: `${CV_PAGE.title}, ${cv.person.name}`,
      description: CV_PAGE.description,
      about: { "@id": personId(SITE_ORIGIN) },
    }),
    ...publicationsJsonLd(SITE_ORIGIN, records),
  ];
}

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

const COPY_NAMES = { plain: "Citation", bibtex: "BibTeX", ris: "RIS" } as const;

function CopyButton({
  kind,
  label,
  entry,
}: {
  kind: "plain" | "bibtex" | "ris";
  label: string;
  entry: CvEntry;
}) {
  const paper = entry.paper;
  if (!paper) return null;
  const src = kind === "bibtex" ? paper.bibtexPath : kind === "ris" ? paper.risPath : null;
  const name = COPY_NAMES[kind];
  // Capsomer's copy (components/copy): the bubble beside the button is the message and the live region.
  return (
    <span className="cap-copy" data-cv-copy-wrap="" hidden>
      <button
        type="button"
        className="cap-btn"
        data-variant="quiet"
        data-size="sm"
        data-cv-copy={kind}
        data-cv-src={src ?? undefined}
        data-cv-for={entry.id}
        data-cap-copied={`${name} copied`}
        data-cap-failed={`${name} not copied: use the file links`}
      >
        {label}
      </button>
      <span className="cap-copy-tip" role="status" />
    </span>
  );
}

function PaperDetails({ entry }: { entry: CvEntry }) {
  const paper = entry.paper;
  if (!paper) return null;
  const n = paper.authors.length;
  return (
    <details className="cv-paper-more">
      <summary>
        {paper.hasAbstract ? "Abstract, citation" : "Citation"} and{" "}
        {n === 1 ? "author" : `all ${n} authors`}
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
        {paper.bibtex ? <template id={`${entry.id}-bibtex`}>{paper.bibtex}</template> : null}
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

/** One or two lines each: the long lists read as a list, and the papers keep the room. */
const COMPACT = new Set(["grant", "award", "course", "service", "development"]);

function Entry({ entry, hidden, order }: { entry: CvEntry; hidden: boolean; order: number }) {
  return (
    <li
      className={`cv-entry cv-entry-${entry.type}${COMPACT.has(entry.type) ? " cv-compact" : ""}`}
      id={entry.id}
      data-cv-entry=""
      data-order={order}
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
      <span className="cv-when cap-timeline-mark">{entry.when}</span>
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
    <div className="cv-stat cap-data">
      <dt>{label}</dt>
      <dd>
        <span className="cv-stat-value" data-cv-count={name}>
          {value}
        </span>
        <div className="cv-spark" data-cv-spark={name} dangerouslySetInnerHTML={markup(spark)} />
        {sub ? <span className="cv-stat-sub">{sub}</span> : null}
      </dd>
    </div>
  );
}

function CvSearch({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <SearchField
      label="Search"
      landmark="Search the CV"
      name="q"
      value={value}
      onChange={setValue}
      placeholder="Title, author, place, course"
      autoComplete="off"
      spellCheck={false}
    />
  );
}

export default function CvRoute({ loaderData }: Route.ComponentProps) {
  const {
    cv: CV,
    facts: FACTS,
    jsonLd,
    state,
    shownIds,
    groups,
    counts,
    facets,
    charts,
  } = loaderData;
  const shown = new Set(shownIds);
  const BY_ID = new Map(CV.entries.map((e) => [e.id, e]));
  const ORDER = new Map(CV.entries.map((e, i) => [e.id, i]));
  const YEARS = yearOptions(FACTS);
  return (
    <PageShell trail={<JsonLd data={jsonLd} />}>
      <div className="cv" data-cv="">
        <header className="cv-head">
          <p className="cv-eyebrow">
            {CV_PAGE.title} · {CV.edition}
          </p>
          <h1 className="cv-name cap-layout-grid">
            {CV.person.name}, {CV.person.degree}
          </h1>
          <p className="cv-lede">
            {CV.person.title}, {CV.person.department}, {CV.person.org}.
          </p>
          <p className="cv-actions">
            <ButtonLink href={CV_PDF_PATH} variant="link">
              Download PDF
            </ButtonLink>
            <button type="button" className="cap-btn" data-variant="link" data-cv-print="">
              Print
            </button>
            <ButtonLink href={contentPageMarkdownPath(PATH)} variant="link">
              Markdown
            </ButtonLink>
            <ButtonLink href="/research/publications" variant="link">
              All publications
            </ButtonLink>
          </p>
        </header>

        <section className="cv-overview" aria-labelledby="cv-overview-title">
          <h2 id="cv-overview-title" className="sr-only">
            At a glance
          </h2>
          <dl className="cv-stats">
            <Stat
              label="Publications"
              value={String(counts.papers)}
              spark={charts.papers}
              name="papers"
            />
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
            <div
              className="cv-timeline-plot"
              data-cv-timeline=""
              dangerouslySetInnerHTML={markup(charts.timeline)}
            />
            <p className="cv-timeline-hint" data-cv-hint="">
              Select a year&rsquo;s bar to show only that year, and select it again for every year.
              The key filters by type.
            </p>
          </div>
        </section>

        <form
          className="cv-filters"
          method="get"
          action={PATH}
          aria-label="Filter the CV"
          data-cv-form=""
        >
          <div className="cv-filter-row cv-filter-top">
            <div className="cv-search">
              <CvSearch defaultValue={state.q} />
            </div>
          </div>
          {/* Sent as app/enhance/cv.ts leaves it on a phone, so the fold never moves the page; cv.css shows it
              open wider than that and with script off. */}
          <details className="cv-more" open={activeCount(state) > 0} data-cv-more="">
            <summary className="cv-more-summary">
              Filters and sort{" "}
              <span data-cv-active="">
                {activeCount(state) > 0 ? `(${activeCount(state)} on)` : ""}
              </span>
            </summary>
            <div className="cv-more-body">
              <CheckChips
                legend="Type"
                name="type"
                checked={state.types}
                options={TYPES.map(([id, , plural]) => ({
                  value: id,
                  label: plural,
                  count: facets.types[id] ?? 0,
                }))}
              />
              <div className="cv-filter-row">
                <CheckChips
                  legend="Research area"
                  name="area"
                  checked={state.areas}
                  options={AREAS.filter(([id]) => FACTS.some((f) => f.areas.includes(id))).map(
                    ([id, label]) => ({ value: id, label, count: facets.areas[id] ?? 0 }),
                  )}
                />
                <SpanField
                  label="Years"
                  names={{ from: "from", to: "to" }}
                  options={YEARS.map((y) => ({ value: String(y), label: y }))}
                  from={state.from}
                  to={state.to}
                />
                <label className="cap-field">
                  <span className="cap-field-label">Role</span>
                  <select className="cap-select" name="role" defaultValue={state.role ?? ""}>
                    <option value="">Any role</option>
                    {ROLES.filter(([id]) => FACTS.some((f) => f.role === id)).map(([id, label]) => (
                      <option key={id} value={id} data-cv-facet={id} data-label={label}>
                        {label} ({facets.roles[id] ?? 0})
                      </option>
                    ))}
                  </select>
                </label>
                <label className="cap-field">
                  <span className="cap-field-label">Sort</span>
                  <select className="cap-select" name="sort" defaultValue={state.sort}>
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
            <button type="submit" className="cap-btn" data-variant="primary" data-cv-apply="">
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

        <div className="cv-results" data-cv-results="">
          {groups.map((group) => {
            const visible = group.parts.reduce(
              (n, part) => n + part.ids.filter((id) => shown.has(id)).length,
              0,
            );
            return (
              <section
                key={group.key}
                className="cv-group"
                data-cv-group={group.key}
                hidden={visible === 0}
              >
                <h2 className="cv-group-title">
                  {group.heading}{" "}
                  <span className="cv-group-count" data-cv-group-count="">
                    {visible}
                  </span>
                </h2>
                {group.key === "type-talk" ? (
                  <p className="cv-group-note">
                    The CV lists {CV.presentations.international} international and{" "}
                    {CV.presentations.national} national and regional presentations,{" "}
                    {CV.presentations.from}-{CV.presentations.to}, most of them posters and talks
                    given by students with Dustin as senior author. Listed here: the invited talks,
                    seminars and roundtables he leads.
                  </p>
                ) : null}
                {group.key === "type-mentoring" ? (
                  <p className="cv-group-note">
                    Counts only: the CV names each student, and this page never does.
                  </p>
                ) : null}
                {group.parts.map((part) => (
                  <div
                    key={part.key}
                    className="cv-part"
                    data-cv-part={part.key}
                    hidden={!part.ids.some((id) => shown.has(id))}
                  >
                    {part.heading ? <h3 className="cv-part-title">{part.heading}</h3> : null}
                    <ol className="cv-list cap-timeline">
                      {part.ids.map((id) => {
                        const entry = BY_ID.get(id);
                        if (!entry) throw new Error(`cv: grouping named an unknown entry ${id}`);
                        return (
                          <Entry
                            key={id}
                            entry={entry}
                            hidden={!shown.has(id)}
                            order={ORDER.get(id) ?? 0}
                          />
                        );
                      })}
                    </ol>
                  </div>
                ))}
              </section>
            );
          })}
        </div>
        <p className="cv-foot">
          {FACTS.length} entries from the {CV.edition} CV. Each paper follows its journal record at
          Crossref and has its own page under <a href="/research/publications">Publications</a>.
        </p>
      </div>
      <template data-island="cv" />
    </PageShell>
  );
}
