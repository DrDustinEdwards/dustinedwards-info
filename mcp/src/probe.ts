/**
 * The client measurement probe, an instrument and not a feature. Its one job is the removal condition in
 * src/mcp-handler.ts: do the target clients still open with `initialize`, or `server/discover`? (Claude Code and
 * claude.ai open with `initialize` and no Mcp-Method or Mcp-Name headers; Grok Build takes the 401 and stops.)
 *
 * Mounted at /probe/mcp OUTSIDE the OAuth provider, deliberately: it observes unauthenticated clients. One no-op
 * tool and no route to the operator API, so there is nothing to protect. Read captures with
 * `node scripts/probe-report.mjs` (Cloudflare API); no HTTP control plane, so no probe credential exists to leak.
 */

import { readCapped } from "@dustinedwards/site-runtime/body";

export interface ProbeEnv {
  PROBE_KV: KVNamespace;
}

/** Advertised newest first. What a client PICKS from this is itself a finding. */
const SUPPORTED = ["2026-07-28", "2025-11-25", "2025-06-18", "2025-03-26"];

const SEQ_KEY = "probe:seq";

const NOOP_TOOL = {
  name: "probe_noop",
  title: "Measurement probe",
  description:
    "A no-op that exists so a client will complete a connection and reveal its " +
    "protocol shape. This endpoint is a measurement instrument, not the operator " +
    "wrapper, and it can change nothing.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
};

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(body === null ? "" : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      ...headers,
    },
  });
}

/** The only header VALUES a capture keeps: protocol fields that name no person and carry no credential. */
const KEPT_HEADER_VALUES = new Set([
  "accept",
  "content-type",
  "mcp-method",
  "mcp-name",
  "mcp-protocol-version",
]);

/** A kept value is a client's self-description; a longer one is cut, not stored whole. */
const MAX_KEPT_VALUE = 200;

const text = (value: unknown): string | null =>
  typeof value === "string" ? value.slice(0, MAX_KEPT_VALUE) : null;

/**
 * The protocol shape of a JSON-RPC body: what the report reads (method, declared version, client name), never the
 * arguments, which a stranger fills and which could hold anything.
 */
function bodyShape(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if ("OVERSIZED" in b || "UNPARSEABLE" in b) return b;
  const params =
    b.params && typeof b.params === "object" ? (b.params as Record<string, unknown>) : null;
  const clientInfo =
    params?.clientInfo && typeof params.clientInfo === "object"
      ? (params.clientInfo as Record<string, unknown>)
      : null;
  const meta = b._meta && typeof b._meta === "object" ? (b._meta as Record<string, unknown>) : null;
  return {
    method: text(b.method),
    paramKeys: params ? Object.keys(params).sort() : [],
    protocolVersion: text(params?.protocolVersion),
    clientInfo: clientInfo
      ? { name: text(clientInfo.name), version: text(clientInfo.version) }
      : null,
    metaProtocolVersion: text(meta?.["io.modelcontextprotocol/protocolVersion"]),
  };
}

/**
 * Records one request, as a shape and never a credential or an address.
 *
 * Header NAMES are captured complete rather than an allowlist, because the point is to discover what a client sends
 * and an allowlist can only confirm what was already suspected. Header VALUES are kept only for the protocol fields in
 * KEPT_HEADER_VALUES: a cookie, an Access token, an Authorization value, a session id or a connecting IP is recorded
 * as present by its name alone (the probe is public, and a log of strangers' credentials and addresses would be a
 * leak waiting to happen; dustinedwards.info stores no visitor data). Query values and RPC arguments are dropped
 * for the same reason; the query keeps its parameter names.
 */
