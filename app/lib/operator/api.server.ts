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
 * The read tools go through D1 and per-file repository reads the same way the
 * admin surfaces do, so an operator sees what the editor sees.
 */

import { DIVERGENCE_ERROR_NAME } from "~/lib/editor/converge.mjs";
import { listDivergences } from "~/lib/editor/divergence.server";
import { count } from "drizzle-orm";

import {
  getAdminPostRow,
  getDb,
  listPostsForOperator,
  publiclyVisible,
} from "~/db/index";
import { posts as postsTable } from "~/db/schema";
import {
  currentHead,
  deletePost,
  deletePostFromD1,
  renderAndWrite,
  savePost,
  EditorError,
  GitHubError,
  PolicyError,
  type Actor,
} from "~/lib/editor/publish.server";
import { postPath } from "~/lib/content/pipeline.mjs";
import { SLUG_PATTERN } from "~/lib/content/pipeline.mjs";
import { listWebmentionsForAdmin } from "~/db";
import { decideMention } from "~/lib/webmention/decide.server";
import { readState } from "~/lib/editor/publish-policy.mjs";
import {
  askAvailable,
  askIndexStatus,
  pruneAskCorpus,
  syncAskCorpus,
} from "~/lib/search/ask.server";
import { askSyncReport, mediaSyncReport } from "./sync-report.mjs";
import { mediaIndexStatus, rebuildMediaIndex } from "~/lib/media/rebuild.server";
import { copyMissingTwins } from "~/lib/media/backup.server";
import { listDirectory, readFile } from "~/lib/editor/github.server";
import { contentDriftCompare } from "~/lib/health/verdicts.mjs";


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
  "sync_ask",
  "sync_media",
  "sync_posts",
  "backup_media",
  "list_mentions",
  "decide_mention",
] as const;

export type ToolName = (typeof TOOLS)[number];

export function isToolName(value: unknown): value is ToolName {
  return typeof value === "string" && (TOOLS as readonly string[]).includes(value);
}

export function toolNames(): readonly ToolName[] {
  return TOOLS;
}

/**
 * What GET /api/operator says about each tool, beside the dispatch that runs it.
 *
 * KEYED BY `ToolName`, the `WRITE_CAPABILITIES` idiom (hard rule 13): a tool
 * added to `TOOLS` without a descriptor is a TYPECHECK failure, and a
 * descriptor for a tool that does not exist is one too, so the self-description
 * cannot drift from the dispatch in either direction.
 *
 * MOVED HERE 2026-08-25 because the route carried a hand-written copy of this
 * list and it had already drifted the way a second copy does: `sync_ask` and
 * `sync_media` were callable, ship called both on every run, and the
 * description a caller wires itself up from named neither. Rule 17: the
 * dispatch below is the fact, this table is bound to it by the key, and the
 * route renders what it is handed.
 */
export const TOOL_DESCRIPTORS: Readonly<
  Record<ToolName, { args: Record<string, string>; returns: string; policy?: string }>
