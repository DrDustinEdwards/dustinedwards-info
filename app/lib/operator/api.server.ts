/**
 * The operator publish tools.
 *
 * EVERY WRITE HERE CALLS THE SAME FUNCTIONS THE BROWSER EDITOR'S ACTION CALLS. Nothing in this file
 * talks to GitHub, D1 or the AI index directly, and nothing re-implements a gate. The read tools go
 * through D1 and per-file repository reads the same way the admin surfaces do, so an operator sees
 * what the editor sees.
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
import { postPath } from "~/lib/content/slug.mjs";
import { SLUG_MAX_LENGTH, SLUG_PATTERN } from "~/lib/content/slug.mjs";
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
import { ALLOWED, MAX_BYTES, uploadSuccessBody } from "~/lib/media/upload-contract.mjs";
import { storeUpload } from "~/lib/media/upload.server";
import { listDirectory, readFile } from "~/lib/editor/github.server";
import { contentDriftCompare } from "~/lib/health/verdicts.mjs";


import type { OperatorEnv } from "./auth.server";

/**
 * A slug, validated against the SAME predicate the write path enforces, because every one of these
 * is interpolated into a repository path and handed to an API that builds its URL with `encodeURI`,
 * which does NOT escape `.`, `/` or `?`. The WRITE path was always safe; the READ paths ran first
 * with no such check.
 */
