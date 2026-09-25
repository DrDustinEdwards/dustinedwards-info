// Every write calls the same functions the browser editor's action calls; nothing here re-implements a gate.

import { DIVERGENCE_ERROR_NAME } from "~/lib/editor/converge.mjs";

import { getAdminPostRow, listPostsForOperator, listWebmentionsForAdmin } from "~/db";
import { webmentions as webmentionsTable } from "~/db/schema";
import {
  currentHead,
  deletePost,
  savePost,
  EditorError,
  GitHubError,
  PolicyError,
  type Actor,
} from "~/lib/editor/publish.server";
import { SLUG_MAX_LENGTH, SLUG_PATTERN, postPath } from "~/lib/content/slug.mjs";
import { decideMention } from "~/lib/webmention/decide.server";
import { readState } from "~/lib/editor/publish-policy.mjs";
import { readFile } from "~/lib/editor/github.server";

import type { OperatorEnv } from "./auth.server";
import type { ToolName, ToolResult } from "./descriptors";
import { backupMedia, syncAsk, syncMedia, syncPosts, syncStatus } from "./sync-tools.server";
import { uploadMediaTool } from "./upload-media.server";
import { errorMessage } from "~/lib/error-message.mjs";

// Re-exported so the routes keep one import path for the operator surface.
export { TOOL_DESCRIPTORS, isToolName, toolNames } from "./descriptors";
export { syncStatus };

// Validated like the write path: the slug goes into a repository path via `encodeURI`, which does not
// escape `.`, `/` or `?`.
function readSlug(args: Record<string, unknown>, tool: string) {
  const slug = String(args.slug ?? "").trim();
  if (!slug) return { slug: "", error: `${tool} requires a slug.` };
  if (!SLUG_PATTERN.test(slug)) {
    return { slug: "", error: `${tool} requires a lowercase kebab-case slug.` };
  }
  // The length bound too: a read must not accept a slug the write schema refuses.
  if (slug.length > SLUG_MAX_LENGTH) {
    return {
      slug: "",
      error: `${tool} requires a slug of at most ${SLUG_MAX_LENGTH} characters.`,
    };
  }
  return { slug, error: "" };
}

// Unfiltered by default: a queue that hides its failures cannot tell "nothing arrived" from "all refused".
async function listMentionsTool(
  env: OperatorEnv,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const status = typeof args.status === "string" ? args.status.trim() : "";

  // A 400, not `[]`: an agent that mistyped a status would conclude the queue was empty. Checked
  // before the read, and against the schema's own enum, so a new status cannot be refused here.
  const allowed: readonly string[] = webmentionsTable.status.enumValues;
  if (status && !allowed.includes(status)) {
    return {
      ok: false,
      status: 400,
      error: `Unknown status ${JSON.stringify(status)}. One of: ${allowed.join(", ")}.`,
    };
  }

  const rows = await listWebmentionsForAdmin(env);

  const filtered = status ? rows.filter((row) => row.status === status) : rows;

  return {
    ok: true,
    data: {
      status: status || "all",
      count: filtered.length,
      mentions: filtered.map((row) => ({
        id: row.id,
        source: row.sourceUrl,
        target: row.targetSlug,
        status: row.status,
        author: row.authorName,
        authorUrl: row.authorUrl,
        excerpt: row.excerpt,
        failureReason: row.failureReason,
        receivedAt: row.receivedAt,
        verifiedAt: row.verifiedAt,
        decidedAt: row.decidedAt,
      })),
    },
  };
}

// Calls `decideMention` only: the write and the cache purge travel together there.
async function decideMentionTool(
  env: OperatorEnv,
  actor: Actor,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const id = typeof args.id === "number" ? args.id : Number(args.id);
  if (!Number.isInteger(id) || id <= 0) {
    return {
      ok: false,
      status: 400,
      error: `decide_mention needs a positive integer id, got ${JSON.stringify(args.id)}. ` +
        `Call list_mentions for the ids.`,
    };
  }

  const decision = typeof args.decision === "string" ? args.decision.trim() : "";
  if (decision !== "approve" && decision !== "reject" && decision !== "delete") {
    return {
      ok: false,
      status: 400,
      error: `decide_mention needs a decision of approve, reject or delete, got ` +
        `${JSON.stringify(args.decision)}.`,
    };
  }

  const result = await decideMention(env, id, decision, actor);

  // `changed: false` is an answer, not a 404, so a caller does not retry something that cannot succeed.
  return {
    ok: true,
    data: {
      id,
      decision,
      changed: result.changed,
      slug: result.slug,
      purged: result.changed ? `post:${result.slug}` : null,
      // True when the page's cache purge failed: the change is stored but the page stays stale.
      purgeFailed: result.purged === false,
    },
  };
}

// Errors are translated, not thrown: a gate rejection returns its own message, field and line, so an
// agent can fix its own mistake.
export async function runTool(
  env: OperatorEnv,
  actor: Actor,
  name: ToolName,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "list_posts":
        return { ok: true, data: await listPosts(env) };
      case "get_post":
        return await getPost(env, args);
      case "save_post":
        return await savePostTool(env, actor, args);
      case "delete_post":
        return await deletePostTool(env, actor, args);
      case "sync_status":
        return { ok: true, data: await syncStatus(env) };

      case "sync_ask":
        return await syncAsk(env);

      case "sync_media":
        return await syncMedia(env);

      case "sync_posts":
        return await syncPosts(env);

      case "backup_media":
        return await backupMedia(env);

      case "upload_media":
        return await uploadMediaTool(env, args);

      case "list_mentions":
        return await listMentionsTool(env, args);

      case "decide_mention":
        return await decideMentionTool(env, actor, args);
    }
  } catch (error) {
    return translate(error);
  }
}

