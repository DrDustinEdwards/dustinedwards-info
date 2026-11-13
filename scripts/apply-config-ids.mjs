// Writes the redacted values into wrangler.jsonc for the deploy (deploy.yml's pre-deploy
// guard and its converge job): each value is read from what the live Worker is bound to now, through the Cloudflare
// API, as mcp/scripts/apply-config.mjs does for the admin MCP. So the deploy needs no secret beyond the Cloudflare
// token and account id that devkit's worker-deploy passes, and a Worker keeps the database, namespace and address it
// was last deployed with. The account id comes from CLOUDFLARE_ACCOUNT_ID.
//
// Patches placeholders by text and never parse-and-reserialises, which would strip the comments these configs depend
// on. It never prints a value.

import { errorMessage } from "@dustinedwards/site-runtime/log";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/** @param {string} why @returns {never} */
function refuse(why) {
  console.error(`\napply-config-ids REFUSED: ${why} Nothing was deployed.\n`);
  process.exit(1);
}

/**
 * Each placeholder, and where its value lives: a binding of a live Worker (`worker`, `type`, `binding`, and the first
 * field of `from` it carries), or the account id. The settings API names a D1 binding's id `id` or `database_id`, so
 * both are read. A change to the example must fail loudly here, not leave a deploy bound to a database that does not
 * exist.
 * @type {Array<{ config: string, name: string, key: string, placeholder: string, worker?: string, type?: string, binding?: string, from?: string[] }>}
 */
const FIELDS = [
  {
    config: "wrangler.jsonc",
    name: "d1_databases[0].database_id",
    key: "database_id",
    placeholder: "00000000-0000-0000-0000-000000000000",
    worker: "dustinedwards",
    type: "d1",
    binding: "DB",
    from: ["id", "database_id"],
  },
  {
    config: "wrangler.jsonc",
    name: "kv_namespaces[0].id",
    key: "id",
    placeholder: "00000000000000000000000000000000",
    worker: "dustinedwards",
    type: "kv_namespace",
    binding: "APP_KV",
    from: ["namespace_id"],
  },
];

const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
const account = (process.env.CLOUDFLARE_ACCOUNT_ID ?? "").trim();
if (!token || !account) refuse("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must both be set.");

/** @type {Map<string, Array<Record<string, unknown>>>} */
const bindings = new Map();
for (const worker of new Set(FIELDS.flatMap((f) => (f.worker ? [f.worker] : [])))) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${worker}/settings`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    },
  ).catch((error) => refuse(`the Cloudflare API could not be reached: ${errorMessage(error)}.`));
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !Array.isArray(body?.result?.bindings))
    refuse(`the settings of ${worker} could not be read (HTTP ${response.status}).`);
  bindings.set(worker, body.result.bindings);
}

/** @param {(typeof FIELDS)[number]} field @returns {string} */
function valueOf(field) {
  if (!field.worker) return account;
  const bound = bindings
    .get(field.worker)
    ?.find((b) => b.name === field.binding && b.type === field.type);
  const live = (field.from ?? [])
    .map((key) => bound?.[key])
    .find((value) => typeof value === "string" && value.trim());
  if (typeof live !== "string" || !live.trim())
    refuse(
      `${field.worker} has no ${field.type} binding ${field.binding} to copy into ${field.name}.`,
    );
  return live.trim();
}

/** Key plus placeholder: two fields share a placeholder of thirty-two zeros, so the value alone is ambiguous. */
const needleFor = (/** @type {{ key: string, placeholder: string }} */ field) =>
  `"${field.key}": "${field.placeholder}"`;

const CONFIGS = [...new Set(FIELDS.map((f) => f.config))];
for (const config of CONFIGS) {
  if (!existsSync(join(root, config)))
    refuse(
      `${config} does not exist. postinstall bootstraps it from ${config}.example; run npm ci first.`,
    );
}

for (const config of CONFIGS) {
  const path = join(root, config);
  let text = readFileSync(path, "utf8");
  /** @type {Array<[string, string]>} */
  const written = [];
  for (const field of FIELDS.filter((f) => f.config === config)) {
    const value = valueOf(field);
    if (value === field.placeholder)
      refuse(`${field.name}'s live value is the placeholder itself, which patches nothing.`);
    // Counted before replacing: `replace` on a string swaps the FIRST match and reports nothing, so a needle appearing
    // twice would leave one behind and this would print success.
    const needle = needleFor(field);
    const occurrences = text.split(needle).length - 1;
    if (occurrences !== 1) {
      refuse(
        `the placeholder for ${field.name} appears ${occurrences} times in ${config}, not once: the example changed shape.`,
      );
    }
    // A replacer function, not a string: in a replacement string `$&` and `$1` are patterns.
    text = text.replace(needle, () => `"${field.key}": "${value}"`);
    written.push([needle, `"${field.key}": "${value}"`]);
    console.log(`  patched ${field.name} in ${config}`);
  }
  writeFileSync(path, text, "utf8");
  // Read back: a write that did not take is invisible from the exit code of writeFileSync.
  const after = readFileSync(path, "utf8");
  for (const [needle, line] of written) {
    if (after.includes(needle) || !after.includes(line))
      refuse(`${config} does not carry its values after the write.`);
  }
}

console.log(`  ${CONFIGS.join(" and ")} carries every redacted value.`);
