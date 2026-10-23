/**
 * The API LEG: wrapper to app.
 *
 * This is the ONLY way this Worker reaches the publish machinery, and that is
 * the whole architecture in one file. Every tool call becomes authenticated
 * HTTP to /api/operator on the dustinedwards Worker, where the validators, the
 * first-publish policy, the atomic Git Data commit, the D1 sync and the AI
 * index sync all live.
 *
 * OVER THE `SITE` SERVICE BINDING since the move into dustinedwards-info
 * (ruling mcp-2026-10-10, design section 6 step 4). The public operator URL was
 * one hop through the internet for a call between two Workers on one account,
 * and on the dustinedwards.info zone it would also be the Worker-to-Worker
 * fetch the watchdog measured answering Cloudflare error 1042 (2026-08-29). A
 * service binding is still HTTP: the request carries the same bearer, crosses
 * the same operator authentication and the same rate limiter, and the site
 * cannot tell it from any other operator call. It is not an in-process call.
 *
 * Nothing here interprets a rule. It does not know what the first-publish policy
 * is, it cannot tell a policy refusal from a validation failure except by
 * reading what the API said, and it must never learn.
 *
 * The credential here identifies WHAT this Worker may do. It is deliberately a
 * different value from the client-leg credential, which identifies WHO is
 * operating. A failure of one must read differently from a refusal by the other.
 */

import { ApiLegError, callApi } from "@dustinedwards/site-runtime/mcp-server";

export interface ApiEnv {
  /** Service binding to the dustinedwards Worker. The only route to the app. */
  SITE: Fetcher;
  /**
   * The site's origin, used as the URL the bound Worker sees. A service binding
   * ignores the host for routing, but the site reads its own request URL, so it
   * is given the canonical one. check:wrapper asserts it equals SITE_ORIGIN in
   * app/lib/site-origin.mjs, so it is a checked copy and never a second source.
   */
  SITE_ORIGIN: string;
  /** The API leg bearer. Never the client-leg credential. */
  OPERATOR_TOKEN: string;
}

/**
 * What the operator API returns. This is the CONTRACT between the two Workers,
 * a documented payload shape rather than shared code, validated at the edge
 * like the outside caller this Worker is.
 */
type ApiResponse =
  | { ok: true; data: unknown }
  | { ok: false; error: string; detail?: unknown };

export interface ApiCallResult {
  /** HTTP status the API returned. 200 means the tool succeeded. */
  status: number;
  /** True only when the API said ok AND the response parsed as expected. */
  ok: boolean;
  /** On success, the API's data. On failure, undefined. */
  data?: unknown;
  /** On failure, the API's refusal prose VERBATIM. Never summarized, wrapped, or softened. */
  error?: string;
  /** On failure, the API's structured detail (policy name, field, line, conflict). */
  detail?: unknown;
}

export { ApiLegError };

/** The leg, for site-runtime's transport: it checks the binding, SITE_ORIGIN and the token floor, then reads JSON. */
const LEG = {
  binding: "SITE",
  token: "OPERATOR_TOKEN",
  api: "The operator API",
  userAgent: "dustinedwards-mcp/0.2 (operator MCP wrapper)",
};

/**
 * Calls one operator tool.
 *
 * The request shape is `{ tool, args }` because that is what the API already
 * takes. This function is a transport, not a translator.
 */
export async function callOperator(
  env: Partial<ApiEnv>,
  tool: string,
  args: Record<string, unknown>,
): Promise<ApiCallResult> {
  const { status, body } = await callApi(env, LEG, "/api/operator", { json: { tool, args } });
  if (!body || typeof body !== "object" || typeof (body as { ok?: unknown }).ok !== "boolean") {
    throw new ApiLegError(`The operator API returned status ${status} with an unrecognized payload shape.`, "malformed");
  }
  const answer = body as ApiResponse;
  if (answer.ok) return { status, ok: true, data: answer.data };
  return {
    status,
    ok: false,
    error: typeof answer.error === "string" ? answer.error : `The operator API refused with status ${status}.`,
    detail: answer.detail,
  };
}

/** One reading of the site's public readiness endpoint, in the shape the watchdog's repair plan reads. */
export interface HealthReading {
  status: number;
  body: unknown;
  error?: string;
}

/**
 * Reads `/api/health` over the same binding. Public and unauthenticated on the
 * site, so no bearer is sent: the operator token goes only where it is needed.
 * Never throws, and keeps the cause, exactly as the watchdog's reader does: a
 * reading that never happened must not be mistaken for a healthy or failing one.
 */
export async function readHealth(env: Partial<ApiEnv>): Promise<HealthReading> {
  try {
    const { status, body } = await callApi(env, { ...LEG, api: "The site" }, "/api/health", {
      anonymous: true,
      headers: { "cache-control": "no-cache" },
    });
    return { status, body };
  } catch (cause) {
    // An answer that came back but is not JSON is still a reading of that status.
    if (cause instanceof ApiLegError && cause.status !== undefined) return { status: cause.status, body: null };
    return { status: 0, body: null, error: cause instanceof Error ? cause.message : String(cause) };
  }
}
