// The convergence tools: each re-derives one store from its source and reports a read-back verdict,
// plus the cockpit's per-store counts.

import { count } from "drizzle-orm";

import { getDb, publiclyVisible } from "~/db";
import { posts as postsTable } from "~/db/schema";
import { listDivergences } from "~/lib/editor/divergence.server";
import { EditorError, currentHead, deletePostFromD1, renderAndWrite } from "~/lib/editor/publish.server";
import { listPostFiles, readFile } from "~/lib/editor/github.server";
import { askAvailable, askIndexStatus, pruneAskCorpus, syncAskCorpus } from "~/lib/search/ask.server";
import { mediaIndexStatus, rebuildMediaIndex } from "~/lib/media/rebuild.server";
import { copyMissingTwins } from "~/lib/media/backup.server";
import { readContentSides } from "~/lib/health/checks.server";
import { contentDriftCompare } from "~/lib/health/verdicts.mjs";

import type { OperatorEnv } from "./auth.server";
import type { ToolResult } from "./descriptors";
import { askSyncReport, mediaSyncReport } from "./sync-report.mjs";

// Posts published by COMMIT never pass through `savePost`, so this keeps Ask in step for them.
export async function syncAsk(env: OperatorEnv): Promise<ToolResult> {
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
export async function backupMedia(env: OperatorEnv): Promise<ToolResult> {
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

export async function syncMedia(env: OperatorEnv): Promise<ToolResult> {
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

// Derives its work from the same comparison the health check uses, and every drifted slug goes through
// the one render door.
export async function syncPosts(env: OperatorEnv): Promise<ToolResult> {
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
