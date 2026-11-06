/**
 * CLIENT LEG identity helpers: who is operating.
 *
 * Distinct from the API leg in src/api-client.ts, which is what this Worker may do. Keeping them in separate files is
 * deliberate, because conflating them is the mistake the house standard names explicitly: a client-leg identity failure
 * and an API refusal mean different things and must read differently.
 *
 * Who the caller is, is settled by site-runtime's admin MCP door (index.ts) and never read from the request. Agent keys
 * (ruling 37) are site-runtime's ./agent-keys: one AGENT_KEY_<NAME> secret per agent, the principal taken from the
 * secret's name, compared in constant time, failing closed.
 */

import { mcpScopes, type McpCaller } from "@dustinedwards/site-runtime/mcp-server";

/**
 * LEAST SCOPE FIRST. Ruling mcp-2026-10-10, rule 12.3.
 *
 * Read is what every connection gets. Write is ticked on the consent page, or named for an agent in AGENT_WRITE, and
 * only then do the tools that change the site run. There is no admin scope here because this Worker has no admin
 * rights to give: the operator API grants OPERATOR_TOKEN the operator kind.
 */
export const SCOPES = mcpScopes("dei");
export const SCOPE_READ = SCOPES.read;
export const SCOPE_WRITE = SCOPES.write;
export type Scope = typeof SCOPE_READ | typeof SCOPE_WRITE;

/**
 * Who is making one tool call, as the door established it: the administrator (a grant's props, re-admitted on every
 * request), an agent (the principal a configured secret's NAME produced), or the list-only test key (listed the read
 * tools, refused every call). Never read from the request.
 */
export type Caller = McpCaller;
