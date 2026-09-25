import type { ServerBuild } from "react-router";

/**
 * A server build around `entry` and `routes`, with the fixed fields the real build ships.
 * `assetRoutes` is the client manifest's route table, empty when nothing renders a document.
 *
 * Its own module, not part of `stub-server-build.ts`: the alias makes that file the target of
 * any `vi.mock("virtual:react-router/server-build")`, so a mock factory importing it would be
 * importing itself.
 */
export function stubServerBuild({
  entry,
  routes,
  assetRoutes = {},
}: {
  entry: { module: unknown };
  routes: Record<string, unknown>;
  assetRoutes?: Record<string, unknown>;
}): ServerBuild {
  return {
    entry,
    routes,
    assets: {
      entry: { imports: [], module: "/stub-entry.js" },
      routes: assetRoutes,
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
    /* Present though undefined: a vi.mock module throws on a read of a key it lacks. */
    unstable_getCriticalCss: undefined,
  } as unknown as ServerBuild;
}
