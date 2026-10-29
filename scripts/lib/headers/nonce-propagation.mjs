// Which scripts carry the nonce and which are trusted without one: the admin nonce reaches the server
// entry, a public page's one script is the same-origin /site.js, and its prefetch rules arrive by header.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SPECULATION_RULES_HEADER } from "@dustinedwards/site-runtime/prefetch";

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

  /* The nonce is minted for the private planes only (/admin, /lab): a public page is cached with its header. */
  const app = source("workers", "app.ts");
  ok(
    "workers/app.ts mints the nonce only on a private path",
    /isPrivatePath\(\s*url\.pathname\s*\)\s*\?\s*crypto\.randomUUID\(\)\s*:\s*undefined/.test(app) &&
      (app.match(/crypto\.randomUUID\(\)/g) ?? []).length === 1,
    "a nonce minted for a public render lands in an edge-cached header and body, so every " +
      "reader shares it for the cache lifetime",
  );

  /*
   * THE PREFETCH RULES, by header (site-runtime ./prefetch): one same-origin file for every page, so no
   * page carries a rule block and the policy needs no allowance for one.
   */
  ok(
    "workers/app.ts names the prefetch rules in a public page's header, on both exits of the Renderer",
    /SPECULATION_RULES_HEADER\.name,\s*SPECULATION_RULES_HEADER\.value/.test(app) &&
      /if \(url\.pathname === SPECULATION_RULES_PATH\)/.test(app) && /speculationRulesResponse\(/.test(app),
    `a page without the ${SPECULATION_RULES_HEADER.name} header prefetches nothing, and nothing on the page says so`,
  );
  ok(
    "workers/app.ts builds the policy from the request URL's pathname",
    /contentSecurityPolicy\(\s*url\.pathname\s*,\s*adminNonce\s*\)/.test(app) &&
      /const\s+url\s*=\s*new\s+URL\(\s*request\.url\s*\)/.test(app),
    "a normalized or rewritten pathname could give a /media file the page policy or a page the media one",
  );

  /* THE ONE SCRIPT: root loads /site.js, same-origin, deferred, with root's nonce (the admin one or none). */
  const rootSource = source("app", "root.tsx");
  const siteScripts = rootSource.match(/<script\b[^>]*\/>/g) ?? [];
  ok(
    "root.tsx renders exactly one script, /site.js, deferred, carrying root's nonce",
    siteScripts.length === 1 && /<script src="\/site\.js" defer nonce=\{nonce\} \/>/.test(siteScripts[0] ?? ""),
    `found ${JSON.stringify(siteScripts)}. Without defer it runs before the markers are parsed; a nonce read ` +
      "from anywhere but root's admin-only one could put a nonce on a cached public page",
  );
  ok(
    "root.tsx renders no inline script",
    !/dangerouslySetInnerHTML/.test(rootSource),
    "an inline script needs a hash in the public policy, which has none",
  );
}
