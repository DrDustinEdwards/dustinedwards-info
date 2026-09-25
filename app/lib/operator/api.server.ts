// Every write calls the same functions the browser editor's action calls; nothing here re-implements a gate.

import { DIVERGENCE_ERROR_NAME } from "~/lib/editor/converge.mjs";
import { listDivergences } from "~/lib/editor/divergence.server";
import { count } from "drizzle-orm";

import {
  getAdminPostRow,
  getDb,
  listPostsForOperator,
  listWebmentionsForAdmin,
  publiclyVisible,
} from "~/db";
import { posts as postsTable, webmentions as webmentionsTable } from "~/db/schema";
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
import { SLUG_MAX_LENGTH, SLUG_PATTERN, postPath } from "~/lib/content/slug.mjs";
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
import { listPostFiles, readFile } from "~/lib/editor/github.server";
import { readContentSides } from "~/lib/health/checks.server";
import { contentDriftCompare } from "~/lib/health/verdicts.mjs";

import type { OperatorEnv } from "./auth.server";
import { errorMessage } from "~/lib/error-message.mjs";
import { readCappedBytes } from "~/lib/read-capped.mjs";
import { base64ToBytes } from "~/lib/bytes.mjs";

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

type ToolResult =
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

type ToolName = (typeof TOOLS)[number];

export function isToolName(value: unknown): value is ToolName {
  return typeof value === "string" && (TOOLS as readonly string[]).includes(value);
}

export function toolNames(): readonly ToolName[] {
  return TOOLS;
}

// Keyed by `ToolName`, so a missing or extra descriptor is a typecheck failure.
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


// Posts published by COMMIT never pass through `savePost`, so this keeps Ask in step for them.
async function syncAsk(env: OperatorEnv): Promise<ToolResult> {
  if (!askAvailable(env)) {
    // An absent binding means the feature is not here, rather than here and broken.
    return { ok: false, status: 404, error: "Ask is not enabled on this deployment." };
  }

  const { uploaded, keys, failed, cacheDropped } = await syncAskCorpus(env);
  const removed = await pruneAskCorpus(env, keys);

  // The index is eventually consistent, so drift here may be a moment behind. A key in `failed` was
  // never written, and the report refuses convergence on it.
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

// Safe unattended: no delete branch in either bucket, and it never writes the primary.
async function backupMedia(env: OperatorEnv): Promise<ToolResult> {
  const { copied, gone, status } = await copyMissingTwins(env);

  return {
    ok: true,
    data: {
      copied,
      // Vanished between the comparison and the copy: not an error, the twin is what the mirror is for.
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

// Base64 only: silently mis-decoding a percent-encoded URI would store rubbish under a valid-looking digest.
function readDataUri(value: string): { type: string; payload: string } | null {
  const match = /^data:([^;,]*)(;base64)?,/i.exec(value);
  if (!match) return null;
  if (!match[2]) return null;
  return { type: (match[1] ?? "").toLowerCase(), payload: value.slice(match[0].length) };
}

function decodeBase64(payload: string): Uint8Array | null {
  // Null rather than a throw: the caller answers the agent that sent it with a 400 that says why.
  try {
    return base64ToBytes(payload);
  } catch {
    return null;
  }
}

function defaultName(type: string, url: string): string {
  if (url) {
    try {
      const base = new URL(url).pathname.split("/").filter(Boolean).pop();
      if (base) return decodeURIComponent(base);
    } catch {
      // Unreachable: the protocol was already checked. Caught rather than thrown from a naming helper.
    }
  }
  const extension = ALLOWED.get(type);
  // Never stored: a type outside the allowlist is refused next. `upload.bin` would be a substitution.
  return extension ? `upload.${extension}` : "upload";
}

// An adapter: `storeUpload` is the write. The token and rate limiter are the primary control; HTTPS only,
// a capped read and `validateUpload` are secondary. The declared type wins because good PNGs are often
// served as octet-stream, and it is still checked against the allowlist and the bytes.
async function uploadMediaTool(
  env: OperatorEnv,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const data = typeof args.data === "string" ? args.data.trim() : "";
  const url = typeof args.url === "string" ? args.url.trim() : "";
  const declaredType = typeof args.type === "string" ? args.type.trim().toLowerCase() : "";
  const declaredName = typeof args.name === "string" ? args.name.trim() : "";

  // Both sources is refused, not resolved: picking one could store the wrong image under a valid digest.
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

    if (!type && uri) type = uri.type;

    // Refused on the encoded length before `atob` allocates. Generous: `validateUpload` states the real limit.
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
        error: `Fetching ${parsed.href} failed: ${errorMessage(error)}`,
      };
    }
    // Checked again where it LANDED: `fetch` follows redirects, and https may redirect to http.
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

    const read = await readCappedBytes(response, MAX_BYTES);
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

    // Split on `;`: a charset parameter is normal, and the allowlist holds bare types.
    if (!type) {
      type = (response.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    }
  }

  // A fresh ArrayBuffer, not `bytes.buffer`: that is the whole allocation, not the view, so a later change
  // to a producer could hash and store the wrong bytes.
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
      // The editor's own builder, so the string an agent puts in markdown is the one the editor inserts.
      ...uploadSuccessBody(stored.key),
      bytes: stored.bytes,
      width: stored.width,
      height: stored.height,
      // `false` means the object landed and the row did not; `sync_media` re-derives it.
      recorded: stored.recorded,
    },
  };
}

