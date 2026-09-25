import type { ServerBuild } from "react-router";

import {
  NO_STORE_CACHE_CONTROL,
  SHARED_CACHE_CONTROL,
  HTML_VARY_ACCEPT,
  cacheTags,
} from "~/lib/seo";

/**
 * Stands in for the vite-built server build, so tests need no app build first and cannot
 * read a stale one. Every route is a resource route, so nothing here renders markup.
 */

export const STUB_PATHS = {
  page: "/stub-page",
  negotiated: "/stub-negotiated",
  silent: "/stub-silent",
} as const;

export const STUB_PAGE_BODY = "stub page body";

export const STUB_MARKDOWN_BODY = "# stub markdown\n";

/** Written out because react-router does not export the `ServerRoute` type. */
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
      /* The shipped regression's shape: one url, two representations, `Vary: Accept, Cookie`,
       * and a `private, no-store` markdown copy. One representation could not fail that way. */
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
};

const build = {
  entry: {
    module: {
      /* Throws: every route is a resource route, so a document render means an unintended
       * match, and a plausible answer would make a green test about an invented page. */
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
/* `createRequestHandler` takes the module namespace, not its default, so the fields are
 * reachable both ways. */
export const { entry, assets, basename, publicPath, assetsBuildDirectory, ssr, isSpaMode, prerender, routeDiscovery } = build;
/* `future` is annotated rather than destructured with the rest: its inferred
 * type names a path inside react-router's dist, which tsc refuses to emit as
 * non-portable. The value is the empty object the real build ships. */
export const future: Record<string, never> = build.future;
export { routes };
