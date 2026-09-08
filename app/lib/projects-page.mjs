/**
 * The /projects page as the generic page shape `recordsForPage` consumes.
 *
 * ONE ordered list, two readers, exactly as `colophon-sections.mjs` is. The
 * ordered list here is `content/projects.json` itself: the route RENDERS from
 * it and this module INDEXES from it, so neither hardcodes the other's roster
 * and a project cannot exist in the index without existing on the page.
 *
 * **The anchors are the reason this module exists rather than living in the
 * route.** A section record carries a fragment, and a record pointing at a
 * fragment the page does not render still returns a hit, still looks correct in
 * a result list, and scrolls nowhere. That failure is SILENT. So the anchor is
 * derived from the project's `slug` in one place and both the record and the
 * card's `id` read it from here.
 *
 * Kept out of `records.mjs` deliberately, on that module's own rule: it is the
 * generic indexer for any page and must not learn this page's shape, exactly as
 * it does not know how a post's markdown is produced.
 *
 * Nothing here reads the clock, the filesystem or git. Records must be a pure
 * function of committed data to live in the gated artifact.
 */

/** The route. Asserted against `routes.ts` by the gate. */
export const PROJECTS_URL = "/projects";

export const PROJECTS_TITLE = "Projects";

export const PROJECTS_DESCRIPTION =
  "Things I have built on Cloudflare, each with a number that is either dated " +
  "or derived, and links to whatever publicly evidences it.";

/** The lead paragraph above the grid, indexed with the document. */
export const PROJECTS_INTRO =
  "Every card leads with a real number. Some are derived from this repository " +
  "on every build, so they cannot go stale; the rest are dated observations, " +
  "and the date is rendered because a number without one keeps looking " +
  "authoritative long after it stops being true. Below each card is its " +
  "evidence: the articles, pages and public repositories that document it. " +
  "Where a project is documented nowhere public, the card says nothing about " +
  "its internals rather than asking you to take a claim on trust.";

/**
 * The fragment for one project. ONE definition, read by the page and the index.
 *
 * @param {string} slug
 */
export function projectAnchor(slug) {
  return `project-${slug}`;
}

/**
 * THE DERIVED METRICS, and why any metric on this page is derived at all.
 *
 * The flagship card used to read "24 verification gates in the build", dated,
 * and by 2026-08-30 the build ran twenty-seven. Nothing was wrong with the
 * date; the number was simply a SECOND COPY of something the repository can
 * re-derive, which is precisely what hard rule 17 refuses. So the copy is gone
 * and the value is computed from the one place that owns it.
 *
 * **The inputs are ALREADY-OWNED ARTIFACTS, never a fresh measurement taken
 * here.** `content/generated/stack.json` is generated from package.json by
 * `build:stack`, reconciled against its sources by `check:stack`, and already
 * imported by the colophon, so the gate count reaches this card through the
 * same pipe the colophon reads and costs the Worker nothing new. `PHAGE_YEARS` is the data
 * the roster page itself renders. Neither is a number typed into this file.
 *
 * **A DERIVED METRIC CARRIES NO DATE, and that is the point rather than an
 * omission.** A date on a value recomputed every build would be a claim about
 * when a human last looked, which is exactly the kind of tense-bound sentence
 * that rots while looking authoritative. The two forms are mutually exclusive
 * and the gate refuses an entry declaring both, so a metric has one owner of
 * its freshness: a date, or a derivation.
 *
 * FAILS CLOSED on an unknown key. A metric naming a derivation nothing
 * implements would otherwise render as nothing at all, which is the shape that
 * reads as a styling bug and sends the next reader to the stylesheet.
 *
 * @type {Record<string, (inputs: any) => string>}
 */
export const METRIC_DERIVATIONS = {
  "gate-count": (inputs) => String(inputs.stack.gates.length),
  "phage-researchers": (inputs) =>
    String(
      inputs.phageYears.reduce(
        (/** @type {number} */ total, /** @type {any} */ year) =>
          total + year.researchers.length,
        0,
      ),
    ),
};

