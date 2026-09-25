/**
 * Server-only imports are stubbed at resolve time, so this proves things about components and
 * nothing about loaders, actions, or anything server-side.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const URL_ASSET = "asset-url-stubbed-by-route-render";

/**
 * @param {string} spec
 * @returns {string}
 */
function resolveAppPath(spec) {
  const base = join(root, "app", spec.slice(2)).replace(/\\/g, "/");
  for (const ext of [".tsx", ".ts", ".mjs", ".js", "/index.tsx", "/index.ts"]) {
    if (existsSync(base + ext)) return base + ext;
  }
  return base;
}

/**
 * The stub is a CJS Proxy rather than an ES module, which would have to declare every named export
 * the importers ask for; interop gives every name back as a no-op.
 *
 * @param {string[]} entries
 * @returns {Promise<{ outDir: string, files: string[], cleanup: () => Promise<void> }>}
 */
export async function bundleRoutes(entries) {
  const { build } = await import("esbuild");
  // Inside the repo, not the OS temp dir: the external bare specifiers only resolve if Node can
  // walk up into this repo's node_modules.
  const cacheRoot = join(root, "node_modules", ".cache");
  await mkdir(cacheRoot, { recursive: true });
  const outDir = await mkdtemp(join(cacheRoot, "admin-ui-render-"));

  /** @type {import("esbuild").Plugin} */
  const stubServer = {
    name: "stub-server-only",
    setup(b) {
      // Bounded and named, so a new `~/lib/authoring` or `~/dbx` is not stubbed by accident. The two
      // auth-* modules were stubbed by the old unbounded prefix and still are, by name.
      b.onResolve({ filter: /^~\/(db|lib\/context|lib\/auth|lib\/auth-client|lib\/auth-rate)(?:[/.]|$)/ }, (args) => ({
        path: args.path,
        namespace: "stub",
      }));
      b.onResolve({ filter: /\.server(\.[tj]s)?$/ }, (args) => ({
        path: args.path,
        namespace: "stub",
      }));
      // Route types are erased by the transform, but the specifier survives long enough to need resolving.
      b.onResolve({ filter: /\+types\// }, (args) => ({ path: args.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: "module.exports = new Proxy({}, { get: () => () => {} });",
        loader: "js",
      }));
      // esbuild reads Vite's `?url` as part of the filename, and several targets do not exist before
      // the enhancement build, so it resolves to a sentinel: no gate here may assert on an enhancement URL.
      b.onResolve({ filter: /\?url$/ }, (args) => ({ path: args.path, namespace: "urlasset" }));
      b.onLoad({ filter: /.*/, namespace: "urlasset" }, () => ({
        contents: `module.exports = ${JSON.stringify(URL_ASSET)};`,
        loader: "js",
      }));
      b.onResolve({ filter: /^~\// }, (args) => ({ path: resolveAppPath(args.path) }));
    },
  };

  /** @type {import("esbuild").BuildResult<{ metafile: true }>} */
  let result;
  try {
    result = await build({
      entryPoints: entries.map((entry) => join(root, entry)),
      // The output for each entry is read back from here: esbuild keeps entries' relative directories
      // under outdir, so a path built from the entry's basename named a file that was not there.
      metafile: true,
      bundle: true,
      platform: "node",
      format: "esm",
      outdir: outDir,
      // Same instances as the harness, or the stub router's context never reaches the components.
      external: ["react", "react/jsx-runtime", "react-dom", "react-dom/server", "react-router"],
      jsx: "automatic",
      plugins: [stubServer],
      logLevel: "silent",
      // gray-matter calls require("fs") lazily, and esbuild's __require shim throws for it unless a
      // real `require` is in scope.
      banner: {
        js: "import { createRequire as __nodeCreateRequire } from 'node:module';\nconst require = __nodeCreateRequire(import.meta.url);",
      },
    });
  } catch (error) {
    // The directory is inside the repo's cache, so a failed build must not leave it behind; the error
    // still goes to the caller.
    await rm(outDir, { recursive: true, force: true });
    throw error;
  }

  /** @type {Map<string, string>} entry, repo-relative with forward slashes -> absolute output */
  const byEntry = new Map();
  for (const [out, meta] of Object.entries(result.metafile.outputs)) {
    if (!meta.entryPoint) continue;
    const entry = relative(root, resolve(process.cwd(), meta.entryPoint)).replaceAll("\\", "/");
    byEntry.set(entry, resolve(process.cwd(), out));
  }
  const files = entries.map((entry) => {
    const file = byEntry.get(entry.replaceAll("\\", "/"));
    if (!file) throw new Error(`esbuild produced no output for ${entry}`);
    return file;
  });

  return {
    outDir,
    files,
    cleanup: () => rm(outDir, { recursive: true, force: true }),
  };
}

/**
 * @param {{ default: unknown }} mod
 * @param {{ path: string, url: string, loaderData: unknown, actionData?: unknown, params?: Record<string, string>, props?: Record<string, unknown> }} options
 * @returns {Promise<string>}
 */
export async function renderRoute(mod, options) {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { createRoutesStub } = await import("react-router");

  const Component = /** @type {any} */ (mod.default);
  const Stub = createRoutesStub([
    {
      path: options.path,
      Component: () =>
        createElement(Component, {
          loaderData: options.loaderData,
          actionData: options.actionData,
          params: options.params ?? {},
          matches: [],
          // Spread last to seed a route's own `useState`: one static pass dispatches no event, so UI
          // behind client state would otherwise be invisible.
          ...options.props,
        }),
    },
  ]);

  return renderToStaticMarkup(
    createElement(/** @type {any} */ (Stub), { initialEntries: [options.url] }),
  );
}

/** @param {string} file @returns {Promise<{ default: unknown }>} */
export async function importBundled(file) {
  return /** @type {Promise<{ default: unknown }>} */ (
    import(pathToFileURL(file).href)
  );
}
