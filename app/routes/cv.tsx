import { CheckChips } from "capsomer/react/chips";
import { SearchField, SpanField } from "capsomer/react/field";
import { JsonLd } from "capsomer/react/json-ld";
import { ButtonLink } from "capsomer/react/link";
import { useState, type ReactNode } from "react";

import { PageShell } from "~/components/page-shell";
import { readCv } from "~/db/cv";
import { contentPageCardPath, contentPageMarkdownPath } from "~/lib/content-pages.mjs";
import { getEnv } from "~/lib/context";
import { CV_PAGE, CV_PDF_PATH, cvFacts, formatDollars, type Cv } from "~/lib/cv/entries.mjs";
import { CV_HTML_TAGS } from "~/lib/cv/route";
import { renderCvCharts } from "~/lib/cv/render-charts";
import {
  AREAS,
  ROLES,
  SORTS,
  TYPES,
  facetCounts,
  groupEntries,
  headline,
  activeCount,
  isFiltered,
  matches,
  parseState,
  summaryText,
  yearOptions,
} from "~/lib/cv/view.mjs";
import { thing } from "@drdustinedwards/site-helpers/schema";
import {
  SITE_ORIGIN,
  pageMeta,
  personId,
  publicHtmlHeaders,
  publicationsJsonLd,
  shareCard,
} from "~/lib/seo";

import { Entry } from "~/components/cv-entry";
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
 * The CV (content/cv/, read from D1 per request, docs/CV.md). The whole CV is in the HTML; the query string only
 * sets which entries carry `hidden`, their grouping, counts and charts, so a shared filter URL renders the same
 * with script off. app/enhance/cv.ts runs the same functions (app/lib/cv/view.mjs) on every input.
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
          <h2 id="cv-overview-title" className="cap-sr-only">
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
              Select a year to filter.
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
          {FACTS.length} entries, {CV.edition} CV.
        </p>
      </div>
      <template data-island="cv" />
    </PageShell>
  );
}
