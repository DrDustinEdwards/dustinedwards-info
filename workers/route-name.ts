import { matchRoutes, type RouteObject, type ServerBuild } from "react-router";

// The route pattern a request's path matches (`/writing/:slug`, `*` for a missing page), for the `route` field of the
// request log line (site-runtime withRequestLog). Read off the server build's own route manifest, so it can never name
// a route the app does not have. The build loads on the first request that renders; until then, and for a path that
// matches nothing, there is no name and the line goes without one.

let tree: RouteObject[] | undefined;

/** Builds the nested route list from the build's flat manifest, once. */
export function learnRoutes(build: Pick<ServerBuild, "routes">): void {
  if (tree) return;
  const routes = Object.values(build.routes).filter((r) => r !== undefined);
  const node = (id: string | undefined): RouteObject[] =>
    routes
      .filter((r) => r.parentId === id)
      .map((r): RouteObject =>
        r.index ? { index: true, path: r.path } : { path: r.path, caseSensitive: r.caseSensitive, children: node(r.id) },
      );
  tree = node(undefined);
}

/** "/writing/:slug" for /writing/some-post; undefined before the build has loaded. */
export function routeName(request: Request): string | undefined {
  if (!tree) return undefined;
  const matches = matchRoutes(tree, new URL(request.url).pathname);
  if (!matches) return undefined;
  const parts = matches.map((m) => m.route.path).filter((p): p is string => Boolean(p));
  return `/${parts.join("/")}`.replace(/\/{2,}/g, "/").replace(/^\/\*$/, "*");
}
