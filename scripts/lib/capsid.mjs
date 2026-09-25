export const NAMESPACE = "dustinedwards";
const CAPSID_MCP = "https://capsid.dustin-edwards.workers.dev/ops/mcp";

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
 * The endpoint may answer as SSE: take the LAST `data:` line, as progress frames can precede it.
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
  // No payload or no content is a failed call, never an empty object a caller could read as a result.
  if (!payload) throw new Error(`${name} answered with no JSON-RPC payload`);
  const rpc = JSON.parse(payload);
  if (rpc.error) throw new Error(`${name}: ${rpc.error.message ?? "rpc error"}`);
  const content = rpc.result?.content?.[0]?.text;
  // An MCP tool error arrives as a normal result flagged isError, with the message as its text.
  if (rpc.result?.isError) throw new Error(`${name}: ${content ?? "tool error"}`);
  if (typeof content !== "string") throw new Error(`${name} answered with no text content`);
  return JSON.parse(content);
}

const STAMP_PREFIX = "capsid-source:";

/** @param {{namespace: string, path: string, updated_at: string}} doc */
export function formatStamp(doc) {
  return `<!-- ${STAMP_PREFIX} ${doc.namespace} ${doc.path} ${doc.updated_at} -->`;
}
