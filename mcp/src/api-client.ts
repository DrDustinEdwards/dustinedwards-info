/**
 * The API LEG: wrapper to app. The ONLY way this Worker reaches the publish machinery: every tool call becomes
 * authenticated HTTP to /api/operator on the dustinedwards Worker, where the validators, first-publish policy,
 * Git Data commit, D1 sync and AI index sync live. Nothing here interprets a rule, and it must never learn.
 *
 * It goes over the `SITE` service binding: a public URL is a needless internet hop and, on this zone, the
 * same-zone Worker-to-Worker fetch that answers Cloudflare error 1042. A service binding is still HTTP, with the
 * same bearer, authentication and rate limiter; it is not an in-process call.
 *
 * This credential identifies WHAT this Worker may do, deliberately a different value from the client-leg
 * credential, which identifies WHO is operating, so a failure of one reads differently from a refusal by the other.
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
type ApiResponse = { ok: true; data: unknown } | { ok: false; error: string; detail?: unknown };

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
export async function callSiteOperator(
  env: Partial<ApiEnv>,
  tool: string,
  args: Record<string, unknown>,
): Promise<ApiCallResult> {
  const { status, body } = await callApi(env, LEG, "/api/operator", { json: { tool, args } });
  if (!body || typeof body !== "object" || typeof (body as { ok?: unknown }).ok !== "boolean") {
    throw new ApiLegError(
      `The operator API returned status ${status} with an unrecognized payload shape.`,
      "malformed",
    );
  }
  const answer = body as ApiResponse;
  if (answer.ok) return { status, ok: true, data: answer.data };
  return {
    status,
    ok: false,
    error:
      typeof answer.error === "string"
        ? answer.error
        : `The operator API refused with status ${status}.`,
    detail: answer.detail,
  };
}
