// This file is the order and the floor. Each concern lives in scripts/lib/headers/, and the counter
// they share in scripts/lib/headers/gate.mjs.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import * as analyticsCapture from "./lib/headers/analytics-capture.mjs";
import * as csp from "./lib/headers/csp.mjs";
import * as gatewayAndPublicRoutes from "./lib/headers/gateway-and-public-routes.mjs";
import { root, tally } from "./lib/headers/gate.mjs";
import * as mediaAndHeadersFile from "./lib/headers/media-and-headers-file.mjs";
import * as noncePropagation from "./lib/headers/nonce-propagation.mjs";
import { runHealth, runPreview } from "./lib/headers/route-header-consts.mjs";
import * as staticSetAndCache from "./lib/headers/static-set-and-cache.mjs";
import { stripComments } from "./lib/strip-comments.mjs";

const APP_PATH = join(root, "workers", "app.ts");

console.log("\ncheck:headers\n");

if (!existsSync(APP_PATH)) {
  console.log("  FAIL  workers/app.ts is missing.\n");
  process.exit(1);
}

/* Comments stripped first: this file's prose names headers while explaining why they are wrong. */

const source = readFileSync(APP_PATH, "utf8");
const code = stripComments(source);

const { declared, applications } = staticSetAndCache.run(code);
csp.run(code);
noncePropagation.run();
runPreview();
analyticsCapture.run(code);

console.log(
  `\n  ${Object.keys(declared).length} static header(s) declared, ${applications - 1} application site(s)`,
);
mediaAndHeadersFile.run();
runHealth();
gatewayAndPublicRoutes.run(code);
/* Measured by running this gate, never summed. */
const MINIMUM_CHECKS = 228;
tally.floor("check:headers", "checks", MINIMUM_CHECKS);

console.log(`\n${tally.checks} checks, ${tally.failures} failures\n`);
process.exit(tally.failures > 0 ? 1 : 0);