> = {
  list_posts: {
    args: {},
    returns:
      "Every post row in D1, drafts included, with the head sha. `updated` " +
      "is the revision date the row carries.",
  },
  get_post: {
    args: { slug: "string" },
    returns: "The complete markdown file, the head sha, and operatorMayPublish.",
  },
  save_post: {
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
  delete_post: {
    args: { slug: "string" },
    returns: "commitSha.",
    policy:
      "Deleting a post is reserved to the human admin and is refused with " +
      "403 delete-requires-admin. Unpublish instead (draft: true).",
  },
  sync_status: {
    args: {},
    returns: "Repository, D1 and search index counts, reported separately.",
  },
  sync_ask: {
    args: {},
    returns:
      "Uploads the full corpus to the Ask index and prunes strays. Idempotent. " +
      "expected, present, drift and a converged verdict, all read back after " +
      "the writes rather than taken from the upload's own counters.",
  },
  sync_media: {
    args: {},
    returns:
      "Rebuilds the media index from R2 and the asset manifest, through the " +
      "same derivation the admin button runs. Idempotent. A read-back " +
      "reconciliation: expected, present, missing and extra keys, and a " +
      "converged verdict.",
  },
  sync_posts: {
    args: {},
    returns:
      "Converges D1 to the repository's markdown: re-renders every post " +
      "whose file's blob sha differs from its row (or has no row), removes " +
      "rows whose file is gone, all through the same render door a save " +
      "uses. Idempotent. A read-back reconciliation: expected, present, and " +
      "a converged verdict.",
  },
  list_mentions: {
    args: { status: "string, optional: unverified, pending, approved, rejected or failed" },
    returns:
      "Received webmentions, newest first, with id, source, target slug, status, " +
      "author, excerpt and the received, verified and decided timestamps. " +
      "Unfiltered when no status is given, which is what the moderation queue " +
      "shows.",
  },
  decide_mention: {
    args: {
      id: "number, the mention row id from list_mentions",
      decision: "string: approve, reject or delete",
    },
    returns:
      "changed, and the target slug when a row moved. Approving or rejecting " +
      "PURGES that post's cached page, so the change reaches readers on the " +
      "next fetch rather than within the ten minute shared-cache lifetime.",
    policy:
      "Approve and reject need write and are reversible. DELETE is refused " +
      "with 403 mention-delete-requires-admin: it removes the only copy of " +
      "what a stranger sent, and there is no repository behind this table. " +
      "Reject instead.",
  },
  backup_media: {
    args: {},
    returns:
      "Copies every MEDIA object that has no byte-identical twin into " +
      "MEDIA_BACKUP. COPIES ONLY: it has no delete branch in either bucket, " +
      "and nothing is ever copied backup to media. Idempotent. A read-back " +
      "reconciliation: objects, twins, missing and mismatched, counted after " +
      "the writes rather than from the loop's own counters.",
  },
};

/**
 * The moderation queue, over the operator token.
 *
 * WHY THE OPERATOR GETS THIS AT ALL. Approving a mention was the one step in
 * the webmention path that needed a human with a browser, and it was proven on
 * 2026-09-05 by asking Dustin to click a button so a purge could be measured.
 * A step that can only be taken by hand is a step that gets taken late, and
 * this is a moderation queue whose whole value is being read.
 *
 * UNFILTERED BY DEFAULT, which is what `/admin/mentions` shows and for the same
 * reason: an operator triaging a queue has to see the failures as well as the
 * pending rows, or it cannot tell "nothing arrived" from "everything was
 * refused".
 *
 * READS THROUGH THE SAME FUNCTION THE ADMIN PAGE READS. The status filter is
 * applied here rather than in a second query, so there is one statement of what
 * the queue IS and this cannot come to disagree with the page about it. The
 * table is bounded by the endpoint's open-queue cap plus whatever has been
 * approved, so filtering in memory costs nothing worth a second query shape.
 */
async function listMentionsTool(
  env: OperatorEnv,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const status = typeof args.status === "string" ? args.status.trim() : "";

  const rows = await listWebmentionsForAdmin(env as unknown as Env);

  if (status) {
    /*
     * A STATUS THE COLUMN CANNOT HOLD IS A 400, not an empty list. An agent
     * that typed `pendign` and got `[]` would conclude the queue was empty,
     * which is the wrong repair and is indistinguishable from the right one.
     * The set is the schema's CHECK constraint, stated here because a caller
     * needs to be told what it may ask for.
     */
    const allowed = ["unverified", "pending", "approved", "rejected", "failed"];
    if (!allowed.includes(status)) {
      return {
        ok: false,
        status: 400,
        error: `Unknown status ${JSON.stringify(status)}. One of: ${allowed.join(", ")}.`,
      };
    }
  }

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

/**
 * Approve, reject or delete one mention, and purge the page it changed.
 *
 * IT CALLS `decideMention` AND NOTHING ELSE, which is the point of that
 * function existing. The write and the purge travel together there, so this
 * cannot ship the half that changes the database without the half that makes
 * the change visible. The admin page's action calls the same door.
 *
 * THE CAPABILITY CHECK IS INSIDE THAT DOOR TOO, reading `WRITE_CAPABILITIES`,
 * so the refusal is the same one whichever caller asks. An operator may
 * approve and reject and may not delete, which is `delete_post`'s shape and
 * `delete_post`'s reason: this removes the only copy of what a stranger sent.
 */
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

  const result = await decideMention(env as unknown as Env, id, decision, actor);

  /*
   * `changed: false` IS A REAL ANSWER AND NOT AN ERROR. The row may not exist,
   * or may be `unverified` or `failed`, which the DB layer's `where` refuses
   * because neither has evidence to approve. Reporting that as a 404 would make
   * a caller retry something that will never succeed; reporting it as success
   * with `changed: false` tells it what happened.
   */
  return {
    ok: true,
    data: {
      id,
      decision,
      changed: result.changed,
      slug: result.slug,
      purged: result.changed ? `post:${result.slug}` : null,
    },
  };
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

      case "sync_ask":
        return await syncAsk(env);

      case "sync_media":
        return await syncMedia(env);

      case "sync_posts":
        return await syncPosts(env);

      case "backup_media":
        return await backupMedia(env);

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
  /*
   * DIVERGENCE IS ITS OWN BRANCH, ahead of the generic 500.
   *
   * It is distinguishable from the three failures above in the way that
   * matters to a caller: a PolicyError (403) and an EditorError (422) both mean
   * NOTHING HAPPENED and the request should be corrected and retried. A
   * GitHubError (409/502) means nothing was committed. This one means the
   * OPPOSITE: the commit landed, the writing is safe, and retrying is the one
   * response that does not help.
   *
   * Matched on `name` rather than `instanceof`, because the error is
   * constructed in a `.mjs` module and a cross-module identity check through
   * two build graphs holds only until something duplicates the module.
   *
   * 500 rather than a 4xx: the caller did nothing wrong. Not 502, which this
   * file already uses for GitHub, because the upstream that failed is ours.
   * `detail.code` is the machine-readable half so a client can branch without
   * parsing prose.
   */
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

  return {
    ok: false,
    status: 500,
    error: error instanceof Error ? error.message : String(error),
  };
}

async function listPosts(env: OperatorEnv) {
  /*
   * D1, not the repository, since the artifact arc: the rows are what the
   * site serves, they converge to the repo (rule 18, held by the
   * content-drift health check), and a listing that needed no GitHub call
   * before needs none now. Field names are the tool's contract and are
   * unchanged; `date` derives from publishAt and `updated` is the revision
   * date, both of which is what they always meant.
   */
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

  // The rendered half comes from the D1 row: the one rendered copy there is.
  const record = await getAdminPostRow(env, slug);
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
 * THE FULL-CORPUS ASK UPLOAD, as an operator operation.
 *
 * ## Why this exists at all
 *
 * `savePost` keeps Ask in step for a post published THROUGH the editor. Nothing
 * kept it in step for a post published by COMMIT, which is how most of this
 * site's writing lands: `ship` runs `sync:content`, which rebuilds D1 and both
 * FTS indexes and does not touch AI Search. So every git-authored change left
 * the answer index behind, silently, until somebody read an alert.
 *
 * Measured 2026-08-23: the scheduled health check went red four polls running
 * with `expected 91, present 90`, and shipping nine post updates widened it to
 * `expected 99, present 90`, tracking `search_docs` growth exactly. The repair
 * was a human clicking sync-ask in the admin, which is a step nobody is holding.
 *
 * ## IDEMPOTENT, and that is what makes it safe as a pipeline step
 *
 * The upload writes every record under a key derived from its URL, so running
 * it twice writes the same keys with the same content; the prune then removes
 * anything in the index that the corpus no longer names. Running it when there
 * is nothing to do is a no-op that costs a listing.
 *
 * ## THE COUNTS ARE READ BACK, NOT ACCUMULATED
 *
 * `uploaded` is what the loop thinks it wrote. `expected` and `present` come
 * from D1 and from AI Search AFTERWARDS, and `converged` is derived from those
 * two. A caller cannot be told this succeeded by an operation that merely ran.
 */
async function syncAsk(env: OperatorEnv): Promise<ToolResult> {
  if (!askAvailable(env)) {
    // Same stance the Ask endpoint takes: absent binding means the feature is
    // not here, rather than here and broken.
    return { ok: false, status: 404, error: "Ask is not enabled on this deployment." };
  }

  const { uploaded, keys, cacheDropped } = await syncAskCorpus(env);
  const removed = await pruneAskCorpus(env, keys);

  /*
   * READ BACK AFTER BOTH WRITES. Between the upload and this read the index is
   * eventually consistent, so a drift reported here can be a moment behind
   * rather than a fault; ship says exactly that when it refuses, and the next
   * scheduled health poll is the tiebreaker.
   */
  const status = await askIndexStatus(env);

  return {
    ok: true,
    data: askSyncReport({
      uploaded,
      removed: removed.length,
      cacheDropped,
      expected: status.expected,
      present: status.present,
    }),
  };
}

/**
 * REBUILDS THE MEDIA INDEX, THROUGH THE DERIVATION, AND PROVES IT AFTERWARDS.
 *
 * The door that lets `ship` and the health workflow do what previously only a
 * human clicking a button in `/admin/media` could do. Ruled 2026-08-24 under
 * the standing AUTOMATE directive: a chore that ends in a person's hands and is
 * not a decision is a defect. The OFL.txt row waited weeks for that click.
 *
 * ## THE BUTTON IS NOT REPLACED, AND THAT IS DELIBERATE
 *
 * `/admin/media`'s rebuild intent calls `rebuildMediaIndex` too, and keeps
 * doing so. It is the MANUAL REPAIR: the thing you reach for when something has
 * gone wrong out of band. What changes is that the routine case, an index that
 * drifts because a ship added or removed an asset, no longer needs it.
 *
 * ## RULE 18, WHICH IS THE WHOLE SHAPE OF THIS FUNCTION
 *
 * The index converges toward the repository and the bucket, never the reverse,
 * and a derived store is repaired THROUGH ITS DERIVATION rather than by a hand
 * written INSERT. So this takes no arguments describing what to write: it calls
 * the same derivation the button calls, and the row arrives the way every other
 * row arrived. There is deliberately no way to ask this endpoint to index one
 * key, because that is the shape that turns an index into a second truth.
 *
 * ## THE VERDICT IS RECONCILED, NEVER SUPPLIED
 *
 * `rebuildMediaIndex` returns what its loops think they wrote. `converged`
 * comes from `mediaIndexStatus`, which re-enumerates both buckets and the
 * manifest and reads D1 back afterwards, and from the failure list. A caller
 * cannot be told this worked by an operation that merely ran.
 *
 * ## NO POLL, AND THE REASON IS STRUCTURAL RATHER THAN OPTIMISTIC
 *
 * `sync_ask` waits out a convergence window because AI Search is a separate,
 * eventually consistent service: its write is visible to a later read on its
 * own schedule. This store is D1, the rebuild AWAITS every upsert and delete
 * before returning, and the read-back happens in the SAME Worker request, which
 * reads its own writes. There is no interval during which a correct rebuild
 * reports drift, so a window would only slow a real failure down. Measured
 * rather than assumed: see the ship report for this batch.
 */
/**
 * THE MIRROR REPAIR, as an operator operation. The fourth repairable class.
 *
 * `media-backup-drift` compares MEDIA against MEDIA_BACKUP; this is its repair,
 * and both derive their work from the SAME `backupStatus`, so what the check
 * calls drift is exactly what this copies. That is the same one-owner shape the
 * other three repairs follow.
 *
 * ## WHY THIS ONE IS SAFE TO FIRE UNATTENDED
 *
 * It has no delete branch, in either bucket, and it never writes to MEDIA. The
 * worst a spurious run can do is rewrite a twin with the bytes it already had.
 * Every other repair in the table can remove something; this one cannot, which
 * is the argument recorded in `REPAIRABLE` for allowing self-repair here.
 *
 * ## IDEMPOTENT, AND THE VERDICT IS READ BACK
 *
 * Running it against a converged mirror copies nothing and reports converged.
 * The counts come from a SECOND comparison taken after the writes, on the same
 * rule the three syncs follow: a report assembled from the loop's own counters
 * describes what the loop believed rather than what the store holds.
 */
async function backupMedia(env: OperatorEnv): Promise<ToolResult> {
  const { copied, gone, status } = await copyMissingTwins(env);

  return {
    ok: true,
    data: {
      copied,
      // An object that vanished between the comparison and the copy. Not an
      // error: its twin, if it had one, is exactly what the mirror is for.
      gone,
      objects: status.objects,
      twins: status.twins,
      missing: status.missing.length,
      mismatched: status.mismatched.length,
      converged: status.missing.length === 0 && status.mismatched.length === 0,
    },
  };
}

async function syncMedia(env: OperatorEnv): Promise<ToolResult> {
  const rebuilt = await rebuildMediaIndex(env);
  const status = await mediaIndexStatus(env);

  return {
    ok: true,
    data: mediaSyncReport({
      indexed: rebuilt.indexed,
      removed: rebuilt.removed,
      failures: rebuilt.failures,
      expected: status.expected,
      present: status.present,
      missing: status.missing,
      extra: status.extra,
    }),
  };
}

/**
 * THE CONTENT-DRIFT REPAIR, as an operator operation.
 *
 * The third repairable class. The content-drift health check compares
 * `posts.source_blob_sha` against the repository's blob shas; this is its
 * repair, and the two derive their work from the SAME `contentDriftCompare`,
 * so what the check calls drift is exactly what this repairs. It is also what
 * makes a markdown commit from any machine live within one health poll with
 * no deploy: the scheduled workflow calls this through the same door ship's
 * syncs use.
 *
 * ## RULE 18, THE WHOLE SHAPE
 *
 * Scoped, but never hand-written: every drifted slug is re-rendered through
 * `renderAndWrite`, the one door to a rendered row, with the listing's blob
 * sha riding along so the door proves it rendered the bytes the repository
 * holds. A row whose file is gone loses its rows through the same
 * `deletePostFromD1` a delete uses. Nothing here can construct a row.
 *
 * ## IDEMPOTENT, AND THE VERDICT IS READ BACK
 *
 * Running it against a converged corpus repairs nothing and reports
 * converged. `expected`/`present`/`converged` come from a SECOND listing and
 * a second row read taken after the writes, never from the loop's own
 * counters, on the same rule as the other two syncs.
 */
async function syncPosts(env: OperatorEnv): Promise<ToolResult> {
  const readSides = async () => {
    const entries = await listDirectory(env, "content/posts");
    const files = entries
      .filter((e) => e.type === "file" && e.name.endsWith(".md"))
      .map((e) => ({ slug: e.name.slice(0, -".md".length), sha: e.sha, path: e.path }));
    const rows = await env.DB.prepare(
      "SELECT slug, source_blob_sha FROM posts WHERE source_path IS NOT NULL",
    ).all<{ slug: string; source_blob_sha: string | null }>();
    return { files, rows: rows.results ?? [] };
  };

  const before = await readSides();
  const drift = contentDriftCompare(before.files, before.rows);

  const fileBySlug = new Map(before.files.map((f) => [f.slug, f]));
  let repaired = 0;
  for (const slug of [...drift.changed, ...drift.unrowed]) {
    const entry = fileBySlug.get(slug);
    if (!entry) continue;
    const file = await readFile(env, entry.path);
    if (!file) {
      throw new EditorError(
        `"${entry.path}" vanished between the listing and the read; main moved ` +
          `mid-repair. Re-run sync_posts.`,
      );
    }
    await renderAndWrite(env, slug, file.content, entry.sha);
    repaired += 1;
  }

  let removed = 0;
  for (const slug of drift.unfiled) {
    await deletePostFromD1(env, slug);
    removed += 1;
  }

  // READ BACK AFTER THE WRITES. D1 reads its own writes in-request, so a
  // correct repair can never report drift here; a reported drift is real.
  const after = await readSides();
  const residual = contentDriftCompare(after.files, after.rows);
  const residualCount =
    residual.changed.length + residual.unrowed.length + residual.unfiled.length;

  return {
    ok: true,
    data: {
      repaired,
      removed,
      expected: after.files.length,
      present: after.files.length - residual.changed.length - residual.unrowed.length,
      converged: residualCount === 0,
    },
  };
}

/**
 * What the operator can see about the state of the pipeline without guessing.
 *
 * Deliberately reports the three stores separately, because they can disagree
 * and the whole design assumes they fail independently.
 */
/**
 * EXPORTED since 2026-08-25, because the cockpit renders it.
 *
 * `/admin` is the human-readable view of the instruments, and rule 17 says the
 * page renders what an instrument reports rather than computing a second
 * answer. So the cockpit calls THIS function, the one the `sync_status`
 * operator tool calls, and there is no admin-side copy of the four store
 * counts to drift from it. The export is the whole change; nothing about the
 * body moved.
 */
export async function syncStatus(env: OperatorEnv) {
  /*
   * The repository's post count, from ONE Contents directory listing. The
   * field is still named `artifactPosts` because the field names are the
   * tool's contract; what it has always meant is "how many posts the
   * repository holds", and that is what it still reports now that the
   * committed artifact is gone.
   */
  const repoEntries = await listDirectory(env, "content/posts");
  const repoPosts = repoEntries.filter(
    (e) => e.type === "file" && e.name.endsWith(".md"),
  ).length;

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
    artifactPosts: repoPosts,
    d1Posts: totalRow?.n ?? 0,
    d1PubliclyVisible: visibleRow?.n ?? 0,
    // Counted on the docsize shadow table, never COUNT(*) on the index itself:
    // that reads THROUGH to search_docs and can never detect drift.
    searchIndexDocs: indexed?.n ?? 0,
    askConfigured: askAvailable(env),
    githubConfigured: Boolean(env.GITHUB_TOKEN),
    /*
     * COMMITS THAT LANDED WHILE D1 DID NOT FOLLOW.
     *
     * The fourth store this tool reports on, and the only one whose absence is
     * the interesting state: an empty list is the normal answer. Read from KV
     * rather than D1 on purpose, because a record of a D1 failure kept in D1 is
     * missing exactly when it matters.
     *
     * `known: false` is a distinct answer from an empty list. A status tool
     * that cannot read one of its stores must say so rather than report zero,
     * which is the same distinction `d1Posts` would need if the query threw.
     */
    divergences: await listDivergences(env),
  };
}
