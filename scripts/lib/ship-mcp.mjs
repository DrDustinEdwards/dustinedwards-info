// `npm run ship:mcp`: the admin MCP Worker in mcp/ (Dustin Edwards Admin), deployed the way `npm run ship` deploys
// the site. Ship's own preflight, clean-tree and CI read run first; this is what follows them. Ruling
// mcp-2026-10-10: the MCP lives in this repo and deploys as its own Worker, `dustinedwards-admin-mcp`.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** The mcp/ scripts that make up its gates, in the order CI's mcp job runs them. */
export const MCP_GATES = ["typecheck", "check:wrapper", "test", "build"];

/**
 * What each mcp target deploys. `mcp` is the server in mcp/.
 *
 * @type {Record<string, { title: string, dir: string[], gates: string[] }>}
 */
export const MCP_TARGETS = {
  mcp: { title: "the admin MCP", dir: ["mcp"], gates: MCP_GATES },
};

const HEALTH_STREAK = 5;
/** A new Custom Domain can take minutes to get its certificate, so the poll waits longer than the site's. */
const HEALTH_ATTEMPTS = 36;
const HEALTH_GAP_MS = 10_000;

/**
 * jsonc: block and line comments stripped, as check:wrapper reads it.
 * @param {string} text
 * @returns {any}
 */
function readJsonc(text) {
  return JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""));
}

/**
 * The real mcp/wrangler.jsonc, or why it cannot be deployed from. The file is gitignored because it
 * carries the live KV namespace ids; the example's placeholders would deploy a Worker bound to nothing.
 * @param {string} root
 * @param {string[]} [dir] the folder under root holding the config, mcp/ unless a target says otherwise
 * @returns {{ ok: true, origin: string } | { ok: false, why: string, remedy: string }}
 */
export function mcpConfig(root, dir = ["mcp"]) {
  const rel = [...dir, "wrangler.jsonc"].join("/");
  const path = join(root, ...dir, "wrangler.jsonc");
  if (!existsSync(path)) {
    return {
      ok: false,
      why: `${rel} does not exist`,
      remedy:
        "It is gitignored because it carries the live OAUTH_KV and PROBE_KV ids. Copy the example beside " +
        "it and fill the two ids from `npx wrangler kv namespace list` (the same ids mcp/wrangler.jsonc " +
        "holds). Nothing was deployed.",
    };
  }
  const text = readFileSync(path, "utf8");
  if (text.includes("YOUR_")) {
    return {
      ok: false,
      why: `${rel} still carries the example's YOUR_ placeholders`,
      remedy: "Fill the KV ids from `npx wrangler kv namespace list`. Nothing was deployed.",
    };
  }
  let config;
  try {
    config = readJsonc(text);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, why: `${rel} does not parse: ${message}`, remedy: "Fix it. Nothing was deployed." };
  }
  const origin = String(config?.vars?.PUBLIC_ORIGIN ?? "").replace(/\/+$/, "");
  if (!origin.startsWith("https://")) {
    return { ok: false, why: `${rel} names no https PUBLIC_ORIGIN`, remedy: "Set it as the example does. Nothing was deployed." };
  }
  return { ok: true, origin };
}

/**
 * Whether the live server's discovery documents describe this server, read without credentials.
 * The protected resource must be exactly ORIGIN/mcp (the audience every token is bound to), the
 * authorization server must be this origin with CIMD and the registration endpoint, and an
 * unauthenticated `server/discover` must be told to authenticate, naming the path-scoped document.
 *
 * @param {{
 *   prm: { status: number, body: any },
 *   as: { status: number, body: any },
 *   discover: { status: number, challenge: string },
 * }} readings
 * @param {string} origin
 * @returns {string[]} what is wrong; empty when discovery is right
 */
export function discoveryProblems({ prm, as, discover }, origin) {
  const problems = [];
  if (prm.status !== 200) problems.push(`protected resource metadata answered ${prm.status}`);
  else if (prm.body?.resource !== `${origin}/mcp`) {
    problems.push(`protected resource is ${JSON.stringify(prm.body?.resource)}, not ${origin}/mcp`);
  }
  if (as.status !== 200) problems.push(`authorization server metadata answered ${as.status}`);
  else {
    if (as.body?.issuer !== origin) problems.push(`issuer is ${JSON.stringify(as.body?.issuer)}, not ${origin}`);
    if (as.body?.client_id_metadata_document_supported !== true) problems.push("CIMD is not advertised");
    if (as.body?.registration_endpoint !== `${origin}/register`) problems.push("the registration endpoint is not advertised");
  }
  if (discover.status !== 401) problems.push(`an unauthenticated server/discover answered ${discover.status}, not 401`);
  else if (!discover.challenge.includes(`${origin}/.well-known/oauth-protected-resource/mcp`)) {
    problems.push("the 401 challenge does not name the path-scoped protected resource document");
  }
  return problems;
}

/**
 * @param {string} url
 * @param {RequestInit & { headers?: Record<string, string> }} [init]
 * @returns {Promise<{ status: number, body: any, challenge: string, error?: string }>}
 */
