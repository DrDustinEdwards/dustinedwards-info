// The guards in front of what costs money or writes from outside, asserted on source. The operator publish
// policy and the admin plane's smoke and session guards that enforce it, every rule with its paired negative (a
// policy that only refuses has not been shown to permit anything); the Ask route refuses a GET, gates on origin
// and refuses cheapest first; the origin predicate, the operator bearer and the JSON-LD helper are the ones every
// caller uses; and a draft can never reach the AI index.

import { assertFloor } from "@dustinedwards/devkit/node";
import { checkAdminRoute } from "./lib/guards-admin-route.mjs";
import { checkAskRoute } from "./lib/guards-ask-route.mjs";
import { checkPublishPolicy } from "./lib/guards-publish-policy.mjs";
import { tally } from "./lib/guards-shared.mjs";

checkPublishPolicy();
checkAdminRoute();
checkAskRoute();

/* Measured by running this gate, and it moves with the measurement: slack is the defect. */
const MINIMUM_CHECKS = 112;
const floorBreach = assertFloor("check:ask-guards", "checks", tally.checks, MINIMUM_CHECKS);
if (floorBreach) tally.fail(floorBreach);

if (tally.failures > 0) {
  console.error(`check:ask-guards FAILED, ${tally.failures} of ${tally.checks} checks:\n`);
  for (const f of tally.failed) console.error(`  ${f}\n`);
  process.exit(1);
}

console.log(`check:ask-guards ok. ${tally.checks} assertions, 0 failures.`);
