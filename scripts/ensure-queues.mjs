#!/usr/bin/env node
/**
 * Create every Queue the site's wrangler config names that does not exist on the account yet.
 *
 * `wrangler deploy` refuses a producer or consumer whose queue is missing, so a PR that adds a
 * queue used to need a hand-run `wrangler queues create` before its merge could deploy. The
 * deploy workflow runs this first instead, with the deploy's own token, which already holds
 * Queues Edit (the "Edit Cloudflare Workers" template; the probe step above it checks the read).
 *
 * It only ever CREATES, never deletes or edits: a queue the config stops naming stays on the
 * account until someone removes it by hand. Names come from producers, consumers and each
 * consumer's dead_letter_queue, at the top level and in every env block.
 *
 * Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID. Argument: the config path (default
 * wrangler.jsonc).
 */
import { parseJsonc } from "./lib/wrangler-surface.mjs";

const API = "https://api.cloudflare.com/client/v4";

/** @param {any} config */
export function queueNames(config) {
  const names = new Set();
  const blocks = [config, ...Object.values(config.env ?? {})];
  for (const block of blocks) {
    for (const p of block?.queues?.producers ?? []) names.add(p.queue);
    for (const c of block?.queues?.consumers ?? []) {
      names.add(c.queue);
      if (c.dead_letter_queue) names.add(c.dead_letter_queue);
    }
  }
  return [...names].filter(Boolean).sort();
}

/**
 * @param {string} token
 * @param {string} path
 * @param {{ method?: string, body?: string }} [init]
 * @returns {Promise<any>}
 */
async function call(token, path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const errors = (body.errors ?? [])
      .map(
        (/** @type {{ code: number, message: string }} */ e) =>
          `${e.code} ${e.message}`,
      )
      .join("; ");
    throw new Error(
      `${init.method ?? "GET"} ${path} answered http ${res.status}: ${errors || "no error body"}`,
    );
  }
  return body;
}

async function main() {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!token || !account)
    throw new Error(
      "CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.",
    );
  const wanted = queueNames(parseJsonc(process.argv[2] ?? "wrangler.jsonc"));

  const existing = new Set();
  for (let page = 1; ; page++) {
    const body = await call(
      token,
      `/accounts/${account}/queues?per_page=100&page=${page}`,
    );
    for (const q of body.result ?? []) existing.add(q.queue_name);
    const info = body.result_info;
    if (!info || page * (info.per_page ?? 100) >= (info.total_count ?? 0))
      break;
  }

  for (const name of wanted) {
    if (existing.has(name)) {
      console.log(`  ${name}: exists`);
      continue;
    }
    await call(token, `/accounts/${account}/queues`, {
      method: "POST",
      body: JSON.stringify({ queue_name: name }),
    });
    console.log(`  ${name}: created`);
  }
  console.log(`All ${wanted.length} queues the config names exist.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(`::error::${error.message} Nothing was deployed.`);
    process.exit(1);
  });
}
