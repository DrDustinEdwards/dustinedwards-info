// The Build command for Worker Previews (Cloudflare's Git integration, job_c5a6f3e8ce6d). Cloudflare
// runs it on every push to a PR branch, then `npx wrangler preview` publishes the result. It writes
// ONLY the preview resources: the ids are looked up by the preview names, and no production id is
// ever needed, so a missing lookup refuses rather than falling back to anything.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { listD1Databases } from "./lib/d1-address.mjs";
import { runWrangler, wranglerTail } from "./lib/wrangler-run.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const PREVIEW_D1 = "dustinedwards-preview";
const PREVIEW_KV = "dustinedwards-preview";
const PLACEHOLDER = "set-by-build-preview";
const CONFIG = join(root, "wrangler.jsonc");
// Generated here and gitignored: `d1 migrations apply` reads the database from a config's top-level
// d1_databases, and the real config's top level is production.
const MIGRATIONS_CONFIG = join(root, "wrangler.preview-migrations.jsonc");

/** @param {string} why @returns {never} */
function refuse(why) {
  console.error(`\nbuild:preview REFUSED: ${why}\n`);
  process.exit(1);
}

/** @param {string} what @param {string} command */
function step(what, command) {
  console.log(`\nbuild:preview: ${what}`);
  const result = spawnSync(command, { cwd: root, shell: true, stdio: "inherit" });
  if (result.status !== 0) refuse(`${what} failed (${command} exited ${result.status ?? "on a signal"}).`);
}

function previewD1Id() {
  const { databases, failure } = listD1Databases();
  if (failure) refuse(`could not list D1 databases${failure}. The build token needs D1 Edit.`);
  const found = databases.find((d) => d.name === PREVIEW_D1);
  if (typeof found?.uuid !== "string" || found.uuid.length === 0) {
    refuse(`no D1 database named ${PREVIEW_D1} in this account.`);
  }
  return found.uuid;
}

function previewKvId() {
  const listed = runWrangler("kv namespace list");
  if (listed.status !== 0) refuse(`could not list KV namespaces: ${wranglerTail(listed.output)}`);
  const start = listed.stdout.indexOf("[");
  if (start === -1) refuse("kv namespace list printed no JSON.");
  /** @type {Array<{ id?: string, title?: string }>} */
  let namespaces;
  try {
    namespaces = JSON.parse(listed.stdout.slice(start));
  } catch (error) {
    refuse(`kv namespace list did not parse: ${error instanceof Error ? error.message : String(error)}`);
  }
  const found = namespaces.find((n) => n.title === PREVIEW_KV);
  if (typeof found?.id !== "string" || found.id.length === 0) {
    refuse(`no KV namespace titled ${PREVIEW_KV} in this account.`);
  }
  return found.id;
}

/**
 * Each placeholder must appear exactly once, inside `previews`: patching nothing would publish a
 * preview bound to a resource that does not exist, and looks exactly like patching correctly.
 *
 * @param {string} text @param {string} key @param {string} value
 */
function patchOnce(text, key, value) {
  const needle = `"${key}": "${PLACEHOLDER}"`;
  const count = text.split(needle).length - 1;
  if (count !== 1) refuse(`expected ${needle} once in wrangler.jsonc, found it ${count} times.`);
  if (text.indexOf(needle) < text.indexOf(`"previews"`)) refuse(`${needle} sits outside the previews block.`);
  return text.replace(needle, `"${key}": "${value}"`);
}

const d1Id = previewD1Id();
const kvId = previewKvId();

let config = readFileSync(CONFIG, "utf8");
config = patchOnce(config, "database_id", d1Id);
config = patchOnce(config, "id", kvId);
writeFileSync(CONFIG, config);
console.log(`build:preview: bound previews to ${PREVIEW_D1} and the ${PREVIEW_KV} KV namespace.`);

writeFileSync(
  MIGRATIONS_CONFIG,
  `${JSON.stringify(
    {
      d1_databases: [
        { binding: "DB", database_name: PREVIEW_D1, database_id: d1Id, migrations_dir: "drizzle" },
      ],
    },
    null,
    2,
  )}\n`,
);

step(
  `migrations on ${PREVIEW_D1}`,
  `npx wrangler d1 migrations apply ${PREVIEW_D1} --remote --config wrangler.preview-migrations.jsonc`,
);
// The same build steps, in the same order, as ship's Build step.
step("stack artifact", "npm run build:stack");
step("content build", "npm run build:content");
step("publication twins", "npm run build:publication-twins");
step("app build", "npm run build");
// Ship runs check:content before its sync for the same reason: the sync runs no gate of its own.
step("content check", "npm run check:content");
step(`content sync to ${PREVIEW_D1}`, "npm run sync:content -- --preview");
