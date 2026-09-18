/**
 * Gate over the external uptime monitors.
 *
 *   npm run check:uptime
 *
 * Asserts that both monitors this repo asks for EXIST, are NOT PAUSED, and point at the CURRENT
 * hostname. BOUNDARY: it reads UptimeRobot's record of its own configuration, and does NOT prove a
 * check has ever run, that an alert would be delivered, or that the mailbox is read. It is also
 * NOT a check that the site is up: a `DOWN` monitor is one doing its job.
 *
 * THREE-WAY, BOTH DIRECTIONS. `SITE_ORIGIN` is the one owner of the hostname and the manifest is
 * a RECORD of what `uptime-ensure` last wrote, so code against manifest catches a stale or
 * hand-edited record and manifest against live catches a dashboard edit. Either alone passes on a
 * pair that agree with each other and with nothing else.
 *
 * FAILS CLOSED on a missing credential, an unreadable manifest, an API error or a wrong count: the
 * defect class is a monitoring system that reports nothing while looking configured. NETWORK ONLY.
 */

import { existsSync, readFileSync } from "node:fs";

import { SITE_ORIGIN } from "../app/lib/seo.ts";
import { assertFloor } from "./lib/floor.mjs";
import { readDevVar } from "./lib/dev-vars.mjs";
import {
  COMPARED_FIELDS,
  MANIFEST_PATH,
  PAUSED,
  desiredMonitors,
  expectedReadValue,
  fieldInStep,
  getMonitor,
} from "./lib/uptimerobot.mjs";

let checks = 0;
let failures = 0;

/** @param {string} label @param {boolean} condition @param {string} [detail] */
function ok(label, condition, detail = "") {
  checks += 1;
  if (condition) return;
  failures += 1;
  console.log(`  FAIL  ${label}${detail ? `\n        ${detail}` : ""}`);
}

console.log("\ncheck:uptime\n");

/* fail closed first */

const key = readDevVar("UPTIMEROBOT_API_KEY");
ok(
  "UPTIMEROBOT_API_KEY is readable from .dev.vars",
  Boolean(key),
  "Absent, so the monitors cannot be read and this gate proves nothing. It is an " +
    "operator credential for this machine, not a wrangler secret. Add it to .dev.vars.",
);

ok(
  "the monitor manifest exists",
  existsSync(MANIFEST_PATH),
  `${MANIFEST_PATH} is missing. Run \`node scripts/uptime-ensure.mjs\` to create the ` +
    `monitors and record their ids.`,
);

if (failures > 0) {
  console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}\n`);
  process.exit(1);
}

/** @type {Record<string, { id: number, url: string }>} */
let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
} catch (error) {
  console.log(`  FAIL  the manifest parses\n        ${error instanceof Error ? error.message : error}`);
  console.log(`\n${checks + 1} checks, ${failures + 1} failures\n`);
  process.exit(1);
}

const desired = desiredMonitors(SITE_ORIGIN);

/*
 * SCOPE IS PROVEN NON-EMPTY BEFORE ANYTHING IS COMPARED (hard rule 10): an empty desired list or
 * an empty manifest would make every loop below report a clean sweep of a set it never looked at.
 */
ok(
  "the desired monitor set is not empty",
  desired.length > 0,
  "desiredMonitors() returned nothing, so every comparison below would be vacuous.",
);
ok(
  "the manifest describes every desired monitor",
  Object.keys(manifest).length === desired.length &&
    desired.every((d) => manifest[d.key] && typeof manifest[d.key].id === "number"),
  `manifest keys: ${JSON.stringify(Object.keys(manifest))}, expected ` +
    `${JSON.stringify(desired.map((d) => d.key))} each carrying a numeric id. ` +
    `Run \`node scripts/uptime-ensure.mjs\`.`,
);

/* code vs manifest (hostname) */

for (const want of desired) {
  const recorded = manifest[want.key];
  if (!recorded) continue;
  ok(
    `the manifest's ${want.key} URL matches SITE_ORIGIN`,
    recorded.url === want.shape.url,
    `manifest has ${JSON.stringify(recorded.url)}, SITE_ORIGIN gives ` +
      `${JSON.stringify(want.shape.url)}. The hostname moved and the monitors were not ` +
      `re-ensured. Ship runs uptime-ensure after readiness for exactly this reason.`,
  );
}

