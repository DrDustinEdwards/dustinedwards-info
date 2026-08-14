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
  "Things I have built on Cloudflare, each with a measured number and the date " +
  "it was measured.";

/** The lead paragraph above the grid, indexed with the document. */
export const PROJECTS_INTRO =
  "Every card leads with a real number and the date it was measured. A number " +
  "without a date rots silently and keeps looking authoritative, so the date " +
  "is rendered beside it. Where a number is not reachable without touching " +
  "the project, the card says what it would count rather than guessing.";

/**
 * The fragment for one project. ONE definition, read by the page and the index.
 *
 * @param {string} slug
 */
export function projectAnchor(slug) {
  return `project-${slug}`;
}

/**
 * The indexable body for one project.
 *
 * The METRIC IS INDEXED, and that is deliberate rather than incidental: the
 * page's argument is that each project carries a measured number, so a reader
 * searching for the number, or for the thing it counts, should land on the card
 * that claims it.
 *
 * @param {any} project
 */
function bodyFor(project) {
  return [
    project.oneLiner,
    project.description,
    `${project.metric.value} ${project.metric.label}, measured ${project.metric.asOf}.`,
    `Role: ${project.role}. Status: ${project.status}.`,
    `Stack: ${project.stack.join(", ")}.`,
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
