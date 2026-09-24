/*
 * Shared by the route and the search index so a record never points at a
 * fragment the page does not render. No clock, filesystem or git: records are pure.
 */

export const PLAYGROUND_URL = "/playground";

export const PLAYGROUND_TITLE = "Playground";

// Do not claim "no JavaScript": root.tsx renders <Scripts /> on every route.
export const PLAYGROUND_DESCRIPTION =
  "Interactive demos of this site's own machinery. Each one runs the same code " +
  "the site runs, server-side, and every result is a shareable URL.";

export const PLAYGROUND_INTRO =
  "Every demo here runs the real thing. The contrast lab computes with the " +
  "module the build gate computes with, the search demo runs the query through " +
  "the same path /search uses, and the chart is drawn by the pipeline that " +
  "draws the charts in the articles. A demo of a reimplementation would " +
  "demonstrate nothing, so there are no reimplementations. Every result is a " +
  "plain GET, rendered on the server, at a URL you can paste to someone.";

/**
 * @param {string} slug
 */
export function demoAnchor(slug) {
  return `demo-${slug}`;
}

/**
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
