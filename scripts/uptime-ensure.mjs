// Monitors are matched by the URL they point at, not by name, and the manifest is written from
// what the API returned.

import { writeFileSync } from "node:fs";

import { SITE_ORIGIN } from "../app/lib/seo.ts";
import { readDevVar } from "./lib/dev-vars.mjs";
import { KEY_ABSENT_EXIT, KEY_ABSENT_LINE, keylessRunIsExpected } from "./lib/uptime-step.mjs";
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
  // Its own code and line, on a GitHub runner only: ship records that one outcome as a skip. A
  // missing key anywhere else is a lost credential and exits 1, which ship records as a miss.
  if (keylessRunIsExpected(process.env)) {
    console.error(KEY_ABSENT_LINE);
    process.exit(KEY_ABSENT_EXIT);
  }
  console.error(
    "UPTIMEROBOT_API_KEY is missing or empty in .dev.vars, so there is nothing to authenticate with.\n" +
      "It is an operator credential for this machine rather than a wrangler secret, because\n" +
      "no deployed code reads it. Add the line to .dev.vars, which is gitignored, and rerun.",
  );
  process.exit(1);
}

const contactsRes = await call(key, "/alert-contacts");
if (!contactsRes.ok) {
  console.error(`GET /alert-contacts answered ${contactsRes.status}: ${contactsRes.text.slice(0, 300)}`);
  process.exit(1);
}
const contacts = Array.isArray(contactsRes.body?.data) ? contactsRes.body.data : [];
// Active email contacts only: an unconfirmed contact is listed but receives nothing.
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

const existing = await listMonitors(key);
console.log(`  ${existing.length} monitor(s) on the account`);

const desired = desiredMonitors(SITE_ORIGIN);
/** @type {Record<string, { id: number, url: string }>} */
const manifest = {};
let changed = 0;

/**
 * The manifest is what the gate checks by id, so an answer without a usable id stops the run rather
 * than writing `undefined` into it.
 *
 * @param {string} name @param {any} body
 */
function manifestEntry(name, body) {
  if (!Number.isInteger(body?.id) || body.id <= 0 || typeof body.url !== "string") {
    console.error(`  ${name}: UptimeRobot answered without a monitor id and url: ${JSON.stringify(body)}`);
    process.exit(1);
  }
  return { id: body.id, url: body.url };
}

for (const want of desired) {
  const url = /** @type {string} */ (want.shape.url);
  const match = existing.find((m) => String(m.url).replace(/\/+$/, "") === url.replace(/\/+$/, ""));

  // The contact travels with every write: a monitor that lost its contact fails silently.
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
    manifest[want.key] = manifestEntry(want.key, res.body);
    changed += 1;
    console.log(`  CREATED  ${want.key}  id ${res.body.id}`);
    continue;
  }

  // Compare only the fields this program sets: the API returns others, so a whole-object compare always differs.
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
  // Resumed separately because `status` is not writable through the update verb.
  if (isPaused) {
    const started = await call(key, `/monitors/${match.id}/start`, { method: "POST", body: {} });
    if (!started.ok) {
      console.error(`  resume ${want.key} answered ${started.status}: ${started.text.slice(0, 300)}`);
      process.exit(1);
    }
  }
  manifest[want.key] = manifestEntry(want.key, res.body);
  changed += 1;
  console.log(
    `  UPDATED  ${want.key}  id ${match.id}` +
      `${drift.length ? ` (${drift.join(", ")})` : ""}${isPaused ? " (resumed)" : ""}`,
  );
}

if (dryRun) {
  console.log("\n--dry-run: nothing was written.\n");
  process.exit(0);
}

if (Object.keys(manifest).length !== desired.length) {
  console.error(
    `\nExpected ${desired.length} monitor(s) in the manifest and have ` +
      `${Object.keys(manifest).length}. Refusing to write a partial manifest, because ` +
      `it is read as the complete set and a short one would look complete ` +
      `while covering less.`,
  );
  process.exit(1);
}

// Sorted and newline-terminated so a run that changed nothing is byte-identical and shows no diff.
const ordered = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
writeFileSync(MANIFEST_PATH, `${JSON.stringify(ordered, null, 2)}\n`, "utf8");

console.log(`\n  manifest: scripts/uptime-monitors.json`);
console.log(`  ${changed} change(s) applied.\n`);
