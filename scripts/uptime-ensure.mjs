/**
 * Brings the external uptime monitors into step with this repo, idempotently.
 *
 *   node scripts/uptime-ensure.mjs            create or update, write the manifest
 *   node scripts/uptime-ensure.mjs --dry-run  say what it would do, change nothing
 *
 * WHY AN EXTERNAL MONITOR AT ALL: everything else watches this site from inside Cloudflare or
 * does not reliably run. This is the off-platform half, run by somebody else's computer.
 *
 * TWO MONITORS, ANSWERING DIFFERENT QUESTIONS. The home page can be served from the edge cache
 * long after the Worker stops answering, so it proves REACHABILITY and is a weak liveness signal;
 * `/api/health` bypasses the cache and runs its checks, so it proves the Worker is ALIVE.
 *
 * IDEMPOTENT, AND MATCHED BY URL RATHER THAN BY NAME, the URL being what makes two monitors the
 * same monitor; a friendly name is a label a human edits. The manifest is written from what the
 * API RETURNED, never from what this intended. THE ALERT CONTACT IS RESOLVED, NEVER INVENTED, and
 * an account with no active contact REFUSES rather than alerting nobody.
 *
 * @see scripts/check-uptime.mjs the gate that refuses when this has not run
 * @see scripts/lib/uptimerobot.mjs the measured v3 contract
 */

import { writeFileSync } from "node:fs";

import { SITE_ORIGIN } from "../app/lib/seo.ts";
import { readDevVar } from "./lib/dev-vars.mjs";
import {
  COMPARED_FIELDS,
  MANIFEST_PATH,
  PAUSED,
  call,
  desiredMonitors,
  fieldInStep,
  listMonitors,
} from "./lib/uptimerobot.mjs";

const dryRun = process.argv.includes("--dry-run");

console.log("\nuptime-ensure\n");

const key = readDevVar("UPTIMEROBOT_API_KEY");
if (!key) {
  console.error(
    "UPTIMEROBOT_API_KEY is not in .dev.vars, so there is nothing to authenticate with.\n" +
      "It is an operator credential for this machine rather than a wrangler secret, because\n" +
      "no deployed code reads it. Add the line to .dev.vars, which is gitignored, and rerun.",
  );
  process.exit(1);
}

/* the alert contact */

const contactsRes = await call(key, "/alert-contacts");
if (!contactsRes.ok) {
  console.error(`GET /alert-contacts answered ${contactsRes.status}: ${contactsRes.text.slice(0, 300)}`);
  process.exit(1);
}
const contacts = Array.isArray(contactsRes.body?.data) ? contactsRes.body.data : [];
/*
 * ACTIVE EMAIL CONTACTS ONLY: an unconfirmed contact exists in the list and receives nothing, so
 * assigning one produces a monitor that alerts into a void while every panel says it is configured.
 */
const emailContacts = contacts.filter(
  (/** @type {{ type: unknown, status: unknown }} */ c) =>
    String(c.type).toLowerCase() === "email" && String(c.status).toLowerCase() === "active",
);
if (emailContacts.length === 0) {
  console.error(
    `The account has ${contacts.length} alert contact(s) and none is an ACTIVE email contact.\n` +
      "Refusing rather than creating monitors that would alert nobody: a monitor with no\n" +
      "reachable contact is indistinguishable from a working one until the day it matters.",
  );
  process.exit(1);
}
const contact = emailContacts[0];
console.log(`  alert contact: id ${contact.id} (${emailContacts.length} active email contact(s))`);

/* reconcile */

const existing = await listMonitors(key);
console.log(`  ${existing.length} monitor(s) on the account`);

const desired = desiredMonitors(SITE_ORIGIN);
/** @type {Record<string, { id: number, url: string }>} */
const manifest = {};
let changed = 0;

