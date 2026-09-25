import { Link } from "react-router";

import projectsData from "../../content/projects.json";
import stack from "../../content/generated/stack.json";
import { PHAGE_YEARS } from "~/data/phage-hunters";
import { jsonLd } from "~/lib/json-ld.mjs";
import { PageShell } from "~/components/page-shell";
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

/** Dated or derived, never both: an undated observation rots silently, and a derivable one is a second copy. */
type Metric =
  | { label: string; value: string; asOf: string; derived?: undefined }
  | { label: string; value?: undefined; asOf?: undefined; derived: string };

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

const METRIC_INPUTS = { stack, phageYears: PHAGE_YEARS };

/* Shared with the indexer, so a search result cannot drift from the heading it lands on. */
const TITLE = PROJECTS_TITLE;
const DESCRIPTION = PROJECTS_DESCRIPTION;

/** Without `headers()` the uncached default makes every reader pay an origin hit; the shared helper keeps the Vary line. */
export function headers() {
  return publicHtmlHeaders();
}

export function meta() {
  return pageMeta({
    title: `${TITLE} | Dustin Edwards`,
    description: DESCRIPTION,
    path: PROJECTS_URL,
  });
}

/** Un-nonced: `script-src` does not gate `application/ld+json`. */
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

/** A post ref is a slug, not a path: the gate checks it against the built corpus. Fails closed on an unknown kind. */
function EvidenceLink({ item }: { item: Evidence }) {
  if (item.kind === "post") return <Link to={`/blog/${item.ref}`}>{item.label}</Link>;
  if (item.kind === "page") return <Link to={item.ref}>{item.label}</Link>;
  if (item.kind === "repo") return <a href={item.ref}>{item.label}</a>;
  throw new Error(
    `content/projects.json declares evidence of kind "${item.kind}", which ` +
      `app/routes/projects.tsx cannot render. Known: post, page, repo.`,
  );
}

/** Its own component so the union narrows: inline, TypeScript cannot discriminate through a property of a property. */
function MetricProvenance({ metric }: { metric: Metric }) {
  if (metric.derived !== undefined) {
    return (
      <span className="project-metric-asof">derived from the repository by this build</span>
    );
  }
  return (
    <time className="project-metric-asof" dateTime={metric.asOf}>
      measured {formatAsOf(metric.asOf)}
    </time>
  );
}

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
    <PageShell
      lead={
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(itemListJsonLd()) }}
        />
      }
    >
      <h1 className="page-title">{TITLE}</h1>
      <p className="page-intro">{PROJECTS_INTRO}</p>

      <ul className="project-grid">
        {PROJECTS.map((project) => (
          // The id is the search record's anchor; a record citing a fragment the page does not render scrolls nowhere.
          <li key={project.slug} id={projectAnchor(project.slug)} className="project-card">
            <p className="project-metric">
              <strong className="project-metric-value">
                {metricValue(project.metric, METRIC_INPUTS)}
              </strong>
              <span className="project-metric-label">{project.metric.label}</span>
              <MetricProvenance metric={project.metric} />
            </p>

            <h2 className="project-name">{project.name}</h2>
            <p className="project-oneliner">{project.oneLiner}</p>
            <p className="project-description">{project.description}</p>

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
    </PageShell>
  );
}