async function record(env: ProbeEnv, request: Request, body: unknown): Promise<void> {
  const url = new URL(request.url);
  const headerNames: string[] = [];
  const headers: Record<string, string> = {};
  for (const [k, v] of request.headers) {
    const name = k.toLowerCase();
    headerNames.push(name);
    if (KEPT_HEADER_VALUES.has(name)) headers[name] = v.slice(0, MAX_KEPT_VALUE);
  }

  const seq = Number((await env.PROBE_KV.get(SEQ_KEY)) ?? "0") + 1;
  await env.PROBE_KV.put(SEQ_KEY, String(seq));

  const shape = bodyShape(body);
  const entry = {
    seq,
    at: new Date().toISOString(),
    method: request.method,
    // Recorded without the /probe prefix so a capture reads like the real
    // endpoint's traffic, which is what it is standing in for.
    path: url.pathname.replace(/^\/probe/, "") || "/",
    queryKeys: [...new Set(url.searchParams.keys())].sort(),
    headerNames: headerNames.sort(),
    headers,
    rpcMethod: shape?.method ?? null,
    body: shape,
  };

  // Zero padded so a plain key list sorts chronologically. Two week TTL: a
  // measurement older than that should be re-taken, not read.
  await env.PROBE_KV.put(`capture:${String(seq).padStart(5, "0")}`, JSON.stringify(entry), {
    expirationTtl: 60 * 60 * 24 * 14,
  });
}

/** The largest request body a capture reads. */
const MAX_CAPTURED_BODY = 16_384;

export async function handleProbe(
  request: Request,
  env: ProbeEnv,
  _origin: string,
): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/^\/probe/, "") || "/";

  if (path === "/health") return new Response("ok", { headers: { "cache-control": "no-store" } });
  if (path !== "/mcp") return json({ error: "not_found" }, 404);

  let body: unknown = null;
  if (request.method === "POST") {
    // Read to the ceiling as it arrives (site-runtime ./body), so a large post is never held whole.
    const raw = await readCapped(request, MAX_CAPTURED_BODY);
    if (raw === null) {
      // A real MCP request is a few hundred bytes; a body this large is stored as the fact that it was.
      body = { OVERSIZED: `over ${MAX_CAPTURED_BODY} bytes` };
    } else {
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        // Only the fact: the text is a stranger's and could hold anything.
        body = { UNPARSEABLE: `${raw.length} characters` };
      }
    }
  }

  await record(env, request, body);

  // 2026-07-28 removed the GET stream and session deletion. A legacy client
  // opening a GET stream and being refused is itself a useful capture.
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405, { allow: "POST" });

  const id = (body as { id?: unknown } | null)?.id ?? null;
  const rpc = (body as { method?: string } | null)?.method;
  const ok = (result: unknown) => json({ jsonrpc: "2.0", id, result });

  switch (rpc) {
    // Legacy opening. Echo the client's own version so it proceeds and reveals
    // the rest of its behavior rather than stopping at a negotiation failure.
    case "initialize": {
      const asked = (body as { params?: { protocolVersion?: string } })?.params?.protocolVersion;
      return ok({
        protocolVersion: asked && SUPPORTED.includes(asked) ? asked : "2025-11-25",
        capabilities: { tools: {} },
        serverInfo: { name: "dustinedwards-mcp-probe", version: "0.0.0" },
      });
    }

    // 2026-07-28 opening, mandatory for modern servers. A capture here is the
    // event that retires the era seam in src/mcp-handler.ts.
    case "server/discover":
      return ok({
        resultType: "complete",
        supportedVersions: SUPPORTED,
        capabilities: { tools: {} },
        ttlMs: 60_000,
        // The conformance suite requires cacheScope to be
        // "public" or "private". "session" fails SEP-2549.
        cacheScope: "private",
        _meta: {
          "io.modelcontextprotocol/serverInfo": {
            name: "dustinedwards-mcp-probe",
            version: "0.0.0",
          },
        },
      });

    case "tools/list":
      return ok({
        resultType: "complete",
        tools: [NOOP_TOOL],
        ttlMs: 60_000,
        cacheScope: "private",
      });

    case "tools/call":
      return ok({
        resultType: "complete",
        content: [{ type: "text", text: "Measurement probe. Nothing was done." }],
      });

    case "ping":
      return ok({});

    default:
      if (typeof rpc === "string" && rpc.startsWith("notifications/")) {
        return new Response(null, { status: 202 });
      }
      return json(
        {
          jsonrpc: "2.0",
          id,
          error: { code: -32601, message: `Method not found: ${String(rpc)}` },
        },
        404,
      );
  }
}
