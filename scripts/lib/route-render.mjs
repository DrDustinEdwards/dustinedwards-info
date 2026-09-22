/**
 * Renders route components to static HTML in Node, so a gate can read the markup they produce.
 *
 * BOUNDARY: server-only imports are stubbed at resolve time rather than executed, so this proves
 * things about COMPONENTS and nothing about loaders, actions, or anything server-side.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * What a Vite `?url` import resolves to here. Exported so a gate can ASSERT on it rather than
 * meeting it as a surprising `src`, and deliberately not a plausible path.
 */
export const URL_ASSET = "asset-url-stubbed-by-route-render";

/**
 * Resolves a `~/...` import the way the Vite config does, then tries the
 * extensions the repo actually uses.
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
 * Bundles route modules for Node with their server-only imports stubbed. The stub is a CJS Proxy
 * rather than an ES module, which would have to declare every named export the importers ask for;
 * interop gives every name back as a no-op, which is enough, nothing here being called.
 *
 * @param {string[]} entries repo-relative module paths
 * @returns {Promise<{ outDir: string, files: string[], cleanup: () => Promise<void> }>}
 */
export async function bundleRoutes(entries) {
  const { build } = await import("esbuild");
  // Inside the repo, NOT the OS temp directory: react and react-router stay external so the
  // components share the harness's instances, and a bare specifier only resolves if Node can walk
  // up into this repo's node_modules.
  const cacheRoot = join(root, "node_modules", ".cache");
  await mkdir(cacheRoot, { recursive: true });
  const outDir = await mkdtemp(join(cacheRoot, "admin-ui-render-"));

  /** @type {import("esbuild").Plugin} */
  const stubServer = {
    name: "stub-server-only",
    setup(b) {
      // Server-only surfaces. A component that reached one of these at module
      // scope would be a bug in its own right; none does.
      b.onResolve({ filter: /^~\/(db|lib\/context|lib\/auth)/ }, (args) => ({
        path: args.path,
        namespace: "stub",
      }));
      b.onResolve({ filter: /\.server(\.[tj]s)?$/ }, (args) => ({
        path: args.path,
        namespace: "stub",
      }));
      // Generated route types are erased by the transform, but the import
      // specifier survives long enough to need resolving.
      b.onResolve({ filter: /\+types\// }, (args) => ({ path: args.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: "module.exports = new Proxy({}, { get: () => () => {} });",
        loader: "js",
      }));
      /*
       * VITE'S `?url` SUFFIX, which esbuild reads as part of the FILENAME and refuses. Stripping it
       * would not help, several of those files not existing until the enhancement build has run, and a
       * gate that only runs after a build does not run on a fresh checkout. So the suffix resolves to
       * the SENTINEL, and the cost is stated: NO GATE USING THIS HARNESS MAY ASSERT ANYTHING ABOUT AN
       * ENHANCEMENT URL. What survives is the script TAG and every attribute the component writes.
       */
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
    // react and react-router must be the SAME instances the harness imports, or
    // the stub router's context never reaches the components inside it.
    external: ["react", "react/jsx-runtime", "react-dom", "react-dom/server", "react-router"],
    jsx: "automatic",
    plugins: [stubServer],
    logLevel: "silent",
    // gray-matter reaches this bundle through the frontmatter module and calls
    // require("fs") lazily. Bundled CJS-to-ESM leaves esbuild's __require shim,
    // which throws for anything it could not resolve statically, unless a real
    // `require` is in scope. This puts one there.
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
 * Renders one route component at one URL with fabricated loader and action data.
 *
 * `props` seeds a route's own client state. See the comment at the spread.
 *
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
          /*
           * DECLARED INITIAL CLIENT STATE, spread last so it can seed a route's own `useState`. The harness
           * renders ONE static pass and dispatches no event, so any UI behind client state is invisible, and
           * an admin mutation surface the gate cannot see is the class this exists to close. The route takes
           * an OPTIONAL prop with a production default, so shipped behavior is unchanged; seeding from
           * loader data would put a field in the server contract that no loader returns.
           */
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
 * Every request the rendered page can submit, as a stable shape: a form's identity is (action,
 * method, intent, field names), exactly the tuple the server reads. A DISABLED control submits
 * nothing, which is how the editor reproduces "absent when unticked" without a checkbox.
 *
 * @param {string} html
 * @returns {Array<{ action: string, method: string, intent: string, fields: string[] }>}
 */
export function submissions(html) {
  /** @type {Array<{ action: string, method: string, intent: string, fields: string[] }>} */
  const out = [];

  // Form ownership is by the `form` ATTRIBUTE first and containment second, which is how a browser
  // resolves it, and the editor has a control outside the form it submits. Forms cannot nest.
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
      // A disabled control submits nothing. That is load bearing rather than a
      // detail: it is how the editor reproduces a checkbox's "absent when
      // unticked" without a checkbox.
      if (/\bdisabled\b/.test(tag)) continue;
      const name = /\sname="([^"]*)"/.exec(tag)?.[1];
      if (!name) continue;

      const type = /\stype="([^"]*)"/.exec(tag)?.[1] ?? "text";
      // An UNCHECKED checkbox is not submitted either: the checkbox era sent the publish field on a
      // draft and no key at all on a published post, so an unconditional listing would record a payload
      // the browser never sends and demand the redesign reproduce it.
      if ((type === "checkbox" || type === "radio") && !/\bchecked\b/.test(tag)) continue;

      // For a few fields the VALUE is the contract; for the rest only the name is. THE SPLIT IS BY FIELD
      // NAME, NOT BY WIDGET TYPE: moving a field from a text input to a hidden one changes the widget
      // and nothing about the request. A checkbox with no `value` submits "on" per the spec and React
      // renders no value, so reading the attribute literally would record an empty string.
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
    // A form with no submit button of its own is still a submittable form.
    if (intents.length === 0) intents.push("(none)");

    for (const intent of intents) out.push({ action, method, intent, fields });
  }

  return out;
}

/** Stable, sorted, comparable text for one page's whole submission surface.
 * @param {string} html
 * @returns {string[]}
 */
export function submissionKeys(html) {
  // DISTINCT, deliberately: the contract is which requests a page can issue, not how many controls
  // offer each one, and counting duplicates would make the gate object to layout.
  return [
    ...new Set(
      submissions(html).map(
        (s) => `${s.method} ${s.action} | ${s.intent} | ${s.fields.join(",")}`,
      ),
    ),
  ].sort();
}
