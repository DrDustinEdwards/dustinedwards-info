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

export interface ApiEnv {
  /** Service binding to the dustinedwards Worker. The only route to the app. */
  SITE: Fetcher;
  /**
   * The site's origin, used as the URL the bound Worker sees. A service binding
   * ignores the host for routing, but the site reads its own request URL, so it
   * is given the canonical one. check:wrapper asserts it equals SITE_ORIGIN in
   * app/lib/seo.ts, so it is a checked copy and never a second source.
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
export type ApiResponse =
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

export class ApiLegError extends Error {
  constructor(
    message: string,
    readonly kind: "unconfigured" | "unreachable" | "malformed",
  ) {
    super(message);
    this.name = "ApiLegError";
  }
}

const USER_AGENT = "dustinedwards-mcp/0.2 (operator MCP wrapper)";

function assertBound(env: Partial<ApiEnv>): asserts env is Pick<ApiEnv, "SITE" | "SITE_ORIGIN"> & Partial<ApiEnv> {
  if (!env.SITE || typeof env.SITE.fetch !== "function") {
    throw new ApiLegError(
      "The wrapper is not configured: the SITE service binding is missing. Not configured means not open.",
      "unconfigured",
    );
  }
  if (!env.SITE_ORIGIN) {
    throw new ApiLegError(
      "The wrapper is not configured: SITE_ORIGIN is unset. Not configured means not open.",
      "unconfigured",
    );
  }
}

function assertConfigured(env: Partial<ApiEnv>): asserts env is ApiEnv {
  assertBound(env);
  // The app refuses its own endpoint below 32 characters, so a token that short
  // could never work and is worth catching here rather than after a round trip.
  if (!env.OPERATOR_TOKEN || env.OPERATOR_TOKEN.length < 32) {
    throw new ApiLegError(
      "The wrapper is not configured: OPERATOR_TOKEN is unset or too short. Not configured means not open.",
      "unconfigured",
    );
  }
}

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
  assertConfigured(env);

  let response: Response;
  try {
    response = await env.SITE.fetch(`${env.SITE_ORIGIN}/api/operator`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.OPERATOR_TOKEN}`,
        // Identifies the caller in the app's logs without revealing anything.
        "user-agent": USER_AGENT,
      },
      body: JSON.stringify({ tool, args }),
    });
  } catch (cause) {
    throw new ApiLegError(
      `The operator API could not be reached: ${cause instanceof Error ? cause.message : String(cause)}`,
      "unreachable",
    );
  }

  const raw = await response.text();
  let parsed: unknown;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    throw new ApiLegError(
      `The operator API returned status ${response.status} with a body that is not JSON.`,
      "malformed",
    );
  }

  if (!parsed || typeof parsed !== "object" || typeof (parsed as { ok?: unknown }).ok !== "boolean") {
    throw new ApiLegError(
      `The operator API returned status ${response.status} with an unrecognized payload shape.`,
      "malformed",
    );
  }

  const body = parsed as ApiResponse;

  if (body.ok) {
    return { status: response.status, ok: true, data: (body as { data: unknown }).data };
  }

  return {
    status: response.status,
    ok: false,
    error: typeof body.error === "string" ? body.error : `The operator API refused with status ${response.status}.`,
    detail: body.detail,
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
    assertBound(env);
    const response = await env.SITE.fetch(`${env.SITE_ORIGIN}/api/health`, {
      headers: { "user-agent": USER_AGENT, "cache-control": "no-cache" },
    });
    return { status: response.status, body: await response.json().catch(() => null) };
  } catch (cause) {
    return { status: 0, body: null, error: cause instanceof Error ? cause.message : String(cause) };
  }
}
