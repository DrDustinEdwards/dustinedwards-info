import { Link } from "react-router";

import projectsData from "../../content/projects.json";
import stack from "../../content/generated/stack.json";
import { PHAGE_YEARS } from "~/data/phage-hunters";
import { jsonLd } from "~/lib/json-ld.mjs";
import { ShellFooter } from "~/components/shell-footer";
import { SiteHeader } from "~/components/site-header";
import {
  PROJECTS_DESCRIPTION,
  PROJECTS_INTRO,
  PROJECTS_TITLE,
  PROJECTS_URL,
  metricValue,
  projectAnchor,
} from "~/lib/projects-page.mjs";
import {
  publicHtmlHeaders,
  pageMeta,
} from "~/lib/seo";

import "~/styles/projects.css";

/**
 * /projects, the portfolio index.
 *
 * NO SCRIPT AT ALL, which is stronger than hard rule 9 asks for and is a property
 * of this route: no loader, no client state, no enhancement, so it is a pure
 * function from committed data to markup.
 *
 * TWO PROVENANCES ARE POSSIBLE AND A METRIC DECLARES EXACTLY ONE: a DATED
 * observation, whose date is rendered because an undated number rots silently, or
 * a DERIVATION this build ran, which cannot rot and carries no date. A dated
 * number that is also derivable is a second copy, which is what hard rule 17
 * refuses.
 *
 * CARDS ON THE CANVAS ARE LEGAL HERE: binding rule 7 reserves them for indexes,
 * and this is one.
 */

/**
 * A metric is DATED or DERIVED, never both. Modeled as a union rather than two
 * optional fields, so a card cannot be written with a value and a derivation and
 * quietly render one of them.
 */
type Metric =
  | { label: string; value: string; asOf: string; derived?: undefined }
  | { label: string; value?: undefined; asOf?: undefined; derived: string };

/** A citation. `kind` decides how the href is built; see EvidenceLink. */
type Evidence = { kind: string; ref: string; label: string };

type Project = {
  slug: string;
  name: string;
  oneLiner: string;
  description: string;
  notable?: string[];
  schemaType: "SoftwareApplication" | "WebPage";
  role: string;
  status: string;
  url: string | null;
  repo: string | null;
  stack: string[];
  metric: Metric;
  evidence?: Evidence[];
};

const PROJECTS = projectsData.projects as Project[];

/**
 * Both are already in this Worker. Neither is a measurement taken here, which is
 * the whole property that makes a derived metric worth more than a dated one.
 */
const METRIC_INPUTS = { stack, phageYears: PHAGE_YEARS };

/*
 * The title, description, intro and anchors come from `projects-page.mjs`, the
 * module the INDEXER also reads, so a search result's title cannot drift from the
 * heading it lands on and a record cannot cite a fragment this page does not
 * render.
 */
const TITLE = PROJECTS_TITLE;
const DESCRIPTION = PROJECTS_DESCRIPTION;

/**
 * Exporting no `headers()` falls through to hard rule 8's uncached default, so
 * every reader paid an origin hit for a page whose body is identical for all of
 * them. Using the shared helper rather than a fifth copy is what stops the Vary
 * line being dropped here later.
 */
export function headers() {
  return publicHtmlHeaders();
}

export function meta() {
  /* Was canonical plus OG text with NO image and NO twitter card, so a shared
     link rendered as a bare URL rather than a card. pageMeta carries the set. */
  return pageMeta({
    title: `${TITLE} | Dustin Edwards`,
    description: DESCRIPTION,
    path: PROJECTS_URL,
  });
}

/**
 * UN-NONCED, deliberately: `script-src` does not gate `application/ld+json`,
 * because it is data rather than an executable script. A nonce here would imply a
 * protection that is not the one doing the work.
 */
function itemListJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: TITLE,
    description: DESCRIPTION,
    numberOfItems: PROJECTS.length,
    itemListElement: PROJECTS.map((project, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        /*
         * THE TYPE IS DECLARED PER ENTRY. A roster page is a page, and telling a machine
         * it is an application is a lie that costs nothing to avoid. The vocabulary is
         * closed and the gate holds it closed.
         */
        "@type": project.schemaType,
        name: project.name,
        description: project.oneLiner,
        ...(project.schemaType === "SoftwareApplication"
          ? { applicationCategory: "WebApplication" }
          : {}),
        ...(project.url ? { url: project.url } : {}),
        ...(project.repo ? { codeRepository: project.repo } : {}),
      },
    })),
  };
}

/**
 * THE THREE KINDS DIFFER ONLY IN HOW THE HREF IS BUILT. A post ref is a SLUG, not
 * a path, because the gate checks the slug against the built corpus.
 *
 * FAILS CLOSED on an unknown kind: rendering the bare label would leave a citation
 * on the page pointing nowhere.
 */
