import { getEnv } from "~/lib/context";
import { authenticateOperator, meterOperator } from "~/lib/operator/auth.server";
import { TOOL_DESCRIPTORS, isToolName, runTool, toolNames } from "~/lib/operator/api.server";

import type { Route } from "./+types/api.operator";

/**
 * The operator publish endpoint.
 *
 * A RESOURCE ROUTE, no default export, so the action can return a raw Response. A document route's
 * loader hands its return value to a component and 500s on the first property read; the same reason
 * /search/ask and the markdown twins are resource routes.
 *
 * One POST endpoint taking `{ tool, args }` rather than five REST paths, so an MCP front end can be
 * layered over it later without reshaping anything: `tools/call` carries exactly a name and an
 * argument object.
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
   * METERED HERE, because this is the call that does something, and immediately after the identity is
   * proven, so the limiter is keyed to a real operator and an unauthenticated flood cannot reach a
   * Durable Object. Grounds on `meterOperator`.
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
 * GET describes the tools, behind the same token: an unauthenticated caller learns nothing,
 * including whether the endpoint exists in a useful form.
 *
 * IT SPENDS NO RATE LIMIT. This call takes no arguments and changes nothing, so it authenticates and
 * stops there. Metering it meant a client that read the description before each publish halved its
 * own allowance.
 *
 * DERIVED from `TOOL_DESCRIPTORS`, never written here. A local copy of the list drifted exactly as
 * rule 17 says a second copy does, leaving tools callable that the description named nowhere. The
 * table is keyed by `ToolName`, so a tool this list omits is a typecheck failure in `api.server.ts`,
 * not a silent gap on the wire.
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
