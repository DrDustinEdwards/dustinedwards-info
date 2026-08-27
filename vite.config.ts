import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { defineConfig } from "vite";

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
 * nothing in this repository byte-compares the server bundle: check:charts
 * compares rendered SVG between node and workerd, and check:content compares
 * the corpus render, neither of which this value can reach.
 */
const BUILD_ID = Date.now().toString(36);

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    reactRouter(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  build: {
    /*
     * The enhancement bundles are ALWAYS emitted as real assets, never inlined.
     * Two of the four sit under the default 4096-byte inline limit, and an
     * inlined bundle becomes a data: URI in a <script src>, which works only
     * because the element carries a nonce, bloats every page it rides on, and
     * is invisible to check:page-payload's byte-equality pass against
     * app/enhance/dist/. Everything else keeps the default behaviour.
     */
    assetsInlineLimit: (filePath) =>
      filePath.split("\\").join("/").includes("app/enhance/dist/") ? false : undefined,
  },
});
