// Refreshes data/system-model.json from Capsid's public model, for the daily workflow
// (.github/workflows/system-model.yml). Not a gate.
//
//   node scripts/refresh-system-model.mjs [url]
//
// The fetched document passes the same check the page loads it with (app/lib/systems.mjs), or
// nothing is written and the run fails: a model the site would refuse never reaches a pull
// request. The file is written only when the model says something new; a new date alone is
// not a change. Prints `changed=true` or `changed=false` (against the committed file, main's), and
// writes the same line to $GITHUB_OUTPUT when the workflow sets it.
//
// Nor does a model that leaves out a part a public system's Wrangler config declares
// (scripts/lib/system-drift.mjs): the run fails naming each one, and nothing is written.
//
// OPEN_MODEL names the model on the refresh pull request already open, when there is one. Then it
// also prints `same_as_open=true` when the fetched model says what that one says, so a day that
// changes only the date leaves the open pull request alone.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { loadSystemModel, sameModel } from "../app/lib/systems.mjs";
import { undeclaredParts } from "./lib/system-drift.mjs";

const root = join(import.meta.dirname, "..");
// SYSTEM_MODEL_FILE is for the test, which refreshes a copy.
const FILE = process.env.SYSTEM_MODEL_FILE ?? join(root, "data", "system-model.json");
const url = process.argv[2] ?? process.env.SYSTEM_MODEL_URL ?? "https://mcp.dustinedwards.info/public/model/v1.json";

const response = await fetch(url, { headers: { accept: "application/json" } });
if (!response.ok) throw new Error(`GET ${url} answered ${response.status}`);
const fetched = loadSystemModel(await response.json());
// SYSTEM_REPOS_RAW is for the test, which serves the repos' configs itself.
const drift = await undeclaredParts(fetched, process.env.SYSTEM_REPOS_RAW ?? "https://raw.githubusercontent.com");
console.log(`refresh-system-model: checked the Wrangler configs of ${drift.checked.join(", ") || "no system"}; skipped ${drift.skipped.join(", ") || "none"}.`);
if (drift.missing.length) {
  throw new Error(`${url} leaves out parts its systems' Wrangler configs declare:\n  ${drift.missing.join("\n  ")}`);
}
const current = loadSystemModel(JSON.parse(readFileSync(FILE, "utf8")));

const changed = !sameModel(current, fetched);
const openPath = process.env.OPEN_MODEL;
const sameAsOpen = openPath ? sameModel(loadSystemModel(JSON.parse(readFileSync(openPath, "utf8"))), fetched) : false;
if (changed) writeFileSync(FILE, `${JSON.stringify(fetched, null, 2)}\n`);
console.log(
  changed
    ? `refresh-system-model: ${url} (as of ${fetched.as_of}) differs from the committed model (as of ${current.as_of}); wrote ${fetched.systems.length} systems, ${fetched.relationships.length} lines.`
    : `refresh-system-model: ${url} (as of ${fetched.as_of}) says what the committed model says; nothing written.`,
);
const outputs = `changed=${changed}\nsame_as_open=${sameAsOpen}\n`;
process.stdout.write(outputs);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, outputs);
