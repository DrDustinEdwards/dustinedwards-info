/**
 * The operator publish tools.
 *
 * Every write here calls the SAME functions the browser editor's action calls:
 * `savePost` and `deletePost` in publish.server.ts. Nothing in this file talks
 * to GitHub, to D1, or to the AI index directly, and nothing here re-implements
 * a gate. That is the ruling of 2026-07-28, and it is the reason the refactor
 * this session expected turned out to be unnecessary: `savePost(env, options)`
 * already took a plain env and options rather than a Request, so the editor
 * action was already a thin adapter over a callable module.
 *
 * The read tools go through the artifact and D1 the same way the admin list
 * does, so an operator sees what the editor sees.
 */

import { count } from "drizzle-orm";

import { getDb, publiclyVisible } from "~/db/index";
import { posts as postsTable } from "~/db/schema";
import {
  currentHead,
  deletePost,
  loadArtifact,
  savePost,
  EditorError,
  GitHubError,
  PolicyError,
  type Actor,
} from "~/lib/editor/publish.server";
import { SLUG_PATTERN } from "~/lib/content/pipeline.mjs";
import { readState } from "~/lib/editor/publish-policy.mjs";
import { askAvailable } from "~/lib/search/ask.server";
import { readFile } from "~/lib/editor/github.server";


import type { OperatorEnv } from "./auth.server";

/**
 * A slug, validated against the SAME predicate the write path enforces.
 *
 * Every one of these values is interpolated into `content/posts/<slug>.md` and
 * handed to the GitHub contents API, which builds its URL with `encodeURI`.
 * `encodeURI` does NOT escape `.`, `/` or `?`, so `../../../../user?` walks out
 * of the posts directory and truncates the rest into a query string, on a
 * request that carries the GITHUB_TOKEN bearer header.
 *
 * The WRITE path was always safe: renderPost requires the frontmatter slug to
 * equal the expected one and the schema pins it to kebab-case. The READ paths
 * had no such check and ran first. Found by the external audit of 2026-08-11.
 *
 * SLUG_PATTERN is imported rather than restated, so there is one statement of
 * the rule and not a copy that can drift from the schema's.
 */
function readSlug(args: Record<string, unknown>, tool: string) {
  const slug = String(args.slug ?? "").trim();
  if (!slug) return { slug: "", error: `${tool} requires a slug.` };
  if (!SLUG_PATTERN.test(slug)) {
    return { slug: "", error: `${tool} requires a lowercase kebab-case slug.` };
  }
  return { slug, error: "" };
}

export type ToolResult =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string; detail?: unknown };

const TOOLS = [
  "list_posts",
  "get_post",
  "save_post",
  "delete_post",
  "sync_status",
] as const;

export type ToolName = (typeof TOOLS)[number];

export function isToolName(value: unknown): value is ToolName {
  return typeof value === "string" && (TOOLS as readonly string[]).includes(value);
}

export function toolNames(): readonly string[] {
  return TOOLS;
}

/**
 * Runs one tool.
 *
 * Errors are TRANSLATED here rather than thrown, and the translation is the
 * contract: a gate rejection returns the gate's own message with the field and
 * line it named, verbatim. An agent that gets "invalid frontmatter" and nothing
 * else cannot fix its own mistake, and the whole point of exposing this path is
 * that the caller can.
 */
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
    }
  } catch (error) {
    return translate(error);
  }
}

function translate(error: unknown): ToolResult {
  // Policy refusal. 403, and it names the policy so a caller can branch on it
  // rather than string-matching the prose.
  if (error instanceof PolicyError) {
    return {
      ok: false,
      status: 403,
      error: error.message,
      detail: { policy: error.policy },
    };
  }

  // A content gate. The field and line are the useful part.
  if (error instanceof EditorError) {
    return {
      ok: false,
      status: 422,
      error: error.message,
      detail: { field: error.field ?? null, line: error.line ?? null },
    };
  }

  // A conflict means main moved under the caller. Retryable after a re-read.
  if (error instanceof GitHubError) {
    return {
      ok: false,
      status: error.conflict ? 409 : 502,
      error: error.message,
      detail: { conflict: Boolean(error.conflict) },
    };
  }

  return {
    ok: false,
    status: 500,
    error: error instanceof Error ? error.message : String(error),
  };
}

