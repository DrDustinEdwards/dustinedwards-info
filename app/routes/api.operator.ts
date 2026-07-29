import { getEnv } from "~/lib/context";
import { authenticateOperator } from "~/lib/operator/auth.server";
import { isToolName, runTool, toolNames } from "~/lib/operator/api.server";

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
      tools: [
        {
          name: "list_posts",
          args: {},
          returns: "Every post in the committed artifact, with the head sha.",
        },
        {
          name: "get_post",
          args: { slug: "string" },
          returns:
            "The complete markdown file, the head sha, and operatorMayPublish.",
        },
        {
          name: "save_post",
          args: {
            slug: "string",
            raw: "string, the complete markdown file including frontmatter",
            expectedHeadSha: "string, optional, for editor-style conflict detection",
            isNew: "boolean, optional, inferred from whether the file exists",
          },
          returns: "commitSha, and the gate's own message with field and line on rejection.",
          policy:
            "An operator may create, edit, unpublish and republish. It may NOT " +
            "perform a post's first transition to draft:false; that is reserved " +
            "to the human admin and is refused with 403 " +
            "first-publish-requires-admin.",
        },
        { name: "delete_post", args: { slug: "string" }, returns: "commitSha." },
        {
          name: "sync_status",
          args: {},
          returns: "Artifact, D1 and search index counts, reported separately.",
        },
      ],
    },
  });
}
