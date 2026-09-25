// The nonce reaches every script: the server entry and the one speculation-rules block.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { stripComments } from "../strip-comments.mjs";
import { ok, root } from "./gate.mjs";

export function run() {
  console.log("\n  the nonce reaches every script");

  const entryServer = stripComments(
    readFileSync(join(root, "app", "entry.server.tsx"), "utf8"),
  );

  /*
   * ServerRouter passes its nonce prop both into FrameworkContext and to StreamTransfer; without
   * it React Router's two streaming scripts ship bare, one of them carrying the payload.
   */
  ok(
    "entry.server.tsx passes a nonce to <ServerRouter>",
    /<ServerRouter[^>]*\snonce=\{/.test(entryServer),
    "without it StreamTransfer gets none and both streaming scripts ship bare, " +
      "so an enforcing CSP would stop the hydration payload on every page",
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

  /*
   * THE SPECULATION BLOCK, and there is exactly ONE: speculationrules is gated by script-src, so
   * an un-nonced element is refused SILENTLY and the page renders identically without it.
   */
  const siteSpeculation = stripComments(
    readFileSync(join(root, "app", "components", "site-speculation.tsx"), "utf8"),
  );
  ok(
    "SiteSpeculation stamps a nonce on its speculationrules script",
    /nonce=\{/.test(siteSpeculation),
    "this block renders on every public page, so an un-nonced one is refused site-wide " +
      "under the enforced policy and the loss is invisible in a render",
  );
  ok(
    "SiteSpeculation takes the nonce from the root loader, not its own source",
    /useRouteLoaderData/.test(siteSpeculation),
    "one source in workers/app.ts, several readers; a second generator would drift",
  );
  ok(
    "SiteHeader renders SiteSpeculation, which is what puts it on every public page",
    /<SiteSpeculation\s*\/>/.test(
      stripComments(readFileSync(join(root, "app", "components", "site-header.tsx"), "utf8")),
    ),
    "an imported-but-unrendered component is the shape that passes both assertions " +
      "above while shipping nothing to any reader",
  );
}
