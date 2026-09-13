import { Link } from "react-router";

import projectsData from "../../content/projects.json";
import stack from "../../content/generated/stack.json";
import { PHAGE_YEARS } from "~/data/phage-hunters";
import { jsonLd } from "~/lib/json-ld.mjs";
import { ShellFooter } from "~/components/shell-footer";
import { ShellHeader } from "~/components/shell-header";
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
 * NO SCRIPT AT ALL, which is stronger than the law hard rule 9 asks for and is
 * a property of this route rather than a claim about the site. There is no
 * loader, no client state and no enhancement: every input is a build-time
 * import, so this route is a pure function from committed data to markup.
 * Nothing here belongs in enhancements.json because there is nothing to
 * enhance. This paragraph used to open "ZERO JAVASCRIPT", which is the one
 * phrasing rule 9 forbids, because it is the slogan that survives paraphrase
 * and is false in both directions.
 *
 * WHY THE NUMBER IS THE POINT. The hero says this site publishes the numbers,
 * and a portfolio without numbers is a list of links. Every card therefore
 * leads with a real value and says where that value came from. TWO PROVENANCES
 * ARE POSSIBLE and a metric declares exactly one: a DATED observation, whose
 * date is rendered because an undated number rots silently while continuing to
 * look authoritative, or a DERIVATION this build ran, which cannot rot and
 * therefore carries no date. The derived form arrived on 2026-08-30, when the
 * flagship card's "verification gates in the build" was found reading four
 * fewer gates than the build ran: the date was honest and the number was a
 * second copy, which is exactly what hard rule 17 refuses.
 *
 * WHAT IS TECHNICALLY NOTABLE, AND THE EVIDENCE FOR IT, are both optional
 * fields, and that asymmetry is the page's other honest shape. A card whose
 * project is documented nowhere public carries no notable list and no evidence
 * list, rather than sentences reconstructed from memory and links to nothing.
 *
 * CARDS ON THE CANVAS ARE LEGAL HERE. Binding rule 7 reserves cards for
 * indexes and keeps body prose on the page canvas; this is an index, so the
 * card treatment is the sanctioned one rather than an exception.
 *
 * The build-time import is the features.json pattern: a roster change needs a
 * deploy AND a sync, and `npm run ship` covers both.
 */

/**
 * A metric is DATED or DERIVED, never both. See METRIC_DERIVATIONS.
 *
 * Modelled as a union rather than as two optional fields, so a card cannot be
 * written with a value and a derivation and quietly render one of them: the
 * two branches below are exhaustive because the type says they are.
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
 * What the derived metrics are computed FROM, assembled once at module scope.
 *
 * Both are already in this Worker: `stack.json` because the colophon imports
 * it, `PHAGE_YEARS` because the roster route renders it. Neither is a
 * measurement taken here, which is the whole property that makes a derived
 * metric worth more than a dated one.
 */
const METRIC_INPUTS = { stack, phageYears: PHAGE_YEARS };

/*
 * The title, description, intro and anchors come from `projects-page.mjs`, the
 * module the INDEXER also reads. Nothing on this page is typed twice, so a
 * search result's title cannot drift from the heading it lands on, and a
 * section record cannot cite a fragment this page does not render.
 */
const TITLE = PROJECTS_TITLE;
const DESCRIPTION = PROJECTS_DESCRIPTION;

/**
 * /projects IS EDGE-CACHED NOW, and was the only public page that was not.
 *
 * It exported no headers() at all, so it fell through to hard rule 8's
 * uncached default in workers/app.ts and every reader paid an origin hit for a
 * page whose body is identical for all of them. Recorded in core.md as a known
 * gap; the shared helper is what closes it, and using the helper rather than a
 * fifth copy is what stops the Vary line being dropped here later.
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
        /*
         * THE TYPE IS DECLARED PER ENTRY, since the roster page joined this
         * list. Every entry used to be a SoftwareApplication with an
         * applicationCategory of WebApplication, which was true of six things
         * and false of the seventh: a roster page on this site is a page, and
         * telling a machine it is an application is a lie that costs nothing
         * to avoid. The vocabulary is closed and the gate holds it closed.
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
 * One citation, rendered as an ordinary link.
 *
 * THE THREE KINDS DIFFER ONLY IN HOW THE HREF IS BUILT, and that is why they
 * are a kind rather than three fields. A post ref is a SLUG, not a path: the
 * manifest cannot carry `/blog/<slug>` because the gate has to check the slug
 * against the built corpus, and a path would make it strip the prefix back off
 * to do so. One transformation, in one place, here.
 *
 * FAILS CLOSED on an unknown kind. Rendering the bare label would leave a
 * citation on the page pointing nowhere, which is the silent failure the
 * anchor discipline in `projects-page.mjs` exists to prevent, wearing a
 * different hat.
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
 * The line under the metric saying where its number came from.
 *
 * ITS OWN COMPONENT so the union narrows. Written inline, TypeScript could not
 * discriminate `derived?: undefined` from `derived: string` through a property
 * of a property, and `asOf` stayed `string | undefined` inside the branch that
 * had already excluded the derived case. Binding the metric to one parameter
 * and testing it directly is what makes both branches exhaustive, and the type
 * error was a real one rather than a nuisance: it was the compiler saying the
 * two shapes were not actually being told apart.
 *
 * SAME ELEMENT CLASS EITHER WAY. The two forms are one channel, and giving the
 * derived line its own treatment would read as a different kind of fact.
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
      <ShellHeader />
      <main className="page site-shell-main" id="main" tabIndex={-1}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(itemListJsonLd()) }}
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
                  <strong className="project-metric-value">
                    {metricValue(project.metric, METRIC_INPUTS)}
                  </strong>
                  <span className="project-metric-label">{project.metric.label}</span>
                  {/*
                    THE PROVENANCE LINE, one shape per metric form.

                    A dated metric gets a <time> element, so the date is
                    machine-readable as well as rendered; rule 2 does not apply,
                    this is not a link. A DERIVED metric gets a plain span
                    saying so, and deliberately carries no date: the value was
                    computed by this build, so a date would only record when a
                    human last looked, which is a claim that rots while the
                    number beside it stays true.

                    Same element class either way, so the two read as one
                    channel rather than as two treatments.
                  */}
                  <MetricProvenance metric={project.metric} />
                </p>

                <h2 className="project-name">{project.name}</h2>
                <p className="project-oneliner">{project.oneLiner}</p>
                <p className="project-description">{project.description}</p>

                {/*
                  WHAT IS TECHNICALLY NOTABLE, and it is optional on purpose.

                  Several projects here are documented nowhere public, so there
                  is no source this list could be written from that is not
                  somebody's recollection. A card with no notable list is
                  therefore the honest shape for those, exactly as a card with
                  neither link renders no link list rather than an empty row.
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

                {/*
                  THE EVIDENCE, last, under its own heading.

                  A heading rather than a bare list, because this is a claim
                  about the card above it and an unlabelled row of links reads
                  as navigation. It is an h3 under the card's h2, so the
                  document outline stays ordered and a screen reader reaches it
                  as part of the project rather than as a sibling of it.
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
