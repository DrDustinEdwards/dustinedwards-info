/**
 * The tool-call log. Ruling mcp-2026-10-10, rule 12.4: an append-only log of
 * every tool call, with the caller, the arguments and the result.
 *
 * A Durable Object with synchronous SQLite, one instance for the whole Worker,
 * because that is the storage on this Worker that can be made append-only by
 * construction: the class below has exactly one write, an INSERT, and no
 * UPDATE, DELETE or read path over HTTP. Nothing that reaches this Worker can
 * rewrite a row. It is read through the Cloudflare dashboard's Durable Object
 * data view, by the account owner, like the probe's capture log.
 *
 * A REFUSED CALL is one `refused` row: it names who asked and why, and nothing
 * was sent to the site. An allowed call is TWO ROWS. `started` is written BEFORE the operator API is called and
 * the call is refused if that write fails, so no tool runs unlogged. `finished`
 * carries the result; if that write fails the call has already happened and
 * cannot be undone, so the failure goes to the Worker log instead.
 *
 * WHAT A ROW CARRIES. The caller's audit name (a GitHub login or an agent
 * principal, never a credential), the tool, the arguments, and the result. A
 * long string argument (an image as base64, a whole procedure file) is stored
 * as its length and a SHA-256 prefix: enough to prove which bytes were sent,
 * without turning the log into a second copy of the content.
 */

const LONG_STRING = 200;
const RESULT_CHARS = 1000;

export class ToolCallLog implements DurableObject {
  private readonly sql: SqlStorage;

  constructor(state: DurableObjectState) {
    this.sql = state.storage.sql;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS calls (" +
        "seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, call_id TEXT NOT NULL, " +
        "phase TEXT NOT NULL, caller TEXT NOT NULL, tool TEXT NOT NULL, args TEXT NOT NULL, result TEXT)",
    );
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST") return new Response("append only", { status: 405 });
    const row = (await request.json()) as AuditRow;
    this.sql.exec(
      "INSERT INTO calls (at, call_id, phase, caller, tool, args, result) VALUES (?, ?, ?, ?, ?, ?, ?)",
      new Date().toISOString(),
      String(row.callId),
      String(row.phase),
      String(row.caller),
      String(row.tool),
      JSON.stringify(row.args ?? {}),
      row.result === undefined ? null : JSON.stringify(row.result),
    );
    return new Response(null, { status: 204 });
  }
}

export interface AuditEnv {
  TOOL_CALL_LOG: DurableObjectNamespace;
}

export interface AuditRow {
  callId: string;
  phase: "started" | "finished" | "refused";
  caller: string;
  tool: string;
  args: Record<string, unknown>;
  result?: { isError: boolean; text: string };
}

async function digest(text: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...bytes.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The arguments as the log stores them: long strings become their length and a digest prefix. */
export async function loggedArgs(args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(args)) {
    out[key] =
      typeof value === "string" && value.length > LONG_STRING
        ? { chars: value.length, sha256: await digest(value) }
        : value;
  }
  return out;
}

/** The result as the log stores it: whether it failed, and the start of its text. */
export function loggedResult(output: { isError?: boolean; content: Array<{ text: string }> }) {
  const text = output.content.map((c) => c.text).join("\n");
  return { isError: output.isError === true, text: text.slice(0, RESULT_CHARS) };
}

/**
 * Appends one row. Throws when the binding is missing or the write fails, so
 * the caller decides: a failed `started` refuses the call, a failed `finished`
 * is reported to the Worker log.
 */
export async function appendAudit(env: Partial<AuditEnv>, row: AuditRow): Promise<void> {
  if (!env.TOOL_CALL_LOG) throw new Error("the TOOL_CALL_LOG binding is missing");
  const stub = env.TOOL_CALL_LOG.get(env.TOOL_CALL_LOG.idFromName("tool-calls"));
  const response = await stub.fetch("https://tool-call-log.invalid/append", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(row),
  });
  if (response.status !== 204) throw new Error(`the tool-call log answered ${response.status}`);
}
