// The parts each public system's repo declares in its Wrangler config that Capsid's model does not
// list, for the daily refresh (scripts/refresh-system-model.mjs): the model may not silently drift
// from what is deployed. Read unauthenticated from raw.githubusercontent.com, as the workflow can.
//
// A part is a Worker (one per config), a D1 database, an R2 bucket, a KV namespace, a queue or a
// cron trigger: the binding kinds the model has a container kind for. Containers carry display
// names, not resource names, so a system passes when the model lists at least as many containers
// of each kind as its configs declare parts. A private system, one without a repo, and a repo with
// no config the raw host serves (a private repo answers 404 too) are skipped, not failed.
import { ts } from "./syntax.mjs";

// Where a system's configs live in its repo, when not one at the root. The site's repo holds two
// systems: the site with its watchdog Worker, and the admin MCP (mcp/).
/** @type {Record<string, string[]>} */
const CONFIGS = {
  "dustinedwards-info": ["wrangler.jsonc.example", "wrangler.watchdog.jsonc.example"],
  "dustinedwards-mcp": ["mcp/wrangler.jsonc.example"],
};
// Otherwise the first of these the repo has. A gitignored wrangler.jsonc leaves its example.
const ROOT_CONFIGS = ["wrangler.jsonc", "wrangler.jsonc.example", "wrangler.json"];

/**
 * Each part once per system, keyed by what names the resource: the site's watchdog binds the
 * site's APP_KV, which is one namespace. A dead-letter queue counts with the queue it serves.
 *
 * @param {any} config
 * @returns {[string, string][]} [kind, name]
 */
const partsOf = (config) => [
  ["worker", config.name],
  ...(config.d1_databases ?? []).map((/** @type {any} */ d) => ["database", d.database_name]),
  ...(config.r2_buckets ?? []).map((/** @type {any} */ b) => ["bucket", b.bucket_name]),
  ...(config.kv_namespaces ?? []).map((/** @type {any} */ k) => ["kv", k.binding]),
  ...[...(config.queues?.producers ?? []), ...(config.queues?.consumers ?? [])].map((q) => ["queue", q.queue]),
  ...(config.triggers?.crons ?? []).map((/** @type {any} */ c) => ["cron", `${config.name} ${c}`]),
];

/**
 * @param {import("../../app/lib/systems.mjs").SystemModel} model
 * @param {string} raw the raw host, https://raw.githubusercontent.com unless a test serves one
 * @returns {Promise<{ missing: string[], checked: string[], skipped: string[] }>}
 */
export async function undeclaredParts(model, raw) {
  const missing = [];
  const checked = [];
  const skipped = [];
  for (const system of model.systems) {
    const repo = system.private ? undefined : system.repos?.[0];
    const slug = repo?.match(/^https:\/\/github\.com\/([^/]+\/[^/]+?)\/?$/)?.[1];
    if (!slug) {
      skipped.push(`${system.id} (${system.private ? "private" : "no GitHub repo"})`);
      continue;
    }
    const configs = [];
    for (const path of CONFIGS[system.id] ?? ROOT_CONFIGS) {
      const url = `${raw}/${slug}/HEAD/${path}`;
      const response = await fetch(url);
      if (response.status === 404) continue;
      if (!response.ok) throw new Error(`GET ${url} answered ${response.status}`);
      const parsed = ts.parseConfigFileTextToJson(path, await response.text());
      if (parsed.error) throw new Error(`${url} is not valid JSONC`);
      configs.push(parsed.config);
      if (!CONFIGS[system.id]) break;
    }
    if (!configs.length) {
      skipped.push(`${system.id} (no Wrangler config readable in ${slug})`);
      continue;
    }
    checked.push(system.id);
    /** @type {Map<string, Set<string>>} */
    const declared = new Map();
    for (const [kind, name] of configs.flatMap(partsOf)) declared.set(kind, (declared.get(kind) ?? new Set()).add(name));
    for (const [kind, names] of declared) {
      const listed = model.containers.filter((c) => c.system === system.id && c.kind === kind).length;
      if (names.size > listed) missing.push(`${system.id}: ${names.size} ${kind} in Wrangler (${[...names].join(", ")}), ${listed} in the model`);
    }
  }
  return { missing, checked, skipped };
}
