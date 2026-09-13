/**
 * What a cold load of a route resolves to, and the two mistakes this resolver
 * made before it worked.
 *
 * `check:page-payload` grades bytes per public route, and everything it grades
 * depends on this resolution being right. The gate itself reads the disk, so it
 * can only be exercised against whatever the tree happens to contain; these are
 * the cases the tree does not currently produce, which is the half that goes
 * stale silently.
 *
 * ## THE TWO DEFECTS, both found by running the gate and reading its output
 *
 * 1. A `?url` IMPORT IS NOT A FETCH. `bar-search-submit.tsx` imports the palette
 *    bundle's URL to put on a data attribute; the page does not fetch it, a
 *    gesture does. Counting the import made every route look like it served a
 *    search dialog, which is the exact opposite of what the split achieved, and
 *    the gate failed eight routes for a defect that did not exist.
 *
 * 2. THE WALK MUST NOT INVENT NAMES. Not tested here because it is the gate's
 *    own code, but recorded beside its sibling: the font assertion derived a
 *    binding name from a filename, guessed `interLatinNormalUrl` against the
 *    real `interNormalUrl`, and failed a font that IS preloaded.
 *
 * @see scripts/lib/page-payload.mjs
 * @see scripts/check-page-payload.mjs
 */

import test from "node:test";
import assert from "node:assert/strict";

import { fontsIn, importsOf, reachableAssets, stylesheetsFor } from "../scripts/lib/page-payload.mjs";

const APP = "/app";

/** A tiny in-memory module tree, so the walk can be driven without a disk. */
const tree = (/** @type {Record<string, string>} */ files) => (path) =>
  Object.hasOwn(files, path.split("\\").join("/")) ? files[path.split("\\").join("/")] : null;

test("a ?url import of an enhancement bundle does NOT count as a fetch", () => {
  const source = `
    import paletteUrl from "~/enhance/dist/palette.js?url";
    export function Trigger() {
      return <a data-palette={paletteUrl} />;
    }
  `;
  const { assets } = importsOf(source, "/app/components/bar-search-submit.tsx", APP);
  assert.deepEqual(assets, [], "the URL is carried, not fetched");
});

test("the SAME import counts when the file renders the script tag", () => {
  const source = `
    import blogUrl from "~/enhance/dist/blog.js?url";
    import { EnhancementScript } from "~/components/enhancement-script";
    export function BlogEnhancements() {
      return <EnhancementScript src={blogUrl} />;
    }
  `;
  const { assets } = importsOf(source, "/app/components/blog-enhancements.tsx", APP);
  assert.deepEqual(assets, ["~/enhance/dist/blog.js"]);
});

test("a non-bundle ?url asset is collected either way", () => {
  // A font or a stylesheet handed to something at runtime is not gated by
  // EnhancementScript, and the callers filter by what they are asking about.
  const source = `import fontUrl from "./fonts/inter-latin-normal.woff2?url";`;
  const { assets } = importsOf(source, "/app/root.tsx", APP);
  assert.deepEqual(assets, ["./fonts/inter-latin-normal.woff2"]);
});

test("the walk follows ~/ and relative imports and is cycle-safe", () => {
  const read = tree({
    "/app/routes/post.tsx": `
      import { Body } from "~/components/body";
      import { EnhancementScript } from "~/components/enhancement-script";
      import blogUrl from "~/enhance/dist/blog.js?url";
      export default function Post() { return <EnhancementScript src={blogUrl} />; }
    `,
    "/app/components/body.tsx": `
      import { Loop } from "./loop";
      export const Body = () => null;
    `,
    // Imports its own importer. A walk without a seen-set never returns.
    "/app/components/loop.tsx": `import { Body } from "./body"; export const Loop = () => null;`,
  });

  const { assets, visited } = reachableAssets("/app/routes/post.tsx", APP, read);
  assert.deepEqual([...assets], ["~/enhance/dist/blog.js"]);
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

test("a route the manifest does not list still gets root's sheets", () => {
  const manifest = { routes: { root: { css: ["/assets/root-a.css"] } } };
  assert.deepEqual(stylesheetsFor(manifest, "routes/nope"), ["/assets/root-a.css"]);
});

test("fonts come from @font-face only, not from every url()", () => {
  /*
   * A url() elsewhere is a background or a mask and is fetched only if
   * something matches it; a @font-face src is fetched whenever the family is
   * used, which on this site is every page. Counting both would make the gate
   * demand a preload for decoration.
   */
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