async function listPosts(env: OperatorEnv) {
  const posts = await loadArtifact(env);
  return {
    headSha: await currentHead(env),
    count: posts.length,
    posts: posts.map((p: any) => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      date: p.date,
      publishAt: p.publishAt,
      draft: p.draft,
      tags: p.tags,
      series: p.series,
      part: p.part,
      updated: p.updated,
      sourcePath: p.sourcePath,
    })),
  };
}

async function getPost(env: OperatorEnv, args: Record<string, unknown>): Promise<ToolResult> {
  const parsed = readSlug(args, "get_post");
  if (parsed.error) return { ok: false, status: 400, error: parsed.error };
  const slug = parsed.slug;

  const file = await readFile(env, `content/posts/${slug}.md`);
  if (!file) return { ok: false, status: 404, error: `No post exists with slug "${slug}".` };
  const raw = file.content;

  const posts = await loadArtifact(env);
  const record = posts.find((p: any) => p.slug === slug) ?? null;
  const state = readState(raw);

  return {
    ok: true,
    data: {
      slug,
      // The full file, so a caller can edit and send it straight back.
      raw,
      headSha: await currentHead(env),
      draft: state.draft,
      // Whether an operator may publish this post is a question about the FILE,
      // so it is answered from the file and reported rather than left to be
      // discovered by a 403.
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

  // Absent expectedHeadSha the save is unconditional. That is a deliberate
  // choice for a non-browser caller: it has no page to reload, and forcing it
  // to read-then-write would make every agent save a two-call dance. A caller
  // that wants the editor's conflict semantics passes the sha from get_post.
  const expectedHeadSha =
    typeof args.expectedHeadSha === "string" && args.expectedHeadSha
      ? args.expectedHeadSha
      : null;

  const existing = await readFile(env, `content/posts/${slug}.md`);
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
      // The AI index cannot fail a save, so its outcome is reported rather than
      // raised. A caller that ignores this still got a correct save.
      askSync: result.askSync,
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
    data: { slug, commitSha: result.commitSha, askRemoved: result.askRemoved },
  };
}

/**
 * What the operator can see about the state of the pipeline without guessing.
 *
 * Deliberately reports the three stores separately, because they can disagree
 * and the whole design assumes they fail independently.
 */
async function syncStatus(env: OperatorEnv) {
  const artifactPosts = await loadArtifact(env);

  // Counted through DRIZZLE, not by interpolating publiclyVisible() into a
  // template string. It returns a Drizzle expression object, so interpolation
  // stringifies it to "[object Object]" and D1 answers
  //   no such column: object Object at offset 38
  // on every call. That is how this shipped: locally the tool failed earlier,
  // at the missing GITHUB_TOKEN, and never reached the query. Found by the live
  // round trip, which is the only place it could have been found.
  //
  // Hard rule 1 is why the predicate is reused rather than rewritten in SQL:
  // every public read composes publiclyVisible(), and a hand-copied WHERE
  // clause here would be exactly the drift that rule exists to prevent.
  const db = getDb(env);
  const totalRow = await db.select({ n: count() }).from(postsTable).get();
  const visibleRow = await db
    .select({ n: count() })
    .from(postsTable)
    .where(publiclyVisible())
    .get();

  const indexed = await env.DB
    .prepare("SELECT COUNT(*) AS n FROM search_identity_docsize")
    .first<{ n: number }>();

  return {
    headSha: await currentHead(env),
    artifactPosts: artifactPosts.length,
    d1Posts: totalRow?.n ?? 0,
    d1PubliclyVisible: visibleRow?.n ?? 0,
    // Counted on the docsize shadow table, never COUNT(*) on the index itself:
    // that reads THROUGH to search_docs and can never detect drift.
    searchIndexDocs: indexed?.n ?? 0,
    askConfigured: askAvailable(env),
    githubConfigured: Boolean(env.GITHUB_TOKEN),
  };
}
