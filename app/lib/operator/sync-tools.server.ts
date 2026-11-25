// The convergence tools: each re-derives one store from its source and reports a read-back verdict,
// plus the cockpit's per-store counts.

import { count } from "drizzle-orm";
import { getDb, publiclyVisible } from "~/db";
import { posts as postsTable } from "~/db/schema";
import { listDivergences } from "~/lib/editor/divergence.server";
import { EditorError, currentHead, renderAndWrite } from "~/lib/editor/publish.server";
import { deletePostFromD1 } from "~/lib/editor/post-rows.server";
import { listPostFiles, readFile } from "~/lib/source/store.server";
import { askAvailable, syncAskAndWait } from "~/lib/search/ask.server";
import { siteAssetStatus, rebuildSiteAssets } from "~/lib/media/rebuild.server";
import { dropHealthVerdicts } from "~/lib/health/verdict-cache.server";
import { readContentSides } from "~/lib/health/checks.server";
import { contentDriftCompare } from "~/lib/health/verdicts.mjs";
import type { OperatorEnv } from "./auth.server";
import type { ToolResult } from "./descriptors";
import { askSyncReport, mediaSyncReport } from "./sync-report.mjs";
import { convergedResult } from "./sync-converge.server";

// Posts published by COMMIT never pass through `savePost`, so a deploy asks for a sync and waits for it to end.
export async function syncAsk(env: OperatorEnv): Promise<ToolResult> {
  if (!askAvailable(env)) {
    // An absent binding means the feature is not here, rather than here and broken.
    return { ok: false, status: 404, error: "Ask is not enabled on this deployment." };
  }

  const { job, ended, status } = await syncAskAndWait(env, "sync_ask");
  return {
    ok: true,
    data: askSyncReport({
      job: job.id,
      ended,
      expected: status.expected,
      present: status.present,
      refused: status.failed,
      indexing: status.indexing,
    }),
  };
}

export async function syncMedia(env: OperatorEnv): Promise<ToolResult> {
  const rebuilt = await rebuildSiteAssets(env);
  const status = await siteAssetStatus(env);
  await dropHealthVerdicts(env);

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
// the one render door. An empty listing is refused as convergeKind refuses it: content/posts answering
// with no markdown is a fault, and honoring it would delete every post row.
export async function syncPosts(env: OperatorEnv): Promise<ToolResult> {
  const before = await readContentSides(env);
  if (before.files.length === 0) {
    return {
      ok: false,
      status: 422,
      error:
        "sync_posts refused: content/posts lists no post files, and converging to an empty set " +
        "would delete every post row. Check the source listing.",
    };
  }
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

  return convergedResult(await readContentSides(env), { repaired, removed, unpurged });
}

// Stores reported SEPARATELY: they fail independently. Exported because the cockpit renders this rather
// than computing a second answer.
export async function syncStatus(env: OperatorEnv) {
  // Counted through Drizzle: interpolating the predicate into a template string stringifies the object and
  // D1 answers `no such column`. `publiclyVisible()` is reused so the visibility rule has one owner.
  const db = getDb(env);
  // The stores are separate and each read is independent (the source twice, the rows three times, KV once), so they run
  // together: the status takes as long as the slowest read, not the sum of all of them.
  const [repoFiles, totalRow, visibleRow, indexed, headSha, divergences] = await Promise.all([
    listPostFiles(env),
    db.select({ n: count() }).from(postsTable).get(),
    db.select({ n: count() }).from(postsTable).where(publiclyVisible()).get(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM search_identity_docsize").first<{ n: number }>(),
    currentHead(env),
    listDivergences(env),
  ]);
  const repoPosts = repoFiles.length;

  // A COUNT always returns one row; a missing one is an unreadable answer, never zero posts.
  const counted = (row: { n: number } | null | undefined, what: string) => {
    if (typeof row?.n !== "number")
      throw new Error(`syncStatus: the ${what} count returned no row`);
    return row.n;
  };

  return {
    headSha,
    artifactPosts: repoPosts,
    d1Posts: counted(totalRow, "posts"),
    d1PubliclyVisible: counted(visibleRow, "publicly visible posts"),
    // The docsize shadow table: `COUNT(*)` on the index reads through to the content table and never drifts.
    searchIndexDocs: counted(indexed, "search index"),
    askConfigured: askAvailable(env),
    // Read from KV: a record of a D1 failure kept in D1 is missing exactly when it matters. `known: false`
    // is not the same answer as an empty list.
    divergences,
  };
}
