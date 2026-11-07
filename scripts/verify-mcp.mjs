// The admin MCP's live gate (deploy.yml's `mcp` job, devkit's worker-deploy `verify-command`, run from mcp/ once its
// /health reports this run's commit): the discovery documents describe this server. Exit 0 passes, 1 refuses (the
// Worker is rolled back), 3 could not run. Ruling mcp-2026-10-10: the MCP lives in this repo and deploys as its own
// Worker, `dustinedwards-admin-mcp`.
//
//   node ../scripts/verify-mcp.mjs

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * jsonc: block and line comments stripped, as check:wrapper reads it.
 * @param {string} text
 * @returns {any}
 */
function readJsonc(text) {
  return JSON.parse(text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""));
}

/**
 * The server's origin, from the tracked mcp/wrangler.jsonc.example. The live gate runs in a fresh checkout with no
 * install and no pre-deploy, so the real config (gitignored for its KV ids) is not there; PUBLIC_ORIGIN is public and
 * the example carries the deployed value.
 * @param {string} root
 * @returns {{ ok: true, origin: string } | { ok: false, why: string }}
 */
export function mcpConfig(root) {
  const rel = "mcp/wrangler.jsonc.example";
  const path = join(root, "mcp", "wrangler.jsonc.example");
  if (!existsSync(path)) return { ok: false, why: `${rel} does not exist` };
  let config;
  try {
    config = readJsonc(readFileSync(path, "utf8"));
  } catch (error) {
    return {
      ok: false,
      why: `${rel} does not parse: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const origin = String(config?.vars?.PUBLIC_ORIGIN ?? "").replace(/\/+$/, "");
  if (!origin.startsWith("https://"))
    return { ok: false, why: `${rel} names no https PUBLIC_ORIGIN` };
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
    if (as.body?.issuer !== origin)
      problems.push(`issuer is ${JSON.stringify(as.body?.issuer)}, not ${origin}`);
    if (as.body?.client_id_metadata_document_supported !== true)
      problems.push("CIMD is not advertised");
    if (as.body?.registration_endpoint !== `${origin}/register`)
      problems.push("the registration endpoint is not advertised");
  }
  if (discover.status !== 401)
    problems.push(`an unauthenticated server/discover answered ${discover.status}, not 401`);
  else if (!discover.challenge.includes(`${origin}/.well-known/oauth-protected-resource/mcp`)) {
    problems.push("the 401 challenge does not name the path-scoped protected resource document");
  }
  return problems;
}

/**
 * @param {string} url
 * @param {Omit<RequestInit, "headers"> & { headers?: Record<string, string> }} [init]
 * @returns {Promise<{ status: number, body: any, challenge: string, error?: string }>}
 */
async function readJsonResponse(url, init) {
  try {
    const res = await fetch(url, {
      ...init,
      headers: { "user-agent": "deploy-verify", ...init?.headers },
    });
    const text = await res.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    return { status: res.status, body, challenge: res.headers.get("www-authenticate") ?? "" };
  } catch (error) {
    return {
      status: 0,
      body: null,
      challenge: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

if (import.meta.main) {
  const config = mcpConfig(join(import.meta.dirname, ".."));
  if (!config.ok) {
    console.log(`COULD NOT RUN: ${config.why}`);
    process.exit(3);
  }
  const prm = await readJsonResponse(`${config.origin}/.well-known/oauth-protected-resource/mcp`);
  const as = await readJsonResponse(`${config.origin}/.well-known/oauth-authorization-server`);
  const discover = await readJsonResponse(`${config.origin}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "mcp-protocol-version": "2026-07-28",
      "mcp-method": "server/discover",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "server/discover", params: {} }),
  });
  const unreachable = [prm, as, discover].find((r) => r.error);
  if (unreachable) {
    console.log(`COULD NOT RUN: ${config.origin} could not be read: ${unreachable.error}`);
    process.exit(3);
  }
  const problems = discoveryProblems({ prm, as, discover }, config.origin);
  if (problems.length > 0) {
    console.log(`REFUSED: discovery is wrong: ${problems.join("; ")}`);
    process.exit(1);
  }
  console.log(
    `resource ${prm.body.resource}, issuer ${as.body.issuer}, server/discover asks for a token`,
  );
}