/**
 * The rendered value of one metric, dated or derived.
 *
 * ONE implementation, called by the route that renders the card and by the
 * gate that checks it. A gate computing the expected value its own way would
 * be the mirror hard rule 10 names: two implementations that agree until they
 * do not, with nothing able to tell which one is right.
 *
 * @param {any} metric
 * @param {{ stack: any, phageYears: any[] }} inputs
 * @returns {string}
 */
export function metricValue(metric, inputs) {
  if (!metric.derived) return metric.value;
  const derive = METRIC_DERIVATIONS[metric.derived];
  if (!derive) {
    throw new Error(
      `content/projects.json names the derivation "${metric.derived}", which ` +
        `METRIC_DERIVATIONS in app/lib/projects-page.mjs does not implement. ` +
        `Known: ${Object.keys(METRIC_DERIVATIONS).join(", ")}.`,
    );
  }
  return derive(inputs);
}

/**
 * The metric as one indexable sentence.
 *
 * TWO SHAPES, and the index has to describe the one the card renders. A dated
 * metric carries its value and the date it was taken; a DERIVED metric carries
 * no value here at all, because the value is computed at build time and writing
 * one into the record would be the second copy hard rule 17 exists to refuse.
 * So the derived form indexes what it counts and says it is derived, which is
 * exactly what a reader searching for it can match on.
 *
 * @param {any} metric
 */
function metricSentence(metric) {
  return metric.derived
    ? `${metric.label}, derived from the repository on every build.`
    : `${metric.value} ${metric.label}, measured ${metric.asOf}.`;
}

/**
 * The indexable body for one project.
 *
 * The METRIC IS INDEXED, and that is deliberate rather than incidental: the
 * page's argument is that each project carries a real number, so a reader
 * searching for the number, or for the thing it counts, should land on the card
 * that claims it.
 *
 * THE NOTABLE SENTENCES AND THE EVIDENCE LABELS ARE INDEXED TOO, and both are
 * optional, so both are spread rather than joined into a fixed slot: an absent
 * field must contribute nothing, not an empty phrase. The evidence labels
 * matter most here. They are the titles of the articles that document a
 * project, so a reader who searches for an article's subject and lands on the
 * portfolio card has landed somewhere useful rather than somewhere confusing.
 *
 * @param {any} project
 */
function bodyFor(project) {
  return [
    project.oneLiner,
    project.description,
    ...(project.notable ?? []),
    metricSentence(project.metric),
    `Role: ${project.role}. Status: ${project.status}.`,
    `Stack: ${project.stack.join(", ")}.`,
    ...(project.evidence?.length
      ? [
          `Evidence: ${project.evidence
            .map((/** @type {any} */ e) => e.label)
            .join("; ")}.`,
        ]
      : []),
  ].join(" ");
}

/**
 * @param {any} projectsJson content/projects.json
 * @returns {Array<Record<string, any>>} one page input, in a list
 */
export function projectsPages(projectsJson) {
  const projects = projectsJson.projects ?? [];
  if (projects.length === 0) {
    // Fail closed. An empty roster would index as a lone document record and
    // `recordsForPage` would throw on the empty section list anyway; saying so
    // here names the cause rather than the symptom.
    throw new Error(
      "content/projects.json declares no projects, so /projects would index " +
        "with no sections and every deep link would be lost.",
    );
  }

  return [
    {
      url: PROJECTS_URL,
      uid: "page:projects",
      title: PROJECTS_TITLE,
      description: PROJECTS_DESCRIPTION,
      intro: PROJECTS_INTRO,
      sections: projects.map((/** @type {any} */ project) => ({
        anchor: projectAnchor(project.slug),
        title: project.name,
        body: bodyFor(project),
      })),
    },
  ];
}
