// The playground manifest against the page: the rosters are non-empty, every demo is rendered and
// declared, the chart demo's enums match the renderer, and every demo cites a published article.

import { CHART_TYPES } from "../../../../app/lib/content/chart.mjs";
import { PLAYGROUND_URL } from "../../../../app/lib/playground-page.mjs";
import { assertFloor } from "../../floor.mjs";
import { pageReadsItsList } from "../shared.mjs";

/** @param {import("./index.mjs").PlaygroundContext} p */
export function checkManifest(p) {
  const {
    ok,
    routes,
    publishedTitles,
    demos,
    deferredDemos,
    swatches,
    datasets,
    keyPresets,
    cookiePresets,
    snippets,
    playgroundFiles,
    playgroundSource,
  } = p;

  // Fail closed: an empty list passes every loop.
  const MINIMUM_DEMOS = 3;
  const demosBreach = assertFloor(
    "check:features",
    "demos",
    demos.length,
    MINIMUM_DEMOS,
    "An empty roster makes every loop below pass by iterating nothing.",
  );
  ok("the demo roster is non-empty", demosBreach === null, demosBreach ?? "");
  ok("swatch presets are declared", swatches.length > 0, "an empty list checks nothing");
  ok(
    "chart datasets are declared",
    Object.keys(datasets).length > 0,
    "an empty map checks nothing",
  );
  ok(
    "key presets are declared",
    keyPresets.length > 0,
    "an empty list makes every behavioral key assertion below iterate nothing",
  );
  ok(
    "cookie presets are declared",
    cookiePresets.length > 0,
    "an empty list makes every behavioral theme assertion below iterate nothing",
  );
  ok(
    "markdown snippets are declared",
    snippets.length > 0,
    "an empty list makes every behavioral render assertion below iterate nothing",
  );
  ok(
    "deferred demos are stated rather than omitted",
    deferredDemos.length > 0,
    "a deferred demo is a stated absence; an empty list means the page claims completeness",
  );
  ok(
    `routes.ts declares ${PLAYGROUND_URL}`,
    routes.has(PLAYGROUND_URL),
    `parsed routes: ${[...routes].join(", ")}`,
  );
  ok(
    "the playground's demo modules were found",
    playgroundFiles.length >= 1 + 2 * demos.length,
    `read ${playgroundFiles.length} file(s) for ${demos.length} demo(s), each a loader module and a ` +
      `component: a check below would pass or fail on a file it never read`,
  );

  pageReadsItsList(ok, playgroundSource, {
    route: "playground.tsx",
    list: "manifest",
    json: "playground.json",
    reads: /import\s+playgroundData\s+from\s+["'][^"']*content\/playground\.json["']/,
    noun: "demo",
    anchorFn: "demoAnchor",
    anchorModule: /from\s+["']~\/lib\/playground-page\.mjs["']/,
  });
  ok(
    "the page takes its presets and fixtures from the manifest",
    /playgroundData\.swatches/.test(playgroundSource) &&
      /playgroundData\.datasets/.test(playgroundSource) &&
      /playgroundData\.keyPresets/.test(playgroundSource),
    "if the route restated them, the behavioral checks below would be checking a copy of the input",
  );
  /* Keyed by slug: a position index shifts headers while list checks stay green. */
  ok(
    "demo headers are keyed by slug rather than by list position",
    /<DemoHeader\s+slug=/.test(playgroundSource) && !/<DemoHeader\s+index=/.test(playgroundSource),
    "a positional header couples the page's order to the manifest's, and a demo " +
      "inserted in the middle silently retitles every section under it",
  );

  const renderedAnchors = new Set(
    [...playgroundSource.matchAll(/demoAnchor\(\s*["']([\w-]+)["']\s*\)/g)].map((m) => m[1]),
  );
  ok(
    "the page renders at least one demo section",
    renderedAnchors.size > 0,
    "no demoAnchor(...) literals found, so the reverse direction would pass vacuously",
  );
  for (const demo of demos) {
    ok(
      `${demo.slug} is rendered by the page`,
      renderedAnchors.has(demo.slug),
      `the manifest declares it and the page renders no demoAnchor("${demo.slug}")`,
    );
  }
  const manifestSlugs = new Set(demos.map((/** @type {any} */ d) => d.slug));
  for (const anchor of renderedAnchors) {
    ok(
      `page section ${anchor} is declared in the manifest`,
      manifestSlugs.has(anchor),
      "the page renders it and the manifest omits it, so it is unindexed",
    );
  }

  const chartDemo = demos.find((/** @type {any} */ d) => d.slug === "chart-options");
  ok("the chart demo is declared", Boolean(chartDemo), "the enum checks below need it");
  if (chartDemo) {
    const inputs = chartDemo.inputs ?? [];
    const markInput = inputs.find((/** @type {any} */ i) => i.name === "mark");
    const dataInput = inputs.find((/** @type {any} */ i) => i.name === "data");
    ok("the chart demo declares a mark input", Boolean(markInput));
    ok("the chart demo declares a dataset input", Boolean(dataInput));
    for (const value of markInput?.values ?? []) {
      ok(
        `manifest mark "${value}" is a real CHART_TYPE`,
        CHART_TYPES.includes(value),
        `the renderer accepts ${CHART_TYPES.join(", ")}`,
      );
    }
    for (const type of CHART_TYPES) {
      ok(
        `CHART_TYPE "${type}" is offered by the demo`,
        (markInput?.values ?? []).includes(type),
        "the renderer supports it and the manifest omits it",
      );
    }
    for (const value of dataInput?.values ?? []) {
      ok(
        `manifest dataset "${value}" is defined`,
        Object.hasOwn(datasets, value),
        "the enum offers it and no dataset defines it",
      );
    }
    for (const key of Object.keys(datasets)) {
      ok(
        `dataset "${key}" is reachable from the form`,
        (dataInput?.values ?? []).includes(key),
        "defined and not offered by the enum",
      );
    }
  }

  /* Demos cite published articles; a draft link is a missing page. */
  ok(
    "the artifact carries published posts",
    publishedTitles.size > 0,
    "otherwise the citation checks below pass vacuously",
  );
  for (const demo of demos) {
    ok(
      `${demo.slug} cites a published article`,
      publishedTitles.has(demo.homeArticle?.slug),
      `homeArticle ${JSON.stringify(demo.homeArticle?.slug)} is not a published post`,
    );
  }

}
