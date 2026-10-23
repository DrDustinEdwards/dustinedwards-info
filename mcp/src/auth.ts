/**
 * CLIENT LEG identity helpers: who is operating.
 *
 * Distinct from the API leg in src/api-client.ts, which is what this Worker may
 * do. Keeping them in separate files is deliberate, because conflating them is
 * the mistake the house standard names explicitly: a client-leg identity failure
 * and an API refusal mean different things and must read differently.
 *
 * Free of MCP and OAuth imports so the grant logic is testable on its own.
 */

import { safeEqual } from "@dustinedwards/site-runtime/compare";
import { authorizeCall as checkCall, mcpScopes } from "@dustinedwards/site-runtime/mcp-server";

/** The Cloudflare Access identity carried on an OAuth grant, set at sign-in. */
export interface Props extends Record<string, unknown> {
  /** The verified email from the Access ID token. */
  email: string;
  /**
   * The scopes the administrator granted on the consent page. A grant minted
   * before scopes existed has none, and is read-only until it is renewed.
   */
  scopes?: string[];
}

/**
 * LEAST SCOPE FIRST. Ruling mcp-2026-10-10, rule 12.3.
 *
 * Read is what every connection gets. Write is ticked on the consent page, or
 * named for an agent in AGENT_WRITE, and only then do the tools that change the
 * site run. There is no admin scope here because this Worker has no admin
 * rights to give: the operator API grants OPERATOR_TOKEN the operator kind.
 */
export const SCOPES = mcpScopes("dei");
export const SCOPE_READ = SCOPES.read;
export const SCOPE_WRITE = SCOPES.write;
export type Scope = typeof SCOPE_READ | typeof SCOPE_WRITE;

/**
 * Who is making one tool call, as the request boundary established it.
 *
 * `admin` carries the grant's props so every call can re-run isAdminUser
 * against them; `agent` carries the principal a configured secret's NAME
 * produced. Neither is ever read from the request.
 */
export type Caller =
  | { kind: "admin"; props: Props; scopes: readonly string[] }
  | { kind: "agent"; principal: string; scopes: readonly string[] };

export { callerName } from "@dustinedwards/site-runtime/mcp-server";

/** Scopes an agent holds: read, plus write when AGENT_WRITE names it. */
export function agentScopes(env: { AGENT_WRITE?: string }, principal: string): string[] {
  const writers = (env.AGENT_WRITE ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  return writers.includes(principal) ? [SCOPE_READ, SCOPE_WRITE] : [SCOPE_READ];
}

/**
 * THE PER-CALL OWNERSHIP CHECK. Ruling mcp-2026-10-10, rule 12.1.
 *
 * Every id a tool takes (a mention id, a procedure slug, a registry address)
 * names a record on dustinedwards.info, and the owner of every one of them is
 * the site's single administrator. So proving the caller owns the id is proving
 * the caller IS that administrator, or an agent the administrator configured,
 * and it is proved here on every call rather than once at the door: a grant is
 * long lived, and the door check alone would let a grant outlive its authority.
 *
 * Returns null when the call may proceed, or the refusal to show the caller.
 */
export function authorizeCall(env: { ADMIN_EMAIL?: string }, caller: Caller | undefined, scope: Scope): string | null {
  return checkCall(env, caller, scope, { site: "dustinedwards.info", scopes: SCOPES });
}

/**
 * The prefix that makes a secret an agent key. Ruling 37.
 *
 * ONE SECRET PER AGENT, and the agent's NAME is the part after this prefix.
 * `AGENT_KEY_GROK` is the key for the principal `grok`. That is what makes the
 * principal impossible to spoof: it is not carried in the request, it is a
 * property of WHICH configured secret the presented key matched, so a caller
 * can prove it holds a key and can never choose what it is called.
 *
 * A single secret holding a JSON map was the alternative and is worse in the
 * way that matters: rotating one agent would rewrite every agent's key, and one
 * malformed edit would take all of them out at once.
 */
const AGENT_KEY_PREFIX = "AGENT_KEY_";

/**
 * Which agent, if any, presented this Authorization header.
 *
 * ## WHY THIS PATH EXISTS AT ALL. Ruling 37, 2026-09-07.
 *
 * Measured across four conditions: Grok Build 1.0.13 POSTs /mcp, receives a
 * well-formed 401 naming a path-scoped PRM that answers 200, and then walks
 * nothing. No discovery, no /register, no /authorize. The defect is the
 * client's and a bug report went upstream, but an agent that cannot complete
 * OAuth cannot reach this server at all, and waiting on somebody else's release
 * is not a plan.
 *
 * ## WHAT IT DOES NOT WIDEN
 *
 * NOT ADMIN, EVER, and that needs no enforcement here because this Worker has
 * no admin rights to hand out. Every tool call leaves as one authenticated
 * request to the operator API carrying `OPERATOR_TOKEN`, and the API grants
 * that token `{ kind: "operator" }`. First publication is refused there, by
 * `firstPublish: false` on that actor kind. So an agent key buys exactly what
 * the OAuth path buys and nothing more: it changes WHO MAY ASK, never what the
 * answer is. This wrapper still contains no policy.
 *
 * ## FAILS CLOSED IN EVERY DIRECTION
 *
 * No configured keys admits nobody. A blank or whitespace-only key is skipped
 * rather than matched, so a secret set to the empty string cannot become a
 * master key. A malformed header returns null. Every candidate goes through
 * the shared `safeEqual`, which hashes both sides to a fixed 32 bytes first.
 *
 * EVERY KEY IS COMPARED, with no early exit on a match, so the time taken does
 * not depend on which key matched or how far down the list it sat.
 *
 * @param env the Worker environment, read for `AGENT_KEY_*` secrets
 * @param authorization the raw Authorization header, or null
 * @returns the agent principal in lower case, or null
 */
export async function agentPrincipal(
  env: Record<string, unknown>,
  authorization: string | null,
): Promise<string | null> {
  if (!authorization) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!match) return null;
  const presented = match[1]!.trim();
  if (!presented) return null;

  let found: string | null = null;
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith(AGENT_KEY_PREFIX)) continue;
    if (typeof value !== "string" || !value.trim()) continue;
    // No early exit: see the constant-time note above.
    if (await safeEqual(presented, value)) {
      found = name.slice(AGENT_KEY_PREFIX.length).toLowerCase();
    }
  }
  return found;
}
