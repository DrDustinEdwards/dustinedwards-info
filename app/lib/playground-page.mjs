/**
 * The /playground page as the generic page shape `recordsForPage` consumes.
 *
 * ONE ordered list, two readers, exactly as `projects-page.mjs` and
 * `colophon-sections.mjs` are. The ordered list is `content/playground.json`:
 * the route RENDERS the demos from it and this module INDEXES them from it, so
 * neither hardcodes the other's roster.
 *
 * **The anchors are the reason this module exists rather than living in the
 * route.** A section record carries a fragment, and a record pointing at a
 * fragment the page does not render still returns a hit, still looks correct in
 * a result list, and scrolls nowhere. That failure is SILENT.
 *
 * Nothing here reads the clock, the filesystem or git. Records must be a pure
 * function of committed data to live in the gated artifact.
 */

/** The route. Asserted against `routes.ts` by the gate. */
export const PLAYGROUND_URL = "/playground";

export const PLAYGROUND_TITLE = "Playground";

export const PLAYGROUND_DESCRIPTION =
  "Interactive demos of this site's own machinery. Each one runs the same code " +
  "the site runs, server-side, with no JavaScript.";

/** The lead paragraph above the demos, indexed with the document. */
export const PLAYGROUND_INTRO =
  "Every demo here runs the real thing. The contrast lab computes with the " +
  "module the build gate computes with, the search demo runs the query through " +
  "the same path /search uses, and the chart is drawn by the pipeline that " +
  "draws the charts in the articles. A demo of a reimplementation would " +
  "demonstrate nothing, so there are no reimplementations. Every result is a " +
  "plain GET, rendered on the server, at a URL you can paste to someone.";

/**
 * The fragment for one demo. ONE definition, read by the page and the index.
 *
 * @param {string} slug
 */
export function demoAnchor(slug) {
  return `demo-${slug}`;
}

/**
 * The indexable body for one demo.
 *
 * The REAL PATH IS INDEXED, deliberately: the page's argument is that each demo
 * runs production code, so a reader searching for the module name should land on
 * the demo that exercises it.
 *
 * @param {any} demo
 */
function bodyFor(demo) {
  return [
    demo.lede,
    `Runs: ${demo.realPath}.`,
    `Inputs: ${demo.inputs.map((/** @type {any} */ i) => i.label).join(", ")}.`,
    `Shows: ${demo.outputs.join(", ")}.`,
    `Background reading: ${demo.homeArticle.title}.`,
  ].join(" ");
}

/**
 * @param {any} playgroundJson content/playground.json
 * @returns {Array<Record<string, any>>} one page input, in a list
 */
export function playgroundPages(playgroundJson) {
  const demos = playgroundJson.demos ?? [];
  if (demos.length === 0) {
    // Fail closed, for the reason projectsPages does: an empty roster would
    // index as a lone document record and lose every deep link, and naming the
    // cause here beats `recordsForPage` throwing on an empty section list.
    throw new Error(
      "content/playground.json declares no demos, so /playground would index " +
        "with no sections and every deep link would be lost.",
    );
  }

  return [
    {
      url: PLAYGROUND_URL,
      uid: "page:playground",
      title: PLAYGROUND_TITLE,
      description: PLAYGROUND_DESCRIPTION,
      intro: PLAYGROUND_INTRO,
      sections: demos.map((/** @type {any} */ demo) => ({
        anchor: demoAnchor(demo.slug),
        title: demo.title,
        body: bodyFor(demo),
      })),
    },
  ];
}
