import projectsData from "../../content/projects.json";
import { SiteFooter } from "~/components/site-footer";
import { SiteHeader } from "~/components/site-header";
import {
  PROJECTS_DESCRIPTION,
  PROJECTS_INTRO,
  PROJECTS_TITLE,
  PROJECTS_URL,
  projectAnchor,
} from "~/lib/projects-page.mjs";
import { SITE_ORIGIN,
  pageMeta,
} from "~/lib/seo";

/**
 * /projects, the portfolio index.
 *
 * ZERO JAVASCRIPT, per hard rule 9. There is no loader, no client state and no
 * enhancement: the roster is a build-time import, so this route is a pure
 * function from committed JSON to markup. Nothing here belongs in
 * enhancements.json because there is nothing to enhance.
 *
 * WHY THE NUMBER IS THE POINT. The hero says this site publishes the numbers,
 * and a portfolio without numbers is a list of links. Every card therefore
 * leads with a measured value and the date it was measured. The date is not
 * decoration: an undated number rots silently and keeps looking authoritative,
 * whereas a dated one is honest about its own age. Where a real number is not
 * reachable read-only, the value says so rather than guessing, and that is a
 * legitimate state rather than a gap to fill later.
 *
 * CARDS ON THE CANVAS ARE LEGAL HERE. Binding rule 7 reserves cards for
 * indexes and keeps body prose on the page canvas; this is an index, so the
 * card treatment is the sanctioned one rather than an exception.
 *
 * The build-time import is the features.json pattern: a roster change needs a
 * deploy AND a sync, and `npm run ship` covers both.
 */

type Metric = { label: string; value: string; asOf: string };
type Project = {
  slug: string;
  name: string;
  oneLiner: string;
  description: string;
  role: string;
  status: string;
  url: string | null;
  repo: string | null;
  stack: string[];
  metric: Metric;
};

const PROJECTS = projectsData.projects as Project[];

/*
 * The title, description, intro and anchors come from `projects-page.mjs`, the
 * module the INDEXER also reads. Nothing on this page is typed twice, so a
 * search result's title cannot drift from the heading it lands on, and a
 * section record cannot cite a fragment this page does not render.
 */
const TITLE = PROJECTS_TITLE;
const DESCRIPTION = PROJECTS_DESCRIPTION;

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
 * ItemList, one entry per project.
 *
 * UN-NONCED, deliberately, on the measured asymmetry this repo already relies
 * on for the article and home page payloads: `script-src` does not gate
 * `application/ld+json`, because it is data rather than an executable script.
 * Adding a nonce here would imply a protection that is not the one doing the
 * work, and would diverge from the three payloads already shipping.
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
        "@type": "SoftwareApplication",
        name: project.name,
        description: project.oneLiner,
        applicationCategory: "WebApplication",
        ...(project.url ? { url: project.url } : {}),
        ...(project.repo ? { codeRepository: project.repo } : {}),
      },
    })),
  };
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
      <main className="page" id="main">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd()) }}
        />
        <div className="page-inner">
          <h1 className="page-title">{TITLE}</h1>
          <p className="page-intro">{PROJECTS_INTRO}</p>

          <ul className="project-grid">
            {PROJECTS.map((project) => (
              // The id IS the search record's anchor, from the one definition
              // in projects-page.mjs. A record citing a fragment the page does
              // not render still returns a hit and scrolls nowhere, silently.
              <li key={project.slug} id={projectAnchor(project.slug)} className="project-card">
                {/*
                  The metric leads, above the name. That ordering is the whole
                  argument of the page: the reader meets a number before they
                  meet a claim.
                */}
                <p className="project-metric">
                  <strong className="project-metric-value">{project.metric.value}</strong>
                  <span className="project-metric-label">{project.metric.label}</span>
                  {/* A <time> element, so the date is machine-readable as well
                      as rendered. Rule 2 does not apply: this is not a link. */}
                  <time className="project-metric-asof" dateTime={project.metric.asOf}>
                    measured {formatAsOf(project.metric.asOf)}
                  </time>
                </p>

                <h2 className="project-name">{project.name}</h2>
                <p className="project-oneliner">{project.oneLiner}</p>
                <p className="project-description">{project.description}</p>

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
                  Bare-text links, so binding rule 2 applies and they underline.
                  The base `a` rule already does it; nothing here removes it.
                  A card with neither link renders no list at all rather than an
                  empty row, which is the honest shape for the unlinked tier.
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
              </li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
