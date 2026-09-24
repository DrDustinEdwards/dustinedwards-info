import type { ServerBuild } from "react-router";

import {
  NO_STORE_CACHE_CONTROL,
  SHARED_CACHE_CONTROL,
  HTML_VARY_ACCEPT,
  cacheTags,
} from "~/lib/seo";

/**
 * A hand-written React Router server build, standing in for the one the vite
 * plugin generates.
 *
 * ## WHY A STUB AND NOT THE REAL BUILD
 *
 * `virtual:react-router/server-build` is a BUILD artifact. Resolving it in a
 * test would mean running the app build first, which would put a several-second
 * build in front of every test run and would make the tests measure whatever
 * the last build left on disk, which is the staleness class `check:page-payload`
 * already has to live with.
 *
 * The SUBJECT of the cases that reach for this is `workers/app.ts`: the cache
 * key the gateway builds, the negotiation bypass, the security header stamp and
 * the cache-header rule's uncached default. None of that is about which routes exist. So
 * the route table is the part that gets replaced, and the transport around it is
 * real.
 *
 * THE THEMED-CACHE SUBJECTS ARE GONE, 2026-09-05, with the layer: there is no
 * store-then-downgrade order left to assert and no hand-built key to separate.
 *
 * ## RESOURCE ROUTES ONLY, WHICH IS WHAT KEEPS THIS SMALL
 *
 * A route with no `default` export is a resource route: React Router hands back
 * whatever `Response` its loader returned, with no rendering and no React. That
 * is the same shape `api.health.ts`, `blog.$slug[.md].ts` and `theme.ts` really
 * have, so nothing here is pretending to be a kind of route this site does not
 * serve.
 *
 * What it means for coverage, stated rather than implied: these routes carry
 * the DECLARATIONS a real public HTML route carries (`SHARED_CACHE_CONTROL`
 * with `Vary: Cookie`, the negotiated pair with `Vary: Accept, Cookie`), and
 * the headers are imported from `app/lib/seo.ts` rather than written out, so a
 * change to what a public route declares moves these fixtures with it. What
 * they do not carry is a rendered document. Nothing here asserts about markup.
 */

/** The paths the stub serves, named so a test reads as a sentence. */
export const STUB_PATHS = {
  /** A public HTML route: shared cache-control, `Vary: Cookie`. */
  page: "/stub-page",
  /** The negotiated pair: HTML or markdown at ONE url, `Vary: Accept, Cookie`. */
  negotiated: "/stub-negotiated",
  /** Declares nothing, so the cache-header rule's default in `workers/app.ts` decides. */
  silent: "/stub-silent",
  /** Sets a cookie while declaring the shared string. Must never be stored. */
  cookieSetter: "/stub-cookie-setter",
} as const;

/** The body a themed document carries, so a test can tell one theme's copy from another's. */
export const STUB_PAGE_BODY = "stub page body";

/** What the negotiated route answers when the client asked for markdown. */
export const STUB_MARKDOWN_BODY = "# stub markdown\n";

/**
 * The route module shape a resource route needs. `Omit<ServerRoute,"children">`
 * in the real manifest; written out here because the exported type is not.
 */
type StubRoute = {
  id: string;
  parentId?: string;
  path?: string;
  index?: boolean;
  caseSensitive?: boolean;
  module: {
    loader?: (args: { request: Request }) => Response | Promise<Response>;
    action?: (args: { request: Request }) => Response | Promise<Response>;
  };
};

const routes: Record<string, StubRoute> = {
  root: {
    id: "root",
    path: "",
    module: {},
  },
  page: {
    id: "page",
    parentId: "root",
    path: STUB_PATHS.page.slice(1),
    module: {
      loader: () =>
        new Response(STUB_PAGE_BODY, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": SHARED_CACHE_CONTROL,
            "cache-tag": cacheTags(),
          },
        }),
    },
  },
  negotiated: {
    id: "negotiated",
    parentId: "root",
    path: STUB_PATHS.negotiated.slice(1),
    module: {
      /*
       * THE SHAPE OF THE SHIPPED REGRESSION, reproduced exactly: one url, two
       * representations, `Vary: Accept, Cookie`, and the markdown copy declaring
       * `private, no-store` so it is never the second stored variant. That is
       * `/blog/:slug` and `markdownResponse` between them. A test that drove a
       * route with only one representation could not fail the way production
       * failed.
       */
      loader: ({ request }) => {
        const accept = request.headers.get("accept") ?? "";
        if (accept.toLowerCase().includes("text/markdown")) {
          return new Response(STUB_MARKDOWN_BODY, {
            headers: {
              "content-type": "text/markdown; charset=utf-8",
              "cache-control": NO_STORE_CACHE_CONTROL,
              vary: "Accept",
            },
          });
        }
        return new Response(STUB_PAGE_BODY, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": SHARED_CACHE_CONTROL,
            "cache-tag": cacheTags(),
            vary: HTML_VARY_ACCEPT,
          },
        });
      },
    },
  },
  silent: {
    id: "silent",
    parentId: "root",
    path: STUB_PATHS.silent.slice(1),
    module: {
      loader: () => new Response("silent", { headers: { "content-type": "text/html" } }),
    },
  },
  cookieSetter: {
    id: "cookieSetter",
    parentId: "root",
    path: STUB_PATHS.cookieSetter.slice(1),
    module: {
      loader: () =>
        new Response(STUB_PAGE_BODY, {
          headers: {
            "content-type": "text/html; charset=utf-8",
            "cache-control": SHARED_CACHE_CONTROL,
            "cache-tag": cacheTags(),
            "set-cookie": "planted=1; Path=/",
          },
        }),
    },
  },
};

const build = {
  entry: {
    module: {
      /*
       * UNREACHABLE, and it throws rather than returning something plausible.
       * Every route above is a resource route, so a document render means the
       * stub was matched in a way nobody intended and the test below it would
       * be asserting against an invented page. Failing loudly is the honest
       * answer; the alternative is a green test about a document that does not
       * exist.
       */
      default() {
        throw new Error(
          "the stub server build has no document renderer. Every stub route is a " +
            "resource route; a document request means the test matched a route it did not mean to.",
        );
      },
    },
  },
  routes,
  assets: {
    entry: { imports: [], module: "/stub-entry.js" },
    routes: {},
    url: "/stub-manifest.js",
    version: "stub",
  },
  basename: "/",
  publicPath: "/",
  assetsBuildDirectory: "build/client",
  future: {},
  ssr: true,
  isSpaMode: false,
  prerender: [],
  routeDiscovery: { mode: "initial", manifestPath: "/__manifest" },
} as unknown as ServerBuild;

export default build;
/*
 * Re-exported as named bindings too. `createRequestHandler` takes the module
 * namespace, not its default, so the fields have to be reachable both ways
 * depending on how the interop lands.
 */
export const { entry, assets, basename, publicPath, assetsBuildDirectory, ssr, isSpaMode, prerender, routeDiscovery } = build;
/* `future` is annotated rather than destructured with the rest: its inferred
 * type names a path inside react-router's dist, which tsc refuses to emit as
 * non-portable. The value is the empty object the real build ships. */
export const future: Record<string, never> = build.future;
export { routes };