function translate(error: unknown): ToolResult {
  // Names the policy so a caller can branch on it rather than string-match the prose.
  if (error instanceof PolicyError) {
    return {
      ok: false,
      status: 403,
      error: error.message,
      detail: { policy: error.policy },
    };
  }

  if (error instanceof EditorError) {
    return {
      ok: false,
      status: 422,
      error: error.message,
      detail: { field: error.field ?? null, line: error.line ?? null },
    };
  }

  // A divergence means the commit LANDED, so retrying is the one thing that does not help (500: the
  // caller did nothing wrong). Matched on `name`, not `instanceof`: the module can load in two build graphs.
  if (error instanceof Error && error.name === DIVERGENCE_ERROR_NAME) {
    return {
      ok: false,
      status: 500,
      error: error.message,
      detail: { code: "d1-divergence", committed: true, retrySave: false },
    };
  }

  if (error instanceof GitHubError) {
    return {
      ok: false,
      status: error.conflict ? 409 : 502,
      error: error.message,
      detail: { conflict: Boolean(error.conflict) },
    };
  }

  // Not a recognized failure: logged with its stack, since the caller receives only the message.
  console.error("operator tool failed with an unrecognized error", error);
  return {
    ok: false,
    status: 500,
    error: errorMessage(error),
  };
}

async function listPosts(env: OperatorEnv) {
  // D1, not the repository: the rows are what the site serves.
  const rows = await listPostsForOperator(env);
  return {
    headSha: await currentHead(env),
    count: rows.length,
    posts: rows.map((p) => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      date: p.publishAt ? p.publishAt.toISOString().slice(0, 10) : null,
      publishAt: p.publishAt ? p.publishAt.toISOString() : null,
      draft: p.status === "draft",
      tags: p.tags,
      series: p.series,
      part: p.part,
      updated: p.updatedAt ? p.updatedAt.toISOString().slice(0, 10) : null,
      sourcePath: p.sourcePath,
    })),
  };
}

async function getPost(env: OperatorEnv, args: Record<string, unknown>): Promise<ToolResult> {
  const parsed = readSlug(args, "get_post");
  if (parsed.error) return { ok: false, status: 400, error: parsed.error };
  const slug = parsed.slug;

  const file = await readFile(env, postPath(slug));
  if (!file) return { ok: false, status: 404, error: `No post exists with slug "${slug}".` };
  const raw = file.content;

  const record = await getAdminPostRow(env, slug);
  const state = readState(raw);

  return {
    ok: true,
    data: {
      slug,
      raw,
      headSha: await currentHead(env),
      draft: state.draft,
      // Answered from the file, so a caller learns it before meeting a 403.
      firstPublished: state.firstPublished,
      operatorMayPublish: state.firstPublished !== null,
      html: record?.html ?? null,
      readingTimeMinutes: record?.readingTimeMinutes ?? null,
    },
  };
}

async function savePostTool(
  env: OperatorEnv,
  actor: Actor,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const parsed = readSlug(args, "save_post");
  if (parsed.error) return { ok: false, status: 400, error: parsed.error };
  const slug = parsed.slug;
  const raw = typeof args.raw === "string" ? args.raw : "";
  if (!raw.trim()) {
    return {
      ok: false,
      status: 400,
      error: "save_post requires `raw`: the complete markdown file, frontmatter included.",
    };
  }

  // No `expectedHeadSha` means unconditional, deliberately: an agent has no page to reload.
  const expectedHeadSha =
    typeof args.expectedHeadSha === "string" && args.expectedHeadSha
      ? args.expectedHeadSha
      : null;

  const existing = await readFile(env, postPath(slug));
  const isNew = args.isNew === undefined ? existing === null : args.isNew === true;

  const result = await savePost(env, { slug, raw, expectedHeadSha, isNew, actor });

  return {
    ok: true,
    data: {
      slug,
      commitSha: result.commitSha,
      created: isNew,
      draft: result.record.draft,
      published: result.published,
      firstPublished: result.firstPublished,
      // The AI index cannot fail a save, so its outcome is reported rather than raised.
      askSync: result.askSync,
      purged: result.purged,
    },
  };
}

async function deletePostTool(
  env: OperatorEnv,
  actor: Actor,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const parsed = readSlug(args, "delete_post");
  if (parsed.error) return { ok: false, status: 400, error: parsed.error };
  const slug = parsed.slug;

  const result = await deletePost(env, {
    slug,
    expectedHeadSha:
      typeof args.expectedHeadSha === "string" && args.expectedHeadSha
        ? args.expectedHeadSha
        : null,
    actor,
  });

  return {
    ok: true,
    data: {
      slug,
      commitSha: result.commitSha,
      purged: result.purged,
      askRemoval: result.askRemoval,
    },
  };
}
