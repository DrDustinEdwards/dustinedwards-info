/**
 * CLIENT LEG identity helpers: who is operating.
 *
 * Distinct from the API leg in src/api-client.ts, which is what this Worker may
 * do. Keeping them in separate files is deliberate, because conflating them is
 * the mistake the house standard names explicitly: a client-leg identity failure
 * and an API refusal mean different things and must read differently.
 *
 * Agent keys (ruling 37) are site-runtime's ./agent-keys: one AGENT_KEY_<NAME> secret per
 * agent, the principal taken from the secret's name, compared in constant time, failing closed.
 */

import { mcpScopes } from "@dustinedwards/site-runtime/mcp-server";

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
  | { kind: "agent"; principal: string; scopes: readonly string[] }
  /** The list-only test key (index.ts, site-runtime probeDoor): listed the read tools, refused every call. */
  | { kind: "probe"; principal: string; scopes: readonly string[] };