function EvidenceLink({ item }: { item: Evidence }) {
  if (item.kind === "post") return <Link to={`/blog/${item.ref}`}>{item.label}</Link>;
  if (item.kind === "page") return <Link to={item.ref}>{item.label}</Link>;
  if (item.kind === "repo") return <a href={item.ref}>{item.label}</a>;
  throw new Error(
    `content/projects.json declares evidence of kind "${item.kind}", which ` +
      `app/routes/projects.tsx cannot render. Known: post, page, repo.`,
  );
}

/**
 * ITS OWN COMPONENT so the union narrows: written inline, TypeScript could not
 * discriminate the two shapes through a property of a property. SAME ELEMENT CLASS
 * EITHER WAY, because the two forms are one channel.
 */
function MetricProvenance({ metric }: { metric: Metric }) {
  if (metric.derived !== undefined) {
    return (
      <span className="project-metric-asof">derived from the repository by this build</span>
    );
  }
  /* A <time> element, so the date is machine-readable as well as rendered.
     Binding rule 2 does not apply: this is not a link. */
  return (
    <time className="project-metric-asof" dateTime={metric.asOf}>
      measured {formatAsOf(metric.asOf)}
    </time>
  );
}

/** en-dash-free, and the same formatting the colophon uses for dated claims. */
function formatAsOf(iso: string) {
  const [year, month, day] = iso.split("-");
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[Number(month) - 1]} ${Number(day)}, ${year}`;
}

export default function Projects() {
  return (
    <>
      <SiteHeader />
      <main className="page" id="main" tabIndex={-1}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(itemListJsonLd()) }}
        />
        <div className="page-inner">
          <h1 className="page-title">{TITLE}</h1>
          <p className="page-intro">{PROJECTS_INTRO}</p>

          <ul className="project-grid">
            {PROJECTS.map((project) => (
              // The id IS the search record's anchor, from the one definition in
              // `projects-page.mjs`. A record citing a fragment the page does not render still
              // returns a hit and scrolls nowhere, silently.
              <li key={project.slug} id={projectAnchor(project.slug)} className="project-card">
                {/*
                  The metric leads, above the name. That ordering is the whole
                  argument of the page: the reader meets a number before they
                  meet a claim.
                */}
                <p className="project-metric">
                  <strong className="project-metric-value">
                    {metricValue(project.metric, METRIC_INPUTS)}
                  </strong>
                  <span className="project-metric-label">{project.metric.label}</span>
                  {/*
                   * A dated metric gets a `<time>`. A DERIVED metric carries no date: the value
                   * was computed by this build, so a date would only record when a human last
                   * looked, which rots while the number beside it stays true.
                   */}
                  <MetricProvenance metric={project.metric} />
                </p>

                <h2 className="project-name">{project.name}</h2>
                <p className="project-oneliner">{project.oneLiner}</p>
                <p className="project-description">{project.description}</p>

                {/*
                 * Optional on purpose: several projects here are documented nowhere public, so a
                 * card with no notable list is the honest shape rather than sentences
                 * reconstructed from memory.
                 */}
                {project.notable && project.notable.length > 0 && (
                  <ul className="project-notable">
                    {project.notable.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                )}

                <p className="project-meta">
                  <span className="project-role">{project.role}</span>
                  <span className="project-status" data-status={project.status}>
                    {project.status}
                  </span>
                </p>

                <ul className="project-stack">
                  {project.stack.map((tag) => (
                    <li key={tag} className="project-stack-tag">
                      {tag}
                    </li>
                  ))}
                </ul>

                {/*
                 * Bare-text links, so binding rule 2 applies and they underline. A card with
                 * neither link renders no list at all rather than an empty row.
                 */}
                {(project.url || project.repo) && (
                  <ul className="project-links">
                    {project.url && (
                      <li>
                        <a href={project.url}>Visit {project.name}</a>
                      </li>
                    )}
                    {project.repo && (
                      <li>
                        <a href={project.repo}>Source</a>
                      </li>
                    )}
                  </ul>
                )}

                {/*
                 * A heading rather than a bare list, because this is a claim about the card above
                 * it and an unlabelled row of links reads as navigation. An h3 under the card's
                 * h2, so the outline stays ordered.
                 */}
                {project.evidence && project.evidence.length > 0 && (
                  <div className="project-evidence">
                    <h3 className="project-evidence-title">Evidence</h3>
                    <ul>
                      {project.evidence.map((item) => (
                        <li key={`${item.kind}:${item.ref}`}>
                          <EvidenceLink item={item} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </main>
      <ShellFooter />
    </>
  );
}
