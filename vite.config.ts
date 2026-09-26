import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

import { enhancePlugin } from "./scripts/lib/enhance-bundle.mjs";

/**
 * A value that is DIFFERENT FOR EVERY BUILD, and its only job is to namespace
 * the Worker's own HTML cache.
 *
 * `workers/app.ts` keeps themed documents in `caches.default` under a key it
 * builds itself. The platform's automatic cache includes the Worker version in
 * its key, so a deploy invalidates it; a hand-built key includes only what is
 * put there, and this one did not include the build.
 *
 * MEASURED, and it is why this exists: a `check:browser` run served HTML from
 * a build several generations old, still inside its ten minute lifetime,
 * referencing `root-Dhhz26dV.css` when the build on disk had
 * `root-B62ve9c3.css`. Workers Assets serves the CURRENT manifest only, so
 * those URLs answer 404 and the page arrives unstyled. In production that is
 * every cookie-bearing reader for up to ten minutes after every deploy.
 *
 * A timestamp rather than a content hash, deliberately. The property required
 * is "differs between two builds", not "is derivable from the source", and
 * nothing in this repository byte-compares the server bundle: check:content
 * compares the corpus render, which this value cannot reach.
 */
const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    reactRouter(),
    // The enhancement bundles, built beside the app and emitted into its client assets.
    enhancePlugin(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    /*
     * **A WEBFONT IS NEVER INLINED, and this is a CSP refusal rather than a
     * preference.** The enhancement bundles never reach this rule: the plugin
     * above emits them as named assets, which no inline limit applies to.
     *
     * MEASURED 2026-09-06 on the first build after the math stylesheet landed:
     * `KaTeX_Size3-Regular.woff2` is 3,624 bytes, under the default 4096-byte
     * inline limit, and Vite inlined it as a base64 `data:` URI inside
     * the stylesheet. `font-src` is `'self'` and does NOT carry `data:` (only
     * `img-src` does), so the browser would have refused that one face while
     * fetching the other nineteen, and the symptom is a big delimiter rendered
     * in a fallback serif on some equations and not others. It also puts 4.8 kB
     * of base64 into a file every math page downloads, for a face most posts
     * never use.
     *
     * Matched on the EXTENSION rather than on the katex directory, because the
     * rule is about what a webfont is and not about where this one lives: the
     * next face dropped into `app/fonts/` inherits it. Everything else keeps
     * the default behavior.
     */
    assetsInlineLimit: (filePath) => {
      const path = filePath.split("\\").join("/");
      if (path.endsWith(".woff2")) return false;
      return undefined;
    },
  },
});
