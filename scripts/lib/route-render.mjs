/**
 * Renders admin route components to static HTML in Node, so a gate can read the
 * markup they actually produce.
 *
 * Why this exists: /admin sits behind a real Google session, so no gate can
 * reach those pages over HTTP, and the one property that matters most about the
 * admin redesign is invisible to a typecheck. A route may move a control
 * anywhere it likes, but it may not change WHAT PRESSING IT SENDS. That is a
 * fact about rendered markup, so the only honest way to assert it is to render.
 *
 * The route modules import server-only code (`~/db`, `~/lib/*.server`) at the
 * top level for their loaders and actions. None of it runs during a render, so
 * it is stubbed at resolve time rather than executed. That is a deliberate
 * limit worth stating: this harness proves things about COMPONENTS, and proves
 * nothing about loaders, actions, or anything server-side.
 */

import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

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
 * Bundles route modules for Node with their server-only imports stubbed.
 *
 * The stub is a CJS Proxy rather than an ES module, because an ES stub has to
 * declare every named export the importer asks for and the importers ask for
 * dozens. Interop gives every name back as a no-op function, which is enough:
 * nothing here is called.
 *
 * @param {string[]} entries repo-relative module paths
 * @returns {Promise<{ outDir: string, files: string[], cleanup: () => Promise<void> }>}
 */
export async function bundleRoutes(entries) {
  const { build } = await import("esbuild");
  // Inside the repo, NOT the OS temp directory. react and react-router stay
  // external so the components share the harness's instances, and a bare
  // specifier only resolves if Node can walk up into this repo's node_modules.
  // From %TEMP% it cannot, and the import fails with ERR_MODULE_NOT_FOUND.
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
 * @param {{ default: unknown }} mod
 * @param {{ path: string, url: string, loaderData: unknown, actionData?: unknown, params?: Record<string, string> }} options
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
 * Every request the rendered page can submit, as a stable shape.
 *
 * A form's identity here is (action, method, intent, field names). That is
 * exactly the tuple the server reads: `handleEditorAction` dispatches on
 * `intent` and `fieldsFromForm` reads a fixed set of keys, so two markups with
 * the same tuple set send the same thing no matter how they are laid out.
 *
 * A DISABLED control submits nothing, and that is load bearing rather than a
 * detail: it is how the editor reproduces a checkbox's "absent when unticked"
 * without a checkbox. Disabled fields are excluded here for the same reason a
 * browser excludes them.
 *
 * @param {string} html
 * @returns {Array<{ action: string, method: string, intent: string, fields: string[] }>}
 */
export function submissions(html) {
  /** @type {Array<{ action: string, method: string, intent: string, fields: string[] }>} */
  const out = [];

  // Form ownership is by the `form` ATTRIBUTE first and containment second,
  // which is how a browser resolves it. Modelling only containment would be a
  // lie the moment a control sits outside the form it submits, and the editor
  // has exactly that case: the delete button lives at the foot of the settings
  // drawer, inside the editing form, and belongs to a different one. Forms
  // cannot nest, so a flat scan for their ranges is sufficient.
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
      // An UNCHECKED checkbox is not submitted either, and modelling that is
      // what makes `draft` honest: the checkbox era sent `draft=on` on a draft
      // and sent no `draft` key at all on a published post. A baseline that
      // listed the field unconditionally would have recorded a payload the
      // browser never sends, and then demanded the redesign reproduce it.
      if ((type === "checkbox" || type === "radio") && !/\bchecked\b/.test(tag)) continue;

      // Hidden and checkbox values are chosen by the UI rather than typed by
      // the author, so they are part of the contract and are recorded. Text
      // values are the author's content and are not.
      //
      // A checkbox with no `value` attribute submits the string "on" (HTML
      // spec, the "default/on" state). React renders `checked` and no value, so
      // reading the attribute literally would record an empty string and the
      // baseline would disagree with the browser. `fieldsFromForm` tests
      // `=== "on"`, so this is the difference between recording what is sent
      // and recording what is written.
      const explicit = /\svalue="([^"]*)"/.exec(tag)?.[1];
      const entry =
        type === "hidden" || type === "checkbox" || type === "radio"
          ? `${name}=${explicit ?? (type === "hidden" ? "" : "on")}`
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
  return submissions(html)
    .map((s) => `${s.method} ${s.action} | ${s.intent} | ${s.fields.join(",")}`)
    .sort();
}