for (const want of desired) {
  const url = /** @type {string} */ (want.shape.url);
  const match = existing.find((m) => String(m.url).replace(/\/+$/, "") === url.replace(/\/+$/, ""));

  /*
   * THE ALERT CONTACT TRAVELS WITH EVERY WRITE, create and update alike: a monitor that lost its
   * contact is the silent-failure shape again, and re-asserting it costs nothing.
   */
  const payload = {
    ...want.shape,
    assignedAlertContacts: [{ alertContactId: contact.id, threshold: 0, recurrence: 0 }],
  };

  if (!match) {
    if (dryRun) {
      console.log(`  WOULD CREATE  ${want.key}  ${url}`);
      continue;
    }
    const res = await call(key, "/monitors", { method: "POST", body: payload });
    if (!res.ok) {
      console.error(`  create ${want.key} answered ${res.status}: ${res.text.slice(0, 400)}`);
      process.exit(1);
    }
    // FROM THE RESPONSE, never from the request.
    manifest[want.key] = { id: res.body.id, url: res.body.url };
    changed += 1;
    console.log(`  CREATED  ${want.key}  id ${res.body.id}`);
    continue;
  }

  /*
   * WHAT ACTUALLY DIFFERS, so a run that changes nothing says so: comparing the whole object would
   * report a difference every run, the API returning fields this program never sets.
   */
  const drift = COMPARED_FIELDS.filter(
    (f) => f in want.shape && !fieldInStep(f, match[f], want.shape[f]),
  );
  const contactMissing = !(match.assignedAlertContacts ?? []).some(
    (/** @type {{ alertContactId: number }} */ a) => a.alertContactId === contact.id,
  );
  const isPaused = String(match.status) === PAUSED;

  if (drift.length === 0 && !contactMissing && !isPaused) {
    manifest[want.key] = { id: match.id, url: match.url };
    console.log(`  ok       ${want.key}  id ${match.id} (already in step)`);
    continue;
  }

  if (dryRun) {
    console.log(
      `  WOULD UPDATE  ${want.key}  id ${match.id}` +
        `${drift.length ? ` fields: ${drift.join(", ")}` : ""}` +
        `${contactMissing ? " (alert contact missing)" : ""}${isPaused ? " (paused)" : ""}`,
    );
    continue;
  }

  const res = await call(key, `/monitors/${match.id}`, { method: "PATCH", body: payload });
  if (!res.ok) {
    console.error(`  update ${want.key} answered ${res.status}: ${res.text.slice(0, 400)}`);
    process.exit(1);
  }
  /*
   * RESUMED SEPARATELY, because `status` is NOT writable through the update verb. A paused monitor
   * is one somebody switched off, and this program's whole job is that the two are on.
   */
  if (isPaused) {
    const started = await call(key, `/monitors/${match.id}/start`, { method: "POST", body: {} });
    if (!started.ok) {
      console.error(`  resume ${want.key} answered ${started.status}: ${started.text.slice(0, 300)}`);
      process.exit(1);
    }
  }
  manifest[want.key] = { id: res.body.id, url: res.body.url };
  changed += 1;
  console.log(
    `  UPDATED  ${want.key}  id ${match.id}` +
      `${drift.length ? ` (${drift.join(", ")})` : ""}${isPaused ? " (resumed)" : ""}`,
  );
}

/* manifest */

if (dryRun) {
  console.log("\n--dry-run: nothing was written.\n");
  process.exit(0);
}

if (Object.keys(manifest).length !== desired.length) {
  console.error(
    `\nExpected ${desired.length} monitor(s) in the manifest and have ` +
      `${Object.keys(manifest).length}. Refusing to write a partial manifest, because ` +
      `check:uptime reads it as the complete set and a short one would pass by ` +
      `checking less.`,
  );
  process.exit(1);
}

/*
 * SORTED AND NEWLINE-TERMINATED, so a re-run that changed nothing is byte-identical and shows up
 * as no diff: a manifest that churned on key order would make every ship a spurious commit.
 */
const ordered = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
writeFileSync(MANIFEST_PATH, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");

console.log(`\n  manifest: scripts/uptime-monitors.json`);
console.log(`  ${changed} change(s) applied.\n`);