async function readJson(url, init) {
  try {
    const res = await fetch(url, { ...init, headers: { "user-agent": "ship", ...init?.headers } });
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { status: res.status, body, challenge: res.headers.get("www-authenticate") ?? "" };
  } catch (error) {
    return { status: 0, body: null, challenge: "", error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * The mcp target. Returns ship's exit code.
 *
 * @param {{
 *   root: string,
 *   sha: string,
 *   early: { verdict: { ok: boolean, why: string, remedy?: string } | null, error: string },
 *   readCi: () => Promise<{ verdict: { ok: boolean, why: string, remedy?: string } | null, error: string }>,
 *   announce: (title: string) => void,
 *   refuse: (why: string, remedy: string) => never,
 *   run: (command: string, args: string[], options?: { capture?: boolean }) => { code: number, text: string },
 *   target?: string,
 * }} ship
 * @returns {Promise<number>}
 */
export async function shipMcp({ root, sha, early, readCi, announce, refuse, run, target = "mcp" }) {
  const kit = MCP_TARGETS[target];
  if (!kit) return refuse(`unknown mcp target ${JSON.stringify(target)}`, "Nothing was deployed.");
  const rel = [...kit.dir, "wrangler.jsonc"].join("/");
  announce(`${target}: CI is green for this exact commit`);
  /* No local fallback for this target: CI's mcp job is the clean-checkout review, and it must have passed. */
  if (!early.verdict?.ok) {
    return refuse(
      early.error ? `CI could not be read: ${early.error}` : (early.verdict?.why ?? "CI could not be read"),
      early.verdict?.remedy ?? "The admin MCP deploys only from a commit CI passed. Nothing was deployed.",
    );
  }
  console.log(`  ${early.verdict.why}.`);

  announce(`${target}: the real config is present`);
  const config = mcpConfig(root, kit.dir);
  if (!config.ok) return refuse(config.why, config.remedy);
  console.log(`  ${rel}, serving ${config.origin}`);

  announce("mcp: install from its own lockfile");
  if (run("npm", ["ci", "--prefix", "mcp", "--no-audit", "--no-fund"]).code !== 0) {
    refuse("npm ci in mcp/ failed", "Its package.json and lockfile must agree. Nothing was deployed.");
  }

  announce(`${target}: gates (${kit.gates.join(", ")})`);
  for (const gate of kit.gates) {
    if (run("npm", ["run", gate, "--prefix", "mcp"]).code !== 0) {
      refuse(`mcp's ${gate} failed on this machine`, "CI passed it, so this machine differs; find out why. Nothing was deployed.");
    }
  }

  /* Read fresh, never reused from the first read, so no deploy is authorized by a stale verdict. */
  announce(`${target}: CI still green for this exact commit`);
  const { verdict, error } = await readCi();
  if (error || !verdict?.ok) {
    return refuse(error ? `the GitHub API could not be reached: ${error}` : (verdict?.why ?? "CI could not be read"), "Nothing was deployed.");
  }
  console.log(`  ${verdict.why}.`);

  announce(`Deploy ${kit.title}`);
  const deployed = run(
    "node",
    [join("mcp", "node_modules", "wrangler", "bin", "wrangler.js"), "deploy", "-c", join(...kit.dir, "wrangler.jsonc")],
    { capture: true },
  );
  if (deployed.code !== 0) refuse(`the deploy of ${kit.title} failed`, "The previous version is still serving.");
  const version = (deployed.text.match(/Current Version ID:\s*([0-9a-f-]{8,})/i) ?? [])[1] ?? "";
  if (!version) {
    refuse(
      "the deploy reported no Version ID",
      `It may have succeeded, but a ship that cannot name what it shipped did not ship. Check \`npx wrangler deployments list -c ${rel}\`.`,
    );
  }

  announce(`${target}: ${config.origin}/health, ${HEALTH_STREAK} consecutive 200s`);
  let streak = 0;
  for (let i = 0; i < HEALTH_ATTEMPTS && streak < HEALTH_STREAK; i += 1) {
    const res = await readJson(`${config.origin}/health?ship=${sha}-${i}`, { headers: { "cache-control": "no-cache" } });
    console.log(`  probe ${i + 1}: ${res.status || `FETCH FAILED ${res.error}`}`);
    streak = res.status === 200 ? streak + 1 : 0;
    if (streak < HEALTH_STREAK) await new Promise((r) => setTimeout(r, HEALTH_GAP_MS));
  }
  if (streak < HEALTH_STREAK) {
    refuse(
      `${config.origin}/health did not answer ${HEALTH_STREAK} consecutive 200s`,
      `Version ${version} is deployed. A new Custom Domain can take minutes for its certificate: re-run ship:mcp, ` +
        "or check Workers & Pages, dustinedwards-admin-mcp, Settings, Domains & Routes.",
    );
  }

  announce(`${target}: discovery describes this server`);
  const prm = await readJson(`${config.origin}/.well-known/oauth-protected-resource/mcp`);
  const as = await readJson(`${config.origin}/.well-known/oauth-authorization-server`);
  const discover = await readJson(`${config.origin}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2026-07-28",
      "mcp-method": "server/discover",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "server/discover", params: {} }),
  });
  const problems = discoveryProblems({ prm, as, discover }, config.origin);
  if (problems.length > 0) refuse(`discovery is wrong: ${problems.join("; ")}`, `Version ${version} is deployed and serving.`);
  console.log(`  resource ${prm.body.resource}, issuer ${as.body.issuer}, server/discover asks for a token`);

  announce(`Shipped ${kit.title}`);
  console.log(`  commit   ${sha}`);
  console.log(`  version  ${version}`);
  console.log(`  serving  ${config.origin}/mcp\n`);
  return 0;
}
