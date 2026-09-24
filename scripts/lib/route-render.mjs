/**
 * Server-only imports are stubbed at resolve time, so this proves things about components and
 * nothing about loaders, actions, or anything server-side.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export const URL_ASSET = "asset-url-stubbed-by-route-render";

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
      b.onResolve({ filter: /^~\/(db|lib\/context|lib\/auth)/ }, (args) => ({
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

  await build({
    entryPoints: entries.map((entry) => join(root, entry)),
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

  return {
    outDir,
    files: entries.map((entry) => {
      const base = entry.split("/").pop() ?? entry;
      return join(outDir, base.replace(/\.tsx?$/, ".js"));
    }),
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

/**
 * Fields whose VALUE the UI decides, so the value is part of the contract. Everything else in the
 * payload is the author's content, and recording it would make the fixture a copy of the test data.
 */
const CONTRACT_VALUES = new Set(["draft", "isNew", "headSha", "firstPublished"]);

/**
 * @param {string} html
 * @returns {Array<{ action: string, method: string, intent: string, fields: string[] }>}
 */
export function submissions(html) {
  /** @type {Array<{ action: string, method: string, intent: string, fields: string[] }>} */
  const out = [];

  // Ownership is by the `form` attribute first and containment second, as a browser resolves it:
  // the editor has a control outside the form it submits.
  /** @type {Array<{ id: string, start: number, end: number, open: string }>} */
  const forms = [];
  for (const match of html.matchAll(/<form\b[^>]*>/g)) {
    const start = match.index ?? 0;
    const end = html.indexOf("</form>", start);
    forms.push({
      id: /\sid="([^"]*)"/.exec(match[0])?.[1] ?? "",
      start,
      end: end === -1 ? html.length : end,
      open: match[0],
    });
  }

  /**
   * @param {number} at
   * @param {string | undefined} formAttr
   * @returns {number}
   */
  const ownerOf = (at, formAttr) => {
    if (formAttr) return forms.findIndex((f) => f.id === formAttr);
    return forms.findIndex((f) => at > f.start && at < f.end);
  };

  for (let i = 0; i < forms.length; i += 1) {
    const form = forms[i];
    const action = /action="([^"]*)"/.exec(form.open)?.[1] ?? "";
    const method = (/method="([^"]*)"/.exec(form.open)?.[1] ?? "get").toUpperCase();

    /** @type {string[]} */
    const fields = [];
    for (const match of html.matchAll(/<(?:input|textarea|select)\b[^>]*>/g)) {
      const tag = match[0];
      if (ownerOf(match.index ?? 0, /\sform="([^"]*)"/.exec(tag)?.[1]) !== i) continue;
      // A disabled control submits nothing: the editor relies on it for "absent when unticked".
      if (/\bdisabled\b/.test(tag)) continue;
      const name = /\sname="([^"]*)"/.exec(tag)?.[1];
      if (!name) continue;

      const type = /\stype="([^"]*)"/.exec(tag)?.[1] ?? "text";
      if ((type === "checkbox" || type === "radio") && !/\bchecked\b/.test(tag)) continue;

      // A checkbox with no `value` submits "on" per the spec, and React renders no value attribute.
      const explicit = /\svalue="([^"]*)"/.exec(tag)?.[1];
      const entry = CONTRACT_VALUES.has(name)
        ? `${name}=${explicit ?? (type === "checkbox" || type === "radio" ? "on" : "")}`
        : name;
      if (!fields.includes(entry)) fields.push(entry);
    }
    fields.sort();

    /** @type {string[]} */
    const intents = [];
    for (const match of html.matchAll(/<button\b[^>]*>/g)) {
      const button = match[0];
      if (ownerOf(match.index ?? 0, /\sform="([^"]*)"/.exec(button)?.[1]) !== i) continue;
      if (/\bdisabled\b/.test(button)) continue;
      if (!/type="submit"/.test(button)) continue;
      const name = /\sname="([^"]*)"/.exec(button)?.[1];
      const value = /\svalue="([^"]*)"/.exec(button)?.[1] ?? "";
      intents.push(name ? `${name}=${value}` : "(none)");
    }
    if (intents.length === 0) intents.push("(none)");

    for (const intent of intents) out.push({ action, method, intent, fields });
  }

  return out;
}

/**
 * @param {string} html
 * @returns {string[]}
 */
export function submissionKeys(html) {
  // Distinct: counting duplicate controls would make the gate object to layout.
  return [
    ...new Set(
      submissions(html).map(
        (s) => `${s.method} ${s.action} | ${s.intent} | ${s.fields.join(",")}`,
      ),
    ),
  ].sort();
}
