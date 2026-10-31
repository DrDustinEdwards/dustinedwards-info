// Writes mcp/wrangler.jsonc for CI's `npm run ship:mcp` (deploy.yml): the tracked example with its four placeholders
// filled from what the live dustinedwards-admin-mcp Worker is bound to now, read from the Cloudflare API. So CI needs no
// new secret and the admin MCP keeps the values it was last shipped with by hand. Patches by text, as
// apply-config-ids.mjs does, so the comments survive. It never prints a value.

import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONFIG = join(root, "mcp", "wrangler.jsonc");
const WORKER = "dustinedwards-admin-mcp";

/** @param {string} why @returns {never} */
function refuse(why) {
  console.error(`\napply-mcp-config REFUSED: ${why} Nothing was deployed.\n`);
  process.exit(1);
}

/** Each placeholder, and how to find its value among the live Worker's bindings. */
const FIELDS = [
  { needle: '"id": "YOUR_OAUTH_KV_ID"', key: "id", binding: "OAUTH_KV", type: "kv_namespace", from: "namespace_id" },
  { needle: '"id": "YOUR_PROBE_KV_ID"', key: "id", binding: "PROBE_KV", type: "kv_namespace", from: "namespace_id" },
  {
    needle: '"ACCESS_TEAM_DOMAIN": "https://YOUR_TEAM.cloudflareaccess.com"',
    key: "ACCESS_TEAM_DOMAIN",
    binding: "ACCESS_TEAM_DOMAIN",
    type: "plain_text",
    from: "text",
  },
  { needle: '"ADMIN_EMAIL": "admin@example.com"', key: "ADMIN_EMAIL", binding: "ADMIN_EMAIL", type: "plain_text", from: "text" },
];

const token = process.env.CLOUDFLARE_API_TOKEN ?? "";
const account = process.env.CLOUDFLARE_ACCOUNT_ID ?? "";
if (!token || !account) refuse("CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID must both be set.");

const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/workers/scripts/${WORKER}/settings`, {
  headers: { Authorization: `Bearer ${token}` },
  signal: AbortSignal.timeout(30_000),
}).catch((error) => refuse(`the Cloudflare API could not be reached: ${error instanceof Error ? error.message : String(error)}.`));
const body = await response.json().catch(() => ({}));
if (!response.ok || !Array.isArray(body?.result?.bindings)) {
  refuse(`the settings of ${WORKER} could not be read (HTTP ${response.status}).`);
}
/** @type {Array<Record<string, unknown>>} */
const bindings = body.result.bindings;

if (!existsSync(CONFIG)) copyFileSync(`${CONFIG}.example`, CONFIG);
let text = readFileSync(CONFIG, "utf8");

for (const field of FIELDS) {
  const live = bindings.find((b) => b.name === field.binding && b.type === field.type)?.[field.from];
  if (typeof live !== "string" || !live) refuse(`${WORKER} has no ${field.type} binding ${field.binding} to copy.`);
  const count = text.split(field.needle).length - 1;
  if (count !== 1) refuse(`mcp/wrangler.jsonc has the ${field.binding} placeholder ${count} times, not once.`);
  // A replacer function, so a `$` in a value is written as itself.
  text = text.replace(field.needle, () => `"${field.key}": ${JSON.stringify(live)}`);
}

writeFileSync(CONFIG, text, "utf8");
if (readFileSync(CONFIG, "utf8").includes("YOUR_")) refuse("mcp/wrangler.jsonc still carries a YOUR_ placeholder after the write.");
console.log(`  mcp/wrangler.jsonc carries ${WORKER}'s live ids and vars.`);
