/**
 * One client for Capsid's MCP endpoint, and one list of the documents the canvas is given.
 *
 * BOUNDARY: the list has one owner here, because an exporter and a gate each carrying their own
 * would eventually check a set the exporter no longer writes and still pass, which is the
 * alias-blind failure the vacuity rule names. Credential handling is deliberately the caller's.
 */

export const NAMESPACE = "dustinedwards";
export const CAPSID_MCP = "https://capsid.dustin-edwards.workers.dev/ops/mcp";

/**
 * The Capsid documents the design agent is given, and why each one earns a place in a budget the
 * canvas actually reads. Deliberately NOT here: the inventory that answers what to build rather
 * than how it should look, and the runbook, which is operational procedure with no design content.
 */
export const EXPORTED_DOCS = [
  {
    path: "design-rules-researched-2026-09.md",
    why: "the researched design rules, and it says in its own title that it supersedes conflicting handoff text",
  },
  {
    path: "decisions-2026-09-13-session.md",
    why: "the feature rulings and seat-rule reversals the handoffs predate",
  },
  {
    path: "TASK-redesign-brief-2026-09.md",
    why: "the redesign brief itself: Paper, Glass, Light and the ratified design law",
  },
];

/**
 * One JSON-RPC call against Capsid's MCP endpoint. The endpoint may answer as SSE and this takes
 * the LAST `data:` line, because a stream can carry progress frames ahead of the result.
 *
 * @param {string} token
 * @param {string} name
 * @param {Record<string, unknown>} args
 */
export async function callTool(token, name, args) {
  const res = await fetch(CAPSID_MCP, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
  });
  if (!res.ok) throw new Error(`${name} returned HTTP ${res.status}`);
  const text = await res.text();
  const payload = text.includes("data:")
    ? text.split("\n").filter((l) => l.startsWith("data:")).pop()?.slice(5).trim()
    : text;
  const rpc = JSON.parse(payload ?? "{}");
  if (rpc.error) throw new Error(`${name}: ${rpc.error.message ?? "rpc error"}`);
  const content = rpc.result?.content?.[0]?.text;
  return JSON.parse(content ?? "{}");
}

/**
 * The stamp an exported file carries, and the parser that reads it back. The gate compares it to
 * Capsid's CURRENT value, which is the whole mechanism: an export is a copy, a copy has no way of
 * knowing its source moved, and hard rule 18's stamp is what makes the drift visible rather than
 * silent.
 */
export const STAMP_PREFIX = "capsid-source:";

/** @param {{namespace: string, path: string, updated_at: string}} doc */
export function formatStamp(doc) {
  return `<!-- ${STAMP_PREFIX} ${doc.namespace} ${doc.path} ${doc.updated_at} -->`;
}

/**
 * @param {string} text
 * @returns {{namespace: string, path: string, updated_at: string} | null}
 */
export function parseStamp(text) {
  const m = text.match(new RegExp(`<!--\\s*${STAMP_PREFIX}\\s+(\\S+)\\s+(\\S+)\\s+(.+?)\\s*-->`));
  if (!m) return null;
  return { namespace: m[1], path: m[2], updated_at: m[3] };
}