function readSlug(args: Record<string, unknown>, tool: string) {
  const slug = String(args.slug ?? "").trim();
  if (!slug) return { slug: "", error: `${tool} requires a slug.` };
  if (!SLUG_PATTERN.test(slug)) {
    return { slug: "", error: `${tool} requires a lowercase kebab-case slug.` };
  }
  /*
   * THE LENGTH BOUND IS APPLIED HERE TOO: a read path that accepts what the write schema refuses
   * interpolates a slug the repository can never hold into an API path. Same constant, imported.
   */
  if (slug.length > SLUG_MAX_LENGTH) {
    return {
      slug: "",
      error: `${tool} requires a slug of at most ${SLUG_MAX_LENGTH} characters.`,
    };
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
  "upload_media",
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
 * KEYED BY `ToolName`, the `WRITE_CAPABILITIES` idiom (hard rule 13): a tool added without a
 * descriptor is a TYPECHECK failure, and a descriptor for a tool that does not exist is one too, so
 * the self-description cannot drift from the dispatch in either direction. The route carried a
 * hand-written copy and it had already drifted.
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
  upload_media: {
    args: {
      data: "string, optional, base64 bytes or a full data: URI. Either this or url.",
      url: "string, optional, an https URL the API fetches server-side. Either this or data.",
      type: "string, optional, the image MIME type. Defaults to the data: URI's " +
        "own type or the fetched response's Content-Type.",
      name: "string, optional, the filename to record as original_name. Defaults " +
        "to the URL's last path segment, or upload.<ext>.",
    },
    returns:
      "url and key, the same two the editor's upload returns, plus bytes, " +
      "width, height and `recorded`. The url is what goes in the markdown. " +
      "Idempotent: the key is a digest of the bytes, so the same image " +
      "uploaded twice is one object.",
    policy:
      "MEDIA is the irreplaceable bucket and there is no delete tool over " +
      "this token, so an object put here stays until an admin removes it. " +
      "Accepts only the image types in ALLOWED, refuses anything over " +
      "MAX_BYTES, and fetches only https URLs.",
  },
};

/**
 * The moderation queue, over the operator token, because a step that can only be taken by hand is a
 * step that gets taken late.
 *
 * UNFILTERED BY DEFAULT: a queue that hides its failures cannot tell "nothing arrived" from
 * "everything was refused". Read through the SAME function the admin page reads.
 */
async function listMentionsTool(
  env: OperatorEnv,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const status = typeof args.status === "string" ? args.status.trim() : "";

  const rows = await listWebmentionsForAdmin(env);

  if (status) {
    /*
     * A STATUS THE COLUMN CANNOT HOLD IS A 400, not an empty list: an agent that mistyped one and got
     * `[]` would conclude the queue was empty, which is indistinguishable from the right answer.
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
 * Approve, reject or delete one mention, and purge the page it changed. IT CALLS `decideMention` AND
 * NOTHING ELSE: the write and the purge travel together there, so this cannot ship the half that
 * changes the database without the half that makes it visible. The capability check is in that door
 * too, so the refusal is the same whichever caller asks.
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

  const result = await decideMention(env, id, decision, actor);

  /*
   * `changed: false` IS A REAL ANSWER AND NOT AN ERROR: the row may be one the write refuses for
   * having no evidence to approve, and reporting that as a 404 would make a caller retry something
   * that will never succeed.
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
 * Runs one tool. Errors are TRANSLATED here rather than thrown, and the translation IS the
 * contract: a gate rejection returns the gate's own message with the field and line it named,
 * verbatim, because an agent that gets "invalid frontmatter" and nothing else cannot fix its own
 * mistake.
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
  // Policy refusal. 403, and it names the policy so a caller can branch on it rather than
  // string-matching the prose.
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
   * DIVERGENCE IS ITS OWN BRANCH, because it means the OPPOSITE of the failures above: the commit
   * landed, the writing is safe, and retrying is the one response that does not help.
   *
   * Matched on `name` rather than `instanceof`, a cross-module identity check through two build
   * graphs holding only until something duplicates the module. 500: the caller did nothing wrong.
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
   * D1, not the repository: the rows are what the site serves and they converge to the repo under
   * rule 18. Field names are the tool's contract and are unchanged.
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
      // Whether an operator may publish this post is a question about the FILE, so it is answered from
      // the file and reported rather than left to be discovered by a 403.
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

  // Absent `expectedHeadSha` the save is unconditional, deliberately for a non-browser caller: it
  // has no page to reload, and forcing a read-then-write would make every agent save a two-call
  // dance. A caller that wants the editor's conflict semantics passes the sha from `get_post`.
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
 * THE FULL-CORPUS ASK UPLOAD. `savePost` keeps Ask in step for a post published THROUGH the editor,
 * and nothing kept it in step for a post published by COMMIT, which is how most of this site's
 * writing lands.
 *
 * IDEMPOTENT, which is what makes it safe as a pipeline step. THE COUNTS ARE READ BACK, NOT
 * ACCUMULATED, so a caller cannot be told this succeeded by an operation that merely ran.
 */
async function syncAsk(env: OperatorEnv): Promise<ToolResult> {
  if (!askAvailable(env)) {
    // Same stance the Ask endpoint takes: an absent binding means the feature is not here, rather than
    // here and broken.
    return { ok: false, status: 404, error: "Ask is not enabled on this deployment." };
  }

  const { uploaded, keys, failed, cacheDropped } = await syncAskCorpus(env);
  const removed = await pruneAskCorpus(env, keys);

  /*
   * READ BACK AFTER BOTH WRITES. The index is eventually consistent, so drift reported here can be a
   * moment behind rather than a fault, and the next scheduled poll is the tiebreaker. A key in
   * `failed` is not that: it was never written, and the report refuses convergence on it.
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
      failed,
    }),
  };
}

/**
 * REBUILDS THE MEDIA INDEX, THROUGH THE DERIVATION, AND PROVES IT AFTERWARDS.
 *
 * RULE 18 IS THE WHOLE SHAPE: it takes no arguments describing what to write, and there is
 * deliberately no way to ask it to index one key, which is the shape that turns an index into a
 * second truth. THE VERDICT IS RECONCILED, NEVER SUPPLIED.
 *
 * The manual button is not replaced: it stays as the repair for when something has gone wrong out
 * of band. NO POLL, structurally: the rebuild awaits every write and the read-back is in the SAME
 * request, which reads its own writes.
 */
/**
 * THE MIRROR REPAIR, deriving its work from the SAME comparison the drift check uses.
 *
 * SAFE TO FIRE UNATTENDED because it has no delete branch in either bucket and never writes to the
 * primary, so the worst a spurious run does is rewrite a twin with the bytes it already had. The
 * counts come from a SECOND comparison after the writes.
 */
async function backupMedia(env: OperatorEnv): Promise<ToolResult> {
  const { copied, gone, status } = await copyMissingTwins(env);

  return {
    ok: true,
    data: {
      copied,
      // An object that vanished between the comparison and the copy. Not an error: its twin, if it had
      // one, is exactly what the mirror is for.
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
 * A `data:` URI's own declaration, or null when this is bare base64. Parsed rather than stripped,
 * because the prefix carries the MIME type. Only base64 payloads are accepted: a percent-encoded
 * URI is a different encoding, and silently mis-decoding one would store rubbish under a digest
 * that looks perfectly valid.
 */
function readDataUri(value: string): { type: string; payload: string } | null {
  const match = /^data:([^;,]*)(;base64)?,/i.exec(value);
  if (!match) return null;
  if (!match[2]) return null;
  return { type: (match[1] ?? "").toLowerCase(), payload: value.slice(match[0].length) };
}

/** Base64 to bytes, or null when it is not base64 at all. */
function decodeBase64(payload: string): Uint8Array | null {
  // Whitespace is what a base64 blob acquires traveling through a chat or a YAML block, and `atob`
  // throws on it.
  const packed = payload.replace(/\s+/g, "");
  try {
    const binary = atob(packed);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/**
 * The response body, up to a cap, READ IN CHUNKS AND ABANDONED AT THE CAP rather than buffered and
 * length-checked: a `Content-Length` is a claim the far end makes and a body can simply not stop,
 * so buffering it whole to discover that lets a remote URL decide how much memory this isolate uses.
 */
async function readCapped(body: ReadableStream<Uint8Array>, cap: number): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  return out;
}

/**
 * What to record when the caller did not say: the URL's last path segment first, that being the
 * closest thing to a name a person chose, and otherwise a default that at least describes the
 * object.
 */
function defaultName(type: string, url: string): string {
  if (url) {
    try {
      const base = new URL(url).pathname.split("/").filter(Boolean).pop();
      if (base) return decodeURIComponent(base);
    } catch {
      // An unparseable URL never gets this far, the protocol having been checked already. Caught anyway
      // rather than thrown out of a naming helper.
    }
  }
  const extension = ALLOWED.get(type);
  // NOT a substituted default (hard rule 13): a type outside the allowlist is one statement away from
  // being refused, so this name is never stored. Returning `upload.bin` would be the substitution.
  return extension ? `upload.${extension}` : "upload";
}

/**
 * THE BUCKET, as an operator operation. Ruling 32d.
 *
 * IT IS AN ADAPTER and `storeUpload` is the write: the allowlist, the size limit and the key are the
 * same code the admin upload runs. What is here is only how bytes REACH that door.
 *
 * TWO WAYS IN, AND `url` IS THE LOAD-BEARING ONE. `data` is base64, the obvious shape and the one
 * that does not scale, since no agent carries a photograph's worth of it through a conversation.
 * `url` is what makes the tool usable, and it is why the ruling named both.
 *
 * THE PRIMARY CONTROL IS THE TOKEN AND THE RATE LIMITER, said plainly because the checks below are
 * secondary: HTTPS only, since a fetch is the one place a caller chooses where this Worker goes; a
 * capped read; and the same `validateUpload` contract a form upload meets.
 *
 * THE TYPE THE CALLER DECLARES WINS, deliberately, because a good PNG served as
 * `application/octet-stream` is common. Safe, because it is checked against the allowlist AND the
 * bytes, the same treatment `file.type` gets on the form path.
 */
async function uploadMediaTool(
  env: OperatorEnv,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const data = typeof args.data === "string" ? args.data.trim() : "";
  const url = typeof args.url === "string" ? args.url.trim() : "";
  const declaredType = typeof args.type === "string" ? args.type.trim().toLowerCase() : "";
  const declaredName = typeof args.name === "string" ? args.name.trim() : "";

  /*
   * EXACTLY ONE SOURCE. Both given is refused rather than resolved by a precedence rule, because a
   * caller that supplied both has two different images in mind and silently picking one stores the
   * wrong photograph under a digest that will never look wrong.
   */
  if (data && url) {
    return {
      ok: false,
      status: 400,
      error: "upload_media takes `data` or `url`, never both. Send one.",
    };
  }
  if (!data && !url) {
    return {
      ok: false,
      status: 400,
      error:
        "upload_media needs either `data` (base64 bytes or a data: URI) or " +
        "`url` (an https URL this API will fetch).",
    };
  }

  let bytes: Uint8Array;
  let type = declaredType;

  if (data) {
    const uri = readDataUri(data);
    if (data.startsWith("data:") && !uri) {
      return {
        ok: false,
        status: 400,
        error:
          "`data` looks like a data: URI but is not base64-encoded. Send " +
          "`data:<type>;base64,<payload>` or bare base64.",
      };
    }

    // The URI's own type only when the caller named none: an explicit argument is the more deliberate
    // statement of the two.
    if (!type && uri) type = uri.type;

    /*
     * REFUSED ON THE ENCODED LENGTH, before `atob` allocates anything: base64 is four characters per
     * three bytes, so this is arithmetic on the string in hand. Deliberately GENEROUS, since it only
     * has to stop an absurd payload being decoded and `validateUpload` states the real limit.
     */
    const packedLength = (uri ? uri.payload : data).replace(/\s+/g, "").length;
    if (packedLength > Math.ceil(MAX_BYTES / 3) * 4 + 4) {
      return {
        ok: false,
        status: 413,
        error:
          `That base64 payload decodes to more than the ` +
          `${MAX_BYTES / (1024 * 1024)} MB limit. Upload it with \`url\` instead.`,
      };
    }

    const decoded = decodeBase64(uri ? uri.payload : data);
    if (!decoded) {
      return { ok: false, status: 400, error: "`data` is not valid base64." };
    }
    bytes = decoded;
  } else {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return { ok: false, status: 400, error: `\`url\` is not a URL: ${JSON.stringify(url)}.` };
    }
    if (parsed.protocol !== "https:") {
      return {
        ok: false,
        status: 400,
        error: `upload_media fetches https only, not ${parsed.protocol.replace(":", "")}.`,
      };
    }

    let response: Response;
    try {
      response = await fetch(parsed, { headers: { accept: "image/*" } });
    } catch (error) {
      return {
        ok: false,
        status: 502,
        error: `Fetching ${parsed.href} failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    /*
     * THE PROTOCOL IS CHECKED AGAIN, ON WHERE IT LANDED, because `fetch` follows redirects and an
     * `https://` URL is free to redirect to `http://`. Checking only what the caller typed would make
     * the rule a check on their typing rather than on where the bytes came from. The fallback keeps it
     * closed rather than open if the post-redirect URL is ever empty.
     */
    let landed = "";
    try {
      landed = new URL(response.url || parsed.href).protocol;
    } catch {
      landed = "";
    }
    if (landed !== "https:") {
      return {
        ok: false,
        status: 400,
        error:
          `${parsed.href} redirected to ${response.url || "somewhere unparseable"}, ` +
          `which is not https. upload_media fetches https only, redirects included.`,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: 502,
        error: `${parsed.href} answered ${response.status}.`,
      };
    }
    if (!response.body) {
      return { ok: false, status: 502, error: `${parsed.href} answered with no body.` };
    }

    const read = await readCapped(response.body, MAX_BYTES);
    if (!read) {
      return {
        ok: false,
        status: 413,
        error:
          `${parsed.href} is over the ${MAX_BYTES / (1024 * 1024)} MB limit; the ` +
          `download was abandoned.`,
      };
    }
    bytes = read;

    // The response's own claim, only when the caller made none. Split on `;`, because a charset
    // parameter is normal on one of these types and the allowlist holds bare types.
    if (!type) {
      type = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    }
  }

  /*
   * COPIED INTO A FRESH ArrayBuffer rather than handed `bytes.buffer`. Two reasons, and the second is
   * the one that would have hurt: `.buffer` does not satisfy the door's parameter type at all, and it
   * is the whole underlying allocation rather than the view. It happens to be exactly the content
   * today because the two producers size their arrays to what they read, which is a property of those
   * functions rather than of this call, so a later change to either would hash and store the wrong
   * bytes under a key that still looks valid.
   */
  const payload = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(payload).set(bytes);

  const stored = await storeUpload(env, {
    bytes: payload,
    type,
    name: declaredName || defaultName(type, url),
  });

  if (!stored.ok) {
    return { ok: false, status: stored.status, error: stored.message, detail: { code: stored.code } };
  }

  return {
    ok: true,
    data: {
      // The editor's own two keys, from the same function that builds theirs, so the string an agent puts
      // in markdown and the string the editor inserts are one statement rather than two that agree today.
      ...uploadSuccessBody(stored.key),
      bytes: stored.bytes,
      width: stored.width,
      height: stored.height,
      /*
       * THE ANNOTATION ROW IS REPORTED, not assumed. It is written non-fatally because the object is
       * already in R2 and a D1 hiccup must not report failure for a write that happened, which leaves an
       * operator with no way to see it. `false` means the object landed and the row did not; the repair
       * is `sync_media`, which re-derives it.
       */
      recorded: stored.recorded,
    },
  };
}

/**
 * THE CONTENT-DRIFT REPAIR, deriving its work from the SAME comparison the health check uses, which
 * is what makes a markdown commit from any machine live within one poll with no deploy. RULE 18:
 * scoped, but never hand-written, every drifted slug going through the one door.
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

  // READ BACK AFTER THE WRITES. D1 reads its own writes in-request, so a correct repair can never
  // report drift here and a reported drift is real.
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
 * What the operator can see about the state of the pipeline without guessing. The three stores are
 * reported SEPARATELY, because they can disagree and the whole design assumes they fail
 * independently.
 */
/**
 * EXPORTED because the cockpit renders it: rule 17 says the page renders what an instrument reports
 * rather than computing a second answer, so it calls THIS function and there is no admin-side copy
 * of the store counts to drift from it.
 */
export async function syncStatus(env: OperatorEnv) {
  /*
   * The repository's post count, from ONE Contents directory listing. The field name is the tool's
   * contract and is unchanged; what it has always meant is how many posts the repository holds.
   */
  const repoEntries = await listDirectory(env, "content/posts");
  const repoPosts = repoEntries.filter(
    (e) => e.type === "file" && e.name.endsWith(".md"),
  ).length;

  // Counted through DRIZZLE, not by interpolating the predicate into a template string, which
  // stringifies the expression object and makes D1 answer `no such column`. Locally the tool failed
  // earlier, at a missing token, and never reached the query, so the live round trip was the only
  // place this could have been found.
  //
  // Hard rule 1 is why the predicate is reused rather than rewritten in SQL: a hand-copied WHERE
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
    // Counted on the docsize shadow table, never `COUNT(*)` on the index itself, which reads THROUGH to
    // the content table and can never detect drift.
    searchIndexDocs: indexed?.n ?? 0,
    askConfigured: askAvailable(env),
    githubConfigured: Boolean(env.GITHUB_TOKEN),
    /*
     * COMMITS THAT LANDED WHILE D1 DID NOT FOLLOW: the only store here whose absence is the interesting
     * state, so an empty list is the normal answer. Read from KV rather than D1, because a record of a
     * D1 failure kept in D1 is missing exactly when it matters.
     *
     * `known: false` is a distinct answer from an empty list: a status tool that cannot read one of its
     * stores must say so rather than report zero.
     */
    divergences: await listDivergences(env),
  };
}
