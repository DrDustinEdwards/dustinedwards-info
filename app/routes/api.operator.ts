import { getEnv } from "~/lib/context";
import { authenticateOperator, meterOperator } from "~/lib/operator/auth.server";
import { TOOL_DESCRIPTORS, isToolName, runTool, toolNames } from "~/lib/operator/api.server";

import type { Route } from "./+types/api.operator";

/**
 * A resource route, so the action can return a raw Response. One POST taking `{ tool, args }`, so an
 * MCP front end maps onto it: `tools/call` carries a name and an argument object.
 */

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex, nofollow",
      ...headers,
    },
  });

/** A refused identity or allowance, with its Retry-After when the refusal is a rate limit. */
const refusal = (outcome: { error: string; status: number; retryAfter?: number }) =>
  json(
    { ok: false, error: outcome.error },
    outcome.status,
    outcome.retryAfter ? { "retry-after": String(outcome.retryAfter) } : {},
  );

export async function action({ request, context }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Use POST." }, 405, { allow: "POST" });
  }

  const env = getEnv(context) as Parameters<typeof authenticateOperator>[0];

  const auth = await authenticateOperator(env, request);
  if (!auth.ok) {
    return refusal(auth);
  }

  /* Metered right after identity is proven, so an unauthenticated flood never reaches the Durable Object. */
  const metered = await meterOperator(env, auth.id);
  if (!metered.ok) {
    return refusal(metered);
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
 * Behind the same token: an unauthenticated caller learns nothing. No rate limit: it changes nothing,
 * and a client reading it before each publish would halve its own allowance.
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context) as Parameters<typeof authenticateOperator>[0];
  const auth = await authenticateOperator(env, request);
  if (!auth.ok) {
    return refusal(auth);
  }

  return json({
    ok: true,
    data: {
      operator: auth.id,
      tools: toolNames().map((name) => ({ name, ...TOOL_DESCRIPTORS[name] })),
    },
  });
}