// Derives its work from the same comparison the health check uses, and every drifted slug goes through
// the one render door.
async function syncPosts(env: OperatorEnv): Promise<ToolResult> {
  const before = await readContentSides(env);
  const drift = contentDriftCompare(before.files, before.rows);

  const fileBySlug = new Map(before.files.map((f) => [f.slug, f]));
  let repaired = 0;
  // A failed purge never fails the repair, but it is counted: those pages stay stale until expiry.
  let unpurged = 0;
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
    if ((await renderAndWrite(env, slug, file.content, entry.sha)).purged === false) unpurged += 1;
    repaired += 1;
  }

  let removed = 0;
  for (const slug of drift.unfiled) {
    if ((await deletePostFromD1(env, slug)).purged === false) unpurged += 1;
    removed += 1;
  }

  // D1 reads its own writes in-request, so drift reported here is real.
  const after = await readContentSides(env);
  const residual = contentDriftCompare(after.files, after.rows);
  const residualCount =
    residual.changed.length + residual.unrowed.length + residual.unfiled.length;

  return {
    ok: true,
    data: {
      repaired,
      removed,
      unpurged,
      expected: after.files.length,
      present: after.files.length - residual.changed.length - residual.unrowed.length,
      converged: residualCount === 0,
    },
  };
}

// Stores reported SEPARATELY: they fail independently. Exported because the cockpit renders this rather
// than computing a second answer.
export async function syncStatus(env: OperatorEnv) {
  const repoPosts = (await listPostFiles(env)).length;

  // Counted through Drizzle: interpolating the predicate into a template string stringifies the object and
  // D1 answers `no such column`. `publiclyVisible()` is reused so the visibility rule has one owner.
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

  // A COUNT always returns one row; a missing one is an unreadable answer, never zero posts.
  const counted = (row: { n: number } | null | undefined, what: string) => {
    if (typeof row?.n !== "number") throw new Error(`syncStatus: the ${what} count returned no row`);
    return row.n;
  };

  return {
    headSha: await currentHead(env),
    artifactPosts: repoPosts,
    d1Posts: counted(totalRow, "posts"),
    d1PubliclyVisible: counted(visibleRow, "publicly visible posts"),
    // The docsize shadow table: `COUNT(*)` on the index reads through to the content table and never drifts.
    searchIndexDocs: counted(indexed, "search index"),
    askConfigured: askAvailable(env),
    githubConfigured: Boolean(env.GITHUB_TOKEN),
    // Read from KV: a record of a D1 failure kept in D1 is missing exactly when it matters. `known: false`
    // is not the same answer as an empty list.
    divergences: await listDivergences(env),
  };
}
