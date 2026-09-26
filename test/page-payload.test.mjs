/* A bundle's URL is not a fetch: the page puts the URL on an attribute and only a gesture
 * fetches it, so counting it would charge every route for the search dialog. */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ENHANCE_ASSET_PREFIX,
  fontsIn,
  importsOf,
  reachableAssets,
  stylesheetsFor,
} from "../scripts/lib/page-payload.mjs";

const APP = "/app";

const tree = (/** @type {Record<string, string>} */ files) => (path) =>
  Object.hasOwn(files, path.split("\\").join("/")) ? files[path.split("\\").join("/")] : null;

test("an enhancement bundle's URL on an attribute does NOT count as a fetch", () => {
  const source = `
    import { ENHANCE_URLS } from "~/components/enhance";
    export function Trigger() {
      return <a data-palette={ENHANCE_URLS.palette} />;
    }
  `;
  const { assets } = importsOf(source, "/app/components/bar-search-submit.tsx", APP);
  assert.deepEqual(assets, [], "the URL is carried, not fetched");
});

test("<Enhance module> counts its bundle, and the registry's imports count nothing", () => {
  const page = `
    import { Enhance } from "~/components/enhance";
    export function Post() { return <Enhance module="blog" />; }
  `;
  assert.deepEqual(importsOf(page, "/app/routes/post.tsx", APP).assets, [
    `${ENHANCE_ASSET_PREFIX}blog.js`,
  ]);

  const registry = `
    import { ENHANCE_URLS } from "virtual:enhance";
    export { ENHANCE_URLS };
  `;
  assert.deepEqual(
    importsOf(registry, "/app/components/enhance.tsx", APP).assets,
    [],
    "counting the registry would charge every page for every bundle",
  );
});

test("an <Enhance> named in a comment serves nothing", () => {
  const source = `
    // Renders <Enhance module="plate" /> where the plate is.
    /* The one way in: <Enhance module="blog" />. */
    export const X = () => <div>{/* No <Enhance module="podcast" /> here */}</div>;
  `;
  assert.deepEqual(importsOf(source, "/app/components/x.tsx", APP).assets, []);
});

test("a non-bundle ?url asset is collected either way", () => {
  // A font or a stylesheet handed to something at runtime is not an enhancement
  // bundle, and the callers filter by what they are asking about.
  const source = `import fontUrl from "./fonts/inter-latin-normal.woff2?url";`;
  const { assets } = importsOf(source, "/app/root.tsx", APP);
  assert.deepEqual(assets, ["./fonts/inter-latin-normal.woff2"]);
});

test("the walk follows ~/ and relative imports and is cycle-safe", () => {
  const read = tree({
    "/app/routes/post.tsx": `
      import { Body } from "~/components/body";
      import { Enhance } from "~/components/enhance";
      export default function Post() { return <Enhance module="blog" />; }
    `,
    "/app/components/body.tsx": `
      import { Loop } from "./loop";
      export const Body = () => null;
    `,
    // Imports its own importer. A walk without a seen-set never returns.
    "/app/components/loop.tsx": `import { Body } from "./body"; export const Loop = () => null;`,
  });

  const { assets, visited } = reachableAssets("/app/routes/post.tsx", APP, read);
  assert.deepEqual([...assets], [`${ENHANCE_ASSET_PREFIX}blog.js`]);
  assert.equal(visited.size, 3, "every module in the graph is expanded exactly once");
});

test("an unresolvable specifier is skipped rather than thrown on", () => {
  // The walk has no view of node_modules, virtual modules or the alias table,
  // and a gate that threw on the first bare specifier would grade nothing.
  const read = tree({
    "/app/routes/x.tsx": `
      import { createRequestHandler } from "react-router";
      import build from "virtual:react-router/server-build";
      import { Missing } from "./does-not-exist";
    `,
  });
  const { assets } = reachableAssets("/app/routes/x.tsx", APP, read);
  assert.deepEqual([...assets], []);
});

test("an entry that resolves to no file throws instead of walking an empty graph", () => {
  // A misnamed route file would otherwise read as a page that carries no bundles at all.
  const read = tree({ "/app/routes/x.tsx": "export default () => null;" });
  assert.throws(() => reachableAssets("/app/routes/y.tsx", APP, read), /resolves to no file/);
});

test("stylesheets are root's then the route's, deduplicated", () => {
  const manifest = {
    routes: {
      root: { css: ["/assets/root-a.css"] },
      "routes/blog._index": { css: ["/assets/root-a.css", "/assets/blog-b.css"] },
    },
  };
  assert.deepEqual(stylesheetsFor(manifest, "routes/blog._index"), [
    "/assets/root-a.css",
    "/assets/blog-b.css",
  ]);
});

test("a route id the manifest does not list throws instead of grading root's sheets alone", () => {
  // A misspelled ceiling id would otherwise carry only root's CSS, which is always under the bar.
  const manifest = { routes: { root: { css: ["/assets/root-a.css"] } } };
  assert.throws(() => stylesheetsFor(manifest, "routes/nope"), /no route routes\/nope/);
  assert.throws(() => stylesheetsFor({ routes: {} }, "root"), /no root route/);
});

test("a listed route with no css of its own gets root's sheets", () => {
  const manifest = { routes: { root: { css: ["/assets/root-a.css"] }, "routes/x": {} } };
  assert.deepEqual(stylesheetsFor(manifest, "routes/x"), ["/assets/root-a.css"]);
});

test("fonts come from @font-face only, not from every url()", () => {
  /* A @font-face src is fetched whenever the family is used (every page here); another url()
   * only when something matches it. Counting both would demand a preload for decoration. */
  const css = [
    `@font-face{font-family:Inter;src:url(/assets/inter-normal-AAAAAAAA.woff2)format("woff2")}`,
    `.hero{background-image:url(/assets/texture-BBBBBBBB.png)}`,
    `@font-face{font-family:Inter;font-style:italic;src:url("/assets/inter-italic-CCCCCCCC.woff2")}`,
  ];
  assert.deepEqual(fontsIn(css), [
    "/assets/inter-normal-AAAAAAAA.woff2",
    "/assets/inter-italic-CCCCCCCC.woff2",
  ]);
});