/* manifest vs live */

/*
 * READ BY ID, NEVER OFF THE LIST: the list endpoint has been measured disagreeing with the
 * addressed read in both directions after a status change, and the direction that matters is a
 * list still reporting a monitor as running after somebody paused it.
 */
let read = 0;

for (const want of desired) {
  const recorded = manifest[want.key];
  if (!recorded) continue;
  let found = null;
  try {
    found = await getMonitor(/** @type {string} */ (key), recorded.id);
    read += 1;
  } catch (error) {
    ok(
      `the UptimeRobot API answered for ${want.key}`,
      false,
      error instanceof Error ? error.message : String(error),
    );
    continue;
  }

  ok(
    `monitor ${want.key} (id ${recorded.id}) exists on the account`,
    Boolean(found),
    `No monitor with that id. It was deleted, or the manifest names an id from a ` +
      `different account. Run \`node scripts/uptime-ensure.mjs\`.`,
  );
  if (!found) continue;

  ok(
    `monitor ${want.key} is not paused`,
    String(found.status) !== PAUSED,
    `status is ${JSON.stringify(found.status)}. A paused monitor checks nothing and ` +
      `alerts nobody while still appearing in every list.`,
  );

  ok(
    `monitor ${want.key} points at the current hostname`,
    String(found.url).replace(/\/+$/, "") === String(want.shape.url).replace(/\/+$/, ""),
    `live URL is ${JSON.stringify(found.url)}, SITE_ORIGIN gives ` +
      `${JSON.stringify(want.shape.url)}.`,
  );

  for (const field of COMPARED_FIELDS) {
    if (!(field in want.shape)) continue;
    if (field === "url") continue; // asserted above with its own message
    ok(
      `monitor ${want.key} has the expected ${field}`,
      fieldInStep(field, found[field], want.shape[field]),
      `live ${field} is ${JSON.stringify(found[field])}, expected ` +
        `${JSON.stringify(expectedReadValue(field, want.shape[field]))} ` +
        `(this repo writes ${JSON.stringify(want.shape[field])}).`,
    );
  }

  ok(
    `monitor ${want.key} has at least one alert contact`,
    Array.isArray(found.assignedAlertContacts) && found.assignedAlertContacts.length > 0,
    "No alert contact assigned, so a failure would be recorded and nobody told.",
  );
}

/*
 * THE READS ACTUALLY HAPPENED (hard rule 10, prove scope non-empty). Every per-monitor assertion
 * lives inside a loop, and a loop that iterated nothing reports what a clean sweep reports. Paired
 * with the floor rather than replacing it: that counts ASSERTIONS, this counts what they were about.
 */
ok(
  "every manifest monitor was actually read from the API",
  read === desired.length,
  `read ${read} of ${desired.length}. Assertions about the unread ones did not run, ` +
    `so their silence is absence of evidence rather than evidence of health.`,
);

/*
 * EXECUTED-COUNT FLOOR, MEASURED BY RUNNING THIS GATE, never summed: the two monitors contribute
 * a different number of assertions each. Floored a little under, so one added assertion does not
 * have to move it and a monitor dropping out of the desired set shows up as a smaller number.
 */
/*
 * RE-MEASURED BY RUNNING IT. The first value was refused by `check:floors` for too wide a gap,
 * and only inside `check:all`: this gate is network-tiered, so the offline tier that
 * `check:floors` runs standalone never reaches it. This is the slackest legal value.
 */
const MINIMUM_CHECKS = 19;
const breach = assertFloor("check:uptime", "checks", checks, MINIMUM_CHECKS);
if (breach) ok("this gate executed its assertions", false, breach);

console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}\n`);
/*
 * `exitCode` RATHER THAN `process.exit()`, a Windows correctness fix: exit tears the process down
 * while undici's keep-alive sockets are still closing, and a gate that prints a clean pass and
 * exits 127 is a FAILING gate to `check-all.mjs`, which reads exit codes. The two fail-closed
 * branches above still exit directly and are safe, both running BEFORE any fetch.
 */
process.exitCode = failures > 0 ? 1 : 0;
