/**
 * Gate over the external uptime monitors.
 *
 *   npm run check:uptime
 *
 * Asserts that both monitors this repo asks for EXIST, are NOT PAUSED, and
 * point at the CURRENT hostname. Fails by name otherwise.
 *
 * ## OBSERVATION BOUNDARY
 *
 * This reads UptimeRobot's record of its own configuration. It does NOT prove
 * a check has ever run, that an alert would be delivered, or that the mailbox
 * is read. It cannot see whether the account is over its plan limits. What it
 * proves is that the instrument is configured, switched on, and aimed at this
 * site, which is the half that silently rots when a hostname changes.
 *
 * It is also NOT a check that the site is up. See `PAUSED` in
 * `scripts/lib/uptimerobot.mjs`: a `DOWN` monitor is a monitor doing its job,
 * and a gate that demanded `UP` would go red for the site being down and
 * couple every gate run to production weather.
 *
 * ## THREE-WAY, BOTH DIRECTIONS
 *
 * `SITE_ORIGIN` is the one owner of the hostname (rule 17). The manifest is a
 * RECORD of what `uptime-ensure` last wrote, not a second owner. So there are
 * two comparisons and each catches a different failure:
 *
 *   code  vs manifest   the manifest went stale, or was edited by hand
 *   manifest vs live    somebody changed the monitor in the dashboard
 *
 * Checking only the second would pass a manifest and a monitor that agree with
 * each other and disagree with the site. Checking only the first would pass a
 * monitor that had been repointed or switched off.
 *
 * ## FAILS CLOSED
 *
 * A missing credential, an unreadable manifest, an API error and a manifest
 * with the wrong number of entries are each a FAILURE, never a skip. The whole
 * class of defect this gate exists for is a monitoring system that reports
 * nothing while looking configured, and a gate that passed when it could not
 * read its inputs would be another instance of it.
 *
 * NETWORK ONLY, so it is tiered `network` and `--ci` does not run it: a clean
 * checkout has no `.dev.vars` and there is no local UptimeRobot to read.
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

/* --------------------------------------------------- fail closed first */

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
 * SCOPE IS PROVEN NON-EMPTY BEFORE ANYTHING IS COMPARED (hard rule 10). An
 * empty desired list or an empty manifest would make every loop below iterate
 * nothing and report a clean sweep of a set it never looked at.
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

/* ------------------------------------------ code vs manifest (hostname) */

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

/* -------------------------------------------------- manifest vs live */

/*
 * READ BY ID, NEVER OFF THE LIST. See `getMonitor`: the list endpoint was
 * measured disagreeing with the addressed read for about 30 seconds after a
 * status change, in both directions. The direction that matters is a list
 * still reporting a monitor as running after somebody paused it, which would
 * make this gate answer green about an instrument that had been switched off.
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
 * THE READS ACTUALLY HAPPENED (hard rule 10, "prove scope non-empty").
 *
 * Every per-monitor assertion above lives inside a loop, and a loop that
 * iterated nothing reports exactly what a clean sweep reports. This counts the
 * monitors this run genuinely fetched from the API, so "0 failures" cannot
 * mean "0 monitors examined". It is paired with the floor below rather than
 * replacing it: the floor counts ASSERTIONS, this counts what they were
 * assertions ABOUT.
 */
ok(
  "every manifest monitor was actually read from the API",
  read === desired.length,
  `read ${read} of ${desired.length}. Assertions about the unread ones did not run, ` +
    `so their silence is absence of evidence rather than evidence of health.`,
);

/*
 * EXECUTED-COUNT FLOOR.
 *
 * MEASURED BY RUNNING THIS GATE, never summed: two monitors contribute a
 * different number of assertions each, because `COMPARED_FIELDS` only applies
 * the keyword fields to the KEYWORD monitor. Floored a little under the
 * measured count so a single added assertion does not have to move it, and so
 * a monitor silently dropping out of the desired set shows up as a smaller
 * number rather than as a clean run.
 */
/*
 * RE-MEASURED 2026-09-08 by RUNNING it: 22. Set to 18 at first, which
 * `check:floors` refused at a gap of 4 against a tolerance of 3, and it only
 * refused inside `check:all`: this gate is network-tiered, so the offline tier
 * that `check:floors` runs standalone never reaches it. Tolerance is 3 at this
 * count, so 19 is the slackest legal value.
 */
const MINIMUM_CHECKS = 19;
const breach = assertFloor("check:uptime", "checks", checks, MINIMUM_CHECKS);
if (breach) ok("this gate executed its assertions", false, breach);

console.log(`\n${checks} checks, ${failures} failure${failures === 1 ? "" : "s"}\n`);
/*
 * `exitCode` RATHER THAN `process.exit()`, and this is a Windows correctness
 * fix rather than a style preference.
 *
 * MEASURED 2026-09-07: with `process.exit()` here this gate printed
 * "22 checks, 0 failures" and then died with
 * `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING)` in libuv's
 * win/async.c, exiting 127. `process.exit()` tears the process down while
 * undici's keep-alive sockets from the API reads are still closing. A gate
 * that prints a clean pass and exits 127 is a FAILING gate to `check-all.mjs`,
 * which reads exit codes and cannot see the table above it.
 *
 * Letting the loop drain is what `check:media` and `check:image-weight`
 * already do on their success paths. The two fail-closed branches above still
 * call `process.exit(1)` directly and are safe there: both run BEFORE any
 * fetch, so there is no socket to race.
 */
process.exitCode = failures > 0 ? 1 : 0;
