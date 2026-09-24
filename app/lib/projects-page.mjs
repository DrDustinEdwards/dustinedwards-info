/**
 * The anchor lives here so the index record and the card's `id` read one definition: a record
 * pointing at a fragment the page does not render still returns a hit and scrolls nowhere, SILENTLY.
 */

export const PROJECTS_URL = "/projects";

export const PROJECTS_TITLE = "Projects";

export const PROJECTS_DESCRIPTION =
  "Things I have built on Cloudflare, each with a number that is either dated " +
  "or derived, and links to whatever publicly evidences it.";

export const PROJECTS_INTRO =
  "Every card leads with a real number. Some are derived from this repository " +
  "on every build, so they cannot go stale; the rest are dated observations, " +
  "and the date is rendered because a number without one keeps looking " +
  "authoritative long after it stops being true. Below each card is its " +
  "evidence: the articles, pages and public repositories that document it. " +
  "Where a project is documented nowhere public, the card says nothing about " +
  "its internals rather than asking you to take a claim on trust.";

/**
 * @param {string} slug
 */
export function projectAnchor(slug) {
  return `project-${slug}`;
}

/**
 * A derived metric carries no date: a date on a value recomputed every build would be a claim
 * about when a human last looked.
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
 * Called by both the route and the gate, so the gate never computes the expected value its own way.
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
 * A derived metric indexes no value, because the value is computed at build time.
 *
 * @param {any} metric
 */
function metricSentence(metric) {
  return metric.derived
    ? `${metric.label}, derived from the repository on every build.`
    : `${metric.value} ${metric.label}, measured ${metric.asOf}.`;
}

/**
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
