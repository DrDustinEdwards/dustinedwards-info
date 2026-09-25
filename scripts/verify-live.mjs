// A deploy empties the cache, so after a caching change run it twice, cold then warm. Send a browser
// user-agent (Cloudflare 403s some clients) and strip SSR's <!-- --> before matching.
//
// This file is the ordered runner and the floor. Each section lives in scripts/lib/live/ and the
// shared client (origin, requests, counter) in scripts/lib/live/client.mjs.

import { pageCount } from "../app/lib/blog-listing.mjs";
import { assertFloor } from "./lib/floor.mjs";
import * as blogDraftsAsk from "./lib/live/blog-drafts-ask.mjs";
import { ASK_PROBE_LIMIT } from "./lib/live/blog-drafts-ask.mjs";
import * as cache from "./lib/live/cache.mjs";
import { ORIGIN, failures, tally } from "./lib/live/client.mjs";
import * as header from "./lib/live/header.mjs";
import * as pages from "./lib/live/pages.mjs";
import * as payload from "./lib/live/payload.mjs";
import * as preview from "./lib/live/preview.mjs";
import * as securityCsp from "./lib/live/security-csp.mjs";
import * as themeCss from "./lib/live/theme-css.mjs";
import * as twinSearchAdmin from "./lib/live/twin-search-admin.mjs";
import * as watchdog from "./lib/live/watchdog.mjs";

console.log(`Verifying ${ORIGIN}\n`);

await themeCss.run();
await header.run();
await twinSearchAdmin.run();
const corpus = await blogDraftsAsk.run();
await pages.run();
await cache.run();
await securityCsp.run();
await preview.run();
await payload.run();
await watchdog.run();

console.log(`\n${tally.checks - tally.failures} passed, ${tally.failures} failed`);

/* Floor on executed assertions, measured through a real run: skipped loops look like zero failures.
   241 was measured on 2026-08-29 (d38a780) against 11 published posts and 1 draft. The corpus loops
   add checks per post and per draft, so a fixed floor would let each new post's checks absorb a
   skipped section; the corpus part of the floor is derived instead. */
const corpusChecks = (/** @type {number} */ live, /** @type {number} */ drafts) =>
  live + pageCount(live) + drafts * 8 + Math.min(drafts, ASK_PROBE_LIMIT);
const MINIMUM_CHECKS = 241 + Math.max(0, corpusChecks(corpus.live, corpus.drafts) - corpusChecks(11, 1));
const breach = assertFloor("verify-live", "checks", tally.checks, MINIMUM_CHECKS);
const short = breach !== null;

if (failures.length > 0) {
  console.error("\nFAILURES:");
  for (const f of failures) console.error(`  - ${f}`);
}

if (short) {
  console.error(
    `\nREFUSED: ${breach}\n` +
      `  A pass count is not coverage:\n` +
      `  count the assertions that ran, not the ones that passed.`,
  );
}

process.exit(failures.length > 0 || short ? 1 : 0);
