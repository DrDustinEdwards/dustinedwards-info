// Which scripts carry the nonce and which are trusted without one: the admin nonce reaches the server
// entry, and every public script is the hashed loader, the speculation block or JSON-LD.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ENHANCE_LOADER, ENHANCE_URL_PREFIX } from "../../../app/lib/enhance-loader.mjs";
import { enhanceFileName } from "../enhance-bundle.mjs";
import { stripComments } from "../strip-comments.mjs";
import { ok, root } from "./gate.mjs";

/** @param {string[]} parts */
const source = (...parts) => stripComments(readFileSync(join(root, ...parts), "utf8"));

export function run() {
  console.log("\n  the nonce reaches the admin scripts, and public scripts need none");

  const entryServer = source("app", "entry.server.tsx");

  /*
   * ServerRouter passes its nonce prop both into FrameworkContext and to StreamTransfer; without
   * it React Router's two streaming scripts ship bare on the admin plane, one carrying the payload.
   */
  ok(
    "entry.server.tsx passes a nonce to <ServerRouter>",
    /<ServerRouter[^>]*\snonce=\{/.test(entryServer),
    "without it StreamTransfer gets none and both streaming scripts ship bare, " +
      "so an enforcing CSP would stop the hydration payload on every admin page",
  );
  ok(
    "entry.server.tsx reads the nonce from the request context, not a literal",
    /getNonce\s*\(/.test(entryServer),
    "a literal or derived value here is a static nonce, which renders perfectly and protects nothing",
  );
  ok(
    "entry.server.tsx accepts the loadContext argument the nonce arrives on",
    /RouterContextProvider/.test(entryServer),
    "the fifth argument to handleRequest is the RouterContextProvider; without it there is nothing to read",
  );

  /* The nonce is minted for admin paths only: a public page is cached with its header. */
  const app = source("workers", "app.ts");
  ok(
    "workers/app.ts mints the nonce only on an admin path",
    /isAdminPath\(\s*url\.pathname\s*\)\s*\?\s*crypto\.randomUUID\(\)\s*:\s*undefined/.test(app) &&
      (app.match(/crypto\.randomUUID\(\)/g) ?? []).length === 1,
    "a nonce minted for a public render lands in an edge-cached header and body, so every " +
      "reader shares it for the cache lifetime",
  );

  /*
   * THE SPECULATION BLOCK, and there is exactly ONE: its rules vary by page, so it has no hash and
   * is admitted by 'inline-speculation-rules'. A nonce on it would be a public nonce.
   */
  const siteSpeculation = source("app", "components", "site-speculation.tsx");
  ok(
    "SiteSpeculation renders a speculationrules script with no nonce",
    /type="speculationrules"/.test(siteSpeculation) && !/nonce/.test(siteSpeculation),
    "a nonce on a public page is served to every reader of the cached copy; the block is " +
      "admitted by 'inline-speculation-rules' instead",
  );
  ok(
    "SiteHeader renders SiteSpeculation, which is what puts it on every public page",
    /<SiteSpeculation\s*\/>/.test(source("app", "components", "site-header.tsx")),
    "an imported-but-unrendered component is the shape that passes the assertion above " +
      "while shipping nothing to any reader",
  );

  /* THE MARKER AND THE LOADER: <Enhance> renders no script, and root runs the one hashed loader. */
  const enhance = source("app", "components", "enhance.tsx");
  ok(
    "<Enhance> renders an inert <template data-enhance> marker, not a script",
    /<template\s+data-enhance=\{/.test(enhance) && !/<script/.test(enhance),
    "a script tag here needs a nonce or a hash of its own, and Firefox and Safari do not " +
      "match hashes against external scripts",
  );
  ok(
    "the loader looks for the marker <Enhance> renders",
    ENHANCE_LOADER.includes('querySelectorAll("template[data-enhance]")') &&
      ENHANCE_LOADER.includes("dataset.enhance"),
    "the loader and the marker disagree, so every enhancement on every page stops loading " +
      "with nothing in the console",
  );
  ok(
    "the loader's URL prefix is where the app build emits the bundles",
    `/${enhanceFileName("header", "x")}`.startsWith(ENHANCE_URL_PREFIX) &&
      !/\bbase\s*:/.test(source("vite.config.ts")),
    `enhanceFileName() emits outside ${ENHANCE_URL_PREFIX}, or vite.config.ts sets a base, so ` +
      "the loader would refuse every real marker",
  );

  const rootSource = source("app", "root.tsx");
  const loaderTags = rootSource.match(/<script\b[^>]*__html:\s*ENHANCE_LOADER\s*\}\}[^>]*\/>/g) ?? [];
  ok(
    "root.tsx renders the loader exactly once, as raw HTML from ENHANCE_LOADER",
    loaderTags.length === 1 && /import\s*\{\s*ENHANCE_LOADER\s*\}/.test(rootSource),
    `found ${loaderTags.length}. Rendered as children, React would escape the text, and the ` +
      "bytes the browser hashes would no longer be the bytes the policy names",
  );
  ok(
    "the loader is the last thing in <body>, after every marker",
    rootSource.lastIndexOf("ENHANCE_LOADER") > rootSource.indexOf("{children}") &&
      /__html:\s*ENHANCE_LOADER\s*\}\}[^>]*\/>\s*<\/body>/.test(rootSource),
    "a marker parsed after the loader has run is never loaded",
  );
  ok(
    "the loader carries root's nonce, which is the admin one and undefined on public pages",
    /<script\s+nonce=\{nonce\}\s+dangerouslySetInnerHTML=\{\{\s*__html:\s*ENHANCE_LOADER/.test(rootSource),
    "the admin policy allows the loader by hash too, but a nonce read from anywhere else " +
      "could put a nonce on a cached public page",
  );
}
