// The playground: every demo on /playground runs the module it describes, over the manifest's
// presets, and the page's records match the manifest.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { demoAnchor } from "../../../../app/lib/playground-page.mjs";
import { assertFloor } from "../../floor.mjs";
import { codeOf, pageRecordParity, root } from "../shared.mjs";
import { checkCharts } from "./charts.mjs";
import { checkContrastSearch } from "./contrast-search.mjs";
import { checkManifest } from "./manifest.mjs";
import { checkMarkdown } from "./markdown.mjs";
import { checkMediaKey } from "./media-key.mjs";
import { checkTheme } from "./theme.mjs";

const PLAYGROUND_PATH = join(root, "content", "playground.json");
const PLAYGROUND_ROUTE_PATH = join(root, "app", "routes", "playground.tsx");

/**
 * @typedef {import("../shared.mjs").FeaturesContext & {
 *   demos: any[],
 *   deferredDemos: any[],
 *   swatches: any[],
 *   datasets: Record<string, any>,
 *   keyPresets: any[],
 *   cookiePresets: any[],
 *   snippets: any[],
 *   playgroundSource: string,
 *   statesInputCap: (demo: string, statement: RegExp) => void,
 * }} PlaygroundContext
 */

/** @param {import("../shared.mjs").FeaturesContext} ctx */
export async function checkPlayground(ctx) {
  const { ok, tally } = ctx;

  console.log("\n  playground");

  const playgroundDoc = JSON.parse(readFileSync(PLAYGROUND_PATH, "utf8"));
  const demos = playgroundDoc.demos ?? [];
  const deferredDemos = playgroundDoc.deferred ?? [];
  const swatches = playgroundDoc.swatches ?? [];
  const datasets = playgroundDoc.datasets ?? {};
  const keyPresets = playgroundDoc.keyPresets ?? [];
  const cookiePresets = playgroundDoc.cookiePresets ?? [];
  const snippets = playgroundDoc.markdownSnippets ?? [];
  const playgroundChecksBefore = tally.checks;

  const playgroundSource = codeOf(PLAYGROUND_ROUTE_PATH);

  /**
   * @param {string} demo the label prefix naming the demo, or empty for the page's own
   * @param {RegExp} statement
   */
  const statesInputCap = (demo, statement) =>
    ok(
      `${demo}the page states the input cap it enforces`,
      statement.test(playgroundSource),
      "a cap enforced in the loader and unstated in the UI is a silent truncation",
    );

  /** @type {PlaygroundContext} */
  const p = {
    ...ctx,
    demos,
    deferredDemos,
    swatches,
    datasets,
    keyPresets,
    cookiePresets,
    snippets,
    playgroundSource,
    statesInputCap,
  };
  checkManifest(p);
  checkContrastSearch(p);
  checkMediaKey(p);
  checkTheme(p);
  await checkMarkdown(p);
  checkCharts(p);

  ok(
    "the lab names WCAG 2.2 as the conformance target",
    /WCAG 2\.2/.test(playgroundSource),
    "the ratio is the conformance number and the page must say which standard it is",
  );
  ok(
    "the lab labels APCA as not part of any standard",
    /not part of any standard/.test(playgroundSource),
    "Lc is advisory and the page must not imply otherwise",
  );
  /* Never restore a ban on the string "WCAG 3": it refused a true sentence (WCAG 3.0 is the working
     draft APCA is developed in), and WCAG 2.2 is already required above as the target. */
  /* Through the constant only: a literal "100" would pass on stale text once the cap moved. */
  statesInputCap("", /up to \{QUERY_CAP\} characters/i);
  ok(
    "the route sets an explicit Cache-Control",
    /publicHtmlHeaders|SHARED_CACHE_CONTROL/.test(playgroundSource) &&
      /export function headers/.test(playgroundSource),
    "the cache-header rule: with the Workers cache on, no header means CACHED rather than skipped",
  );
  // A result that depended on anything but the query string would stop being a shareable URL.
  ok(
    "the page renders no wall-clock timing",
    !/tookMs/.test(playgroundSource),
    "a timing readout is the one value that differs between two fetches of one URL",
  );

  const playgroundRecords = pageRecordParity(
    ctx,
    "page:playground",
    { kind: "playground", page: "playground", item: "demo", list: "manifest" },
    demos.map((/** @type {any} */ d) => ({ slug: d.slug, anchor: demoAnchor(d.slug) })),
  );

  /* Measured by running the section, never by summing. */
  const playgroundChecks = tally.checks - playgroundChecksBefore;
  const MINIMUM_PLAYGROUND_CHECKS = 294;
  const playgroundFloorBreach = assertFloor(
    "check:features",
    "playground-checks",
    playgroundChecks,
    MINIMUM_PLAYGROUND_CHECKS,
    "This count steps sharply per demo: it was 278 before the markdown demo, 226 " +
      "before the theme demo and 142 before the key demo.",
  );
  if (playgroundFloorBreach) {
    ok("the playground section executed its assertions", false, playgroundFloorBreach);
  }

  console.log(
    `  ${demos.length} demo(s), ${Object.keys(datasets).length} dataset(s), ` +
      `${swatches.length} swatch(es), ${keyPresets.length} key preset(s), ` +
      `${cookiePresets.length} cookie preset(s), ${snippets.length} snippet(s), ` +
      `${deferredDemos.length} deferred, ` +
      `${playgroundRecords.length} artifact record(s), ${playgroundChecks} assertion(s)`,
  );
}
