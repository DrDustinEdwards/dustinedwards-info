import { getEnv } from "~/lib/context";
import { authenticateOperator, meterOperator } from "~/lib/operator/auth.server";
import { TOOL_DESCRIPTORS, isToolName, runTool, toolNames } from "~/lib/operator/api.server";

import type { Route } from "./+types/api.operator";

/**
 * The operator publish endpoint.
 *
 * A RESOURCE ROUTE, no default export, so the action can return a raw Response.
 * A document route's loader hands its return value to a component and 500s on
 * the first property read; the same reason /search/ask and the markdown twins
 * are resource routes.
 *
 * One POST endpoint taking `{ tool, args }` rather than five REST paths. The
 * shape is chosen so an MCP front end can be layered over it later without
 * reshaping anything: `tools/call` carries exactly a name and an argument
 * object. Decided 2026-07-28 to build this first and MCP after, because the MCP
 * spec shipped a breaking revision that same day and the recova precedent has
 * its MCP tools calling an operator HTTP API rather than a database.
 */

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      // Never cached and never indexed. It is a write endpoint behind a secret.
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      ...headers,
    },
  });

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Use POST." }, 405, { allow: "POST" });
  }

  const env = getEnv(context) as Parameters<typeof authenticateOperator>[0];

  const auth = await authenticateOperator(env, request);
  if (!auth.ok) {
    return json(
      { ok: false, error: auth.error },
      auth.status,
      auth.retryAfter ? { "retry-after": String(auth.retryAfter) } : {},
    );
  }

  /*
   * METERED HERE, because this is the call that does something. Authentication
   * and metering split on 2026-08-28; grounds on `meterOperator`. Immediately
   * after the identity is proven, so the limiter is keyed to a real operator
   * and an unauthenticated flood cannot reach a Durable Object.
   */
  const metered = await meterOperator(env, auth.id);
  if (!metered.ok) {
    return json(
      { ok: false, error: metered.error },
      metered.status,
      metered.retryAfter ? { "retry-after": String(metered.retryAfter) } : {},
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Body must be JSON." }, 400);
  }

  const { tool, args } = (body ?? {}) as { tool?: unknown; args?: unknown };

  if (!isToolName(tool)) {
    return json(
      {
        ok: false,
        error: `Unknown tool. Available: ${toolNames().join(", ")}.`,
      },
      400,
    );
  }

  const result = await runTool(
    env,
    { kind: "operator", id: auth.id },
    tool,
    (args ?? {}) as Record<string, unknown>,
  );

  if (!result.ok) {
    return json({ ok: false, error: result.error, detail: result.detail }, result.status);
  }
  return json({ ok: true, data: result.data });
}

/**
 * GET describes the tools, behind the same token.
 *
 * It is a convenience for a caller wiring itself up, and it is authenticated
 * like everything else: an unauthenticated caller learns nothing, including
 * whether the endpoint exists in a useful form.
 *
 * IT SPENDS NO RATE LIMIT, since 2026-08-28. Metering used to live inside
 * `authenticateOperator`, so describing the surface cost the same unit as
 * publishing to it: a client that read the description before each publish
 * halved its own allowance, and one that polled the description could exhaust
 * it without ever writing anything. This call takes no arguments and changes
 * nothing, so it authenticates and stops there.
 *
 * DERIVED from `TOOL_DESCRIPTORS`, never written here. This loader used to
 * carry its own copy of the list and the copy drifted exactly as rule 17 says
 * a second copy does: `sync_ask` and `sync_media` were callable and ship
 * called both, while the description a caller reads named neither. The table
 * is keyed by `ToolName`, so a tool this list omits is a typecheck failure in
 * `api.server.ts`, not a silent gap on the wire.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context) as Parameters<typeof authenticateOperator>[0];
  const auth = await authenticateOperator(env, request);
  if (!auth.ok) {
    return json(
      { ok: false, error: auth.error },
      auth.status,
      auth.retryAfter ? { "retry-after": String(auth.retryAfter) } : {},
    );
  }

  return json({
    ok: true,
    data: {
      operator: auth.id,
      tools: toolNames().map((name) => ({ name, ...TOOL_DESCRIPTORS[name] })),
    },
  });
}
