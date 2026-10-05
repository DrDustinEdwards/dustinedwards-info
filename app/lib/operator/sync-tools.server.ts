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
import {
  readContentSides,
  readLlmsSides,
  readCvSides,
  readDictionarySides,
  readPageSides,
  readProcedureSides,
  readPublicationSides,
  readPhageSides,
  readRegistrySides,
  readRosterSides,
} from "~/lib/health/checks.server";
import { purgeCv, purgeLlms, purgePages, purgePhages, purgeProcedures, purgePublications, purgeRegistry, purgeRoster } from "~/lib/cache-purge.server";
import { compileLlms, writeLlmsRow } from "~/lib/llms/save.server";
import { readCv } from "~/db/cv";
import { CV_DIR } from "~/lib/cv/parse.mjs";
import { cvFingerprint } from "~/lib/cv/pdf-html.mjs";
import { ensureCvPdf, storedCvPdfFingerprint } from "~/lib/cv/pdf.server";
import { compile as compileCvFile, deleteCvRow, refreshCvSearch, writeCvRow } from "~/lib/cv/save.server";
import { DICTIONARY_DIR } from "~/lib/dictionary/parse.mjs";
import {
  compile as compileDictionaryFile,
  deleteRow as deleteDictionaryRow,
  writeRow as writeDictionaryRow,
} from "~/lib/dictionary/save.server";
import { PAGES_DIR } from "~/lib/pages/compile.mjs";
import {
  compile as compilePageFile,
  deletePageRow,
  writeRow as writePageRow,
} from "~/lib/pages/save.server";
import { PUBLICATIONS_DIR } from "~/lib/publications/parse.mjs";
import { listPhages } from "~/db/phages";
import { PHAGES_DIR, phageSlug, type Phage } from "~/lib/phages/compile.mjs";
import { compile as compilePhageFile, deletePhageRow, refreshPage as refreshPhagePage, writePhageRow } from "~/lib/phages/save.server";
import { REGISTRY_DIR } from "~/lib/registry/compile.mjs";
import { refreshProceduresNaming } from "~/lib/procedures/primer-dependents.server";
import { compile as compileRegistryFile, deleteRegistryRow, writeRegistryRow } from "~/lib/registry/save.server";
import { ROSTER_DIR } from "~/lib/roster/compile.mjs";
import { compile as compileRosterFile, deleteRosterRow, writeRosterRow } from "~/lib/roster/save.server";
import {
  compilePublicationFor,
  deletePublicationRow,
  seedMissingCitations,
  writePublicationRow,
} from "~/lib/publications/save.server";
import { PROCEDURES_DIR } from "~/lib/procedures/parse.mjs";
import {
  compile as compileProcedureFile,
  deleteProcedureRow,
  writeRow as writeProcedureRow,
} from "~/lib/procedures/save.server";
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

type DriftSides<Row extends { slug: string; source_blob_sha: string | null }> = {
  files: Array<{ slug: string; sha: string; path: string }>;
  rows: Row[];
};

/**
 * What differs between the kinds that converge from files to D1 rows (procedures, pages, publications):
 * the two sides, the compile door and the write and removal doors the kind's own save uses. The loop is one.
 */
type CompileResult = { ok: boolean; errors: string[] };
type CompiledOk<Result extends CompileResult> = Extract<Result, { ok: true }> & { sourceBlobSha: string };

type KindSync<Row extends { slug: string; source_blob_sha: string | null }, Result extends CompileResult> = {
  tool: string;
  dir: string;
  noun: string;
  read: () => Promise<DriftSides<Row>>;
  compile: (slug: string, raw: string) => Promise<Result>;
  write: (compiled: CompiledOk<Result>) => Promise<void>;
  remove: (row: Row) => Promise<void>;
  purge: (why: string) => Promise<boolean | null>;
  /**
   * For a kind whose rows feed another derived store (the phages draw a page): runs once, after the comparison and
   * before any row moves, so that store settles to the final set first and a failure leaves the rows reading
   * drifted, to be retried. Throws to stop the repair.
   */
  settle?: (plan: { files: DriftSides<Row>["files"]; rows: Row[]; drift: ReturnType<typeof contentDriftCompare> }) => Promise<void>;
  /**
   * For a kind that legitimately has no files yet (the registry, before any kind brings records): no files AND no
   * rows is a converged nothing, not a fault. No files while rows exist is still refused, because that is the
   * listing that came back empty and would delete every row.
   */
  emptyOk?: boolean;
};

/**
 * Converges one kind's table to its files through the compile and write doors its save uses, from the same
 * comparison its health check runs. Idempotent. An empty file set is refused, as scripts/sync-content.mjs
 * refuses it: a listing that came back empty is far likelier a fault than a repository with none, and
 * honouring it would delete every row.
 *
 * A file that fails the validator cannot be written: every other drifted file is still converged, then the
 * failures are returned as a 422 naming each file and its messages, so the repair never reports success
 * over a file it could not apply.
 */
async function convergeKind<
  Row extends { slug: string; source_blob_sha: string | null },
  Result extends CompileResult,
>(env: OperatorEnv, spec: KindSync<Row, Result>): Promise<ToolResult> {
  const before = await spec.read();
  if (before.files.length === 0 && before.rows.length === 0 && spec.emptyOk) {
    return { ok: true, data: { repaired: 0, removed: 0, unpurged: 0, expected: 0, present: 0, converged: true } };
  }
  if (before.files.length === 0) {
    return {
      ok: false,
      status: 422,
      error:
        `${spec.tool} refused: ${spec.dir} lists no ${spec.noun} files, and converging to an empty set ` +
        `would delete every ${spec.noun} row. Check the repository listing.`,
    };
  }
  const drift = contentDriftCompare(before.files, before.rows);
  if (spec.settle && drift.changed.length + drift.unrowed.length + drift.unfiled.length > 0) {
    await spec.settle({ files: before.files, rows: before.rows, drift });
  }

  const fileBySlug = new Map(before.files.map((f) => [f.slug, f]));
  let repaired = 0;
  const failed: Array<{ slug: string; path: string; errors: string[] }> = [];
  for (const slug of [...drift.changed, ...drift.unrowed]) {
    const entry = fileBySlug.get(slug);
    if (!entry) continue;
    const file = await readFile(env, entry.path);
    if (!file) {
      throw new EditorError(
        `"${entry.path}" vanished between the listing and the read; main moved mid-repair. Re-run ${spec.tool}.`,
      );
    }
    const compiled = await spec.compile(slug, file.content);
    if (!compiled.ok) {
      failed.push({ slug, path: entry.path, errors: compiled.errors });
      continue;
    }
    const done = compiled as CompiledOk<Result>;
    // Compiled from the bytes read, which must be the bytes listed, or the row would claim a sha it is not.
    if (done.sourceBlobSha !== entry.sha) {
      throw new EditorError(
        `"${entry.path}" changed between the listing and the read; main moved mid-repair. Re-run ${spec.tool}.`,
      );
    }
    await spec.write(done);
    repaired += 1;
  }

  const rowBySlug = new Map(before.rows.map((r) => [r.slug, r]));
  let removed = 0;
  for (const slug of drift.unfiled) {
    const row = rowBySlug.get(slug);
    if (!row) continue;
    await spec.remove(row);
    removed += 1;
  }

  // A failed purge never fails the repair, but it is counted: those pages stay stale until expiry.
  let unpurged = 0;
  if (repaired + removed > 0 && (await spec.purge(spec.tool)) === false) unpurged = 1;

  if (failed.length > 0) {
    return {
      ok: false,
      status: 422,
      error:
        `${spec.tool} could not apply ${failed.length} file(s): ` +
        failed.map((f) => `${f.path} fails ${f.errors.length} check(s), first: ${f.errors[0]}`).join("; ") +
        `. The other ${repaired} drifted ${spec.noun}(s) were converged.`,
      detail: { failed, repaired, removed },
    };
  }

  // D1 reads its own writes in-request, so drift reported here is real.
  const after = await spec.read();
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

/** Procedures: the compile and write doors save_procedure uses. */
export async function syncProcedures(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_procedures",
    dir: PROCEDURES_DIR,
    noun: "procedure",
    read: () => readProcedureSides(env),
    compile: (slug, raw) => compileProcedureFile(env, slug, raw),
    write: (compiled) => writeProcedureRow(env, compiled),
    remove: (row) => deleteProcedureRow(env, row),
    purge: purgeProcedures,
  });
}

/**
 * Dictionary entries: the compile and write doors a dictionary save uses, which also re-derive the one page
 * row each entry opens (its twin and its search records), and purge the pages tag, because the page embeds the
 * entry. An entry whose path is not a registered Software page, or whose clip is not in the repository, is
 * refused by the compile (the 422 names the file) and never makes a row.
 */
export async function syncDictionary(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_dictionary",
    dir: DICTIONARY_DIR,
    noun: "dictionary entry",
    read: () => readDictionarySides(env),
    compile: (key, raw) => compileDictionaryFile(env, key, raw),
    write: (compiled) => writeDictionaryRow(env, compiled),
    remove: (row) => deleteDictionaryRow(env, { key: row.slug, path: row.path }),
    purge: purgePages,
  });
}

/**
 * Pages: the compile and write doors a page save uses. A file whose path is not in CONTENT_PAGE_PATHS (or About's, CONTENT_PAGES_OWN_ROUTE) is
 * refused by the compile (the 422 names the file) and never makes a row.
 */
export async function syncPages(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_pages",
    dir: PAGES_DIR,
    noun: "page",
    read: () => readPageSides(env),
    compile: (slug, raw) => compilePageFile(env, slug, raw),
    write: (compiled) => writePageRow(env, compiled),
    remove: (row) => deletePageRow(env, row),
    purge: purgePages,
  });
}

/**
 * The CV: the compile and write doors a CV save uses, one row per file. The CV's search records depend on every
 * file, so they are rewritten once after the rows, in the step that also purges the CV's cache tag. A failure
 * there is thrown, not counted: a repair that left the search records behind must not report success.
 */
export async function syncCv(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_cv",
    dir: CV_DIR,
    noun: "CV file",
    read: () => readCvSides(env),
    compile: (slug, raw) => compileCvFile(env, slug, raw),
    write: (compiled) => writeCvRow(env, compiled),
    remove: (row) => deleteCvRow(env, row),
    purge: async (why) => {
      await refreshCvSearch(env);
      return purgeCv(why);
    },
  });
}

/**
 * Publications: the compile and write doors a publication save uses. Each written row is read back for
 * its twin's bytes, because the twin goes in as chunks and this is what proves they joined. A citation
 * count that exists is never touched; one that is missing is seeded from the committed snapshot.
 */
export async function syncPublications(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_publications",
    dir: PUBLICATIONS_DIR,
    noun: "publication",
    read: () => readPublicationSides(env),
    compile: (slug, raw) => compilePublicationFor(env, slug, raw),
    write: async (compiled) => {
      await writePublicationRow(env, compiled);
      const stored = await env.DB.prepare(
        "SELECT source_blob_sha, length(CAST(markdown AS BLOB)) AS twin_bytes FROM publications WHERE slug = ?1",
      )
        .bind(compiled.record.slug)
        .first<{ source_blob_sha: string; twin_bytes: number }>();
      const twinBytes = new TextEncoder().encode(compiled.twin).length;
      if (stored?.source_blob_sha !== compiled.sourceBlobSha || stored.twin_bytes !== twinBytes) {
        throw new Error(
          `sync_publications wrote "${compiled.record.slug}" but the row read back does not match its file ` +
            `(twin ${stored?.twin_bytes ?? "missing"} bytes, expected ${twinBytes}). Re-run sync_publications.`,
        );
      }
      await seedMissingCitations(env, [compiled.record.doi]);
    },
    remove: (row) => deletePublicationRow(env, row),
    purge: purgePublications,
  });
}

/**
 * llms.txt: the compile and write doors an llms.txt save uses, through the same loop as the kinds above,
 * with one file and one settings row. The write reads the row back. A repository with no llms.txt is
 * refused as an empty set; the row is never deleted.
 */
export async function syncLlms(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_llms",
    dir: "content",
    noun: "llms.txt",
    read: () => readLlmsSides(env),
    compile: (_slug, raw) => compileLlms(env, raw),
    write: (compiled) => writeLlmsRow(env, compiled.raw),
    remove: async () => {
      throw new Error("sync_llms never removes the llms.txt row: a repository without the file is refused first.");
    },
    purge: purgeLlms,
  });
}

/**
 * The CV's PDF: renders it from the CV D1 holds now and replaces the one stored object, unless the stored object
 * already carries that CV's fingerprint (then it renders nothing). The same door a CV save's background render
 * uses (ensureCvPdf), then read back: `converged` is the stored fingerprint equalling the data's, derived here and
 * never asserted. A failed render is thrown, so the repair reports failure instead of success, and nothing
 * stored is changed by it.
 */
export async function syncCvPdf(env: OperatorEnv): Promise<ToolResult> {
  const outcome = await ensureCvPdf(env);
  const [stored, cv] = await Promise.all([storedCvPdfFingerprint(env), readCv(env)]);
  const present = stored === (await cvFingerprint(cv)) ? 1 : 0;
  return {
    ok: true,
    data: {
      action: outcome.action,
      fingerprint: outcome.fingerprint,
      ...(outcome.action === "stored" ? { bytes: outcome.bytes, purged: outcome.purged } : {}),
      expected: 1,
      present,
      drift: 1 - present,
      converged: present === 1,
    },
  };
}

/**
 * The roster: the compile and write doors a roster save uses. A cohort is one row, written whole, and the purge
 * reaches both pages that embed it (purgeRoster).
 */
export async function syncRoster(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_roster",
    dir: ROSTER_DIR,
    noun: "cohort",
    read: () => readRosterSides(env),
    compile: (slug, raw) => compileRosterFile(env, slug, raw),
    write: (compiled) => writeRosterRow(env, compiled),
    remove: (row) => deleteRosterRow(env, row),
    purge: purgeRoster,
  });
}

/**
 * The phage table: the compile and write doors a phage save uses. The page /research/phages is compiled from the
 * rows, so before any row moves the page row is re-derived ONCE from the final set (this repository's files
 * where they compile, D1's row where one does not, minus the phages whose file is gone), and each phage row is
 * written after it. A failure of that refresh stops the repair with every phage still reading drifted, so the
 * next run retries it. The purge reaches the one page that embeds the table (purgePhages).
 */
export async function syncPhages(env: OperatorEnv): Promise<ToolResult> {
  return convergeKind(env, {
    tool: "sync_phages",
    dir: PHAGES_DIR,
    noun: "phage",
    read: () => readPhageSides(env),
    compile: (slug, raw) => compilePhageFile(env, slug, raw),
    write: (compiled) => writePhageRow(env, compiled),
    remove: (row) => deletePhageRow(env, row),
    purge: purgePhages,
    settle: async ({ files, drift }) => {
      const bySlug = new Map<string, Phage>((await listPhages(env)).map((phage) => [phageSlug(phage.name), phage]));
      const pathOf = new Map(files.map((f) => [f.slug, f.path]));
      for (const slug of [...drift.changed, ...drift.unrowed]) {
        const path = pathOf.get(slug);
        const file = path ? await readFile(env, path) : null;
        if (!file) continue;
        // A file that does not compile keeps whatever D1 holds for it; convergeKind then reports it as a 422.
        const compiled = await compilePhageFile(env, slug, file.content);
        if (compiled.ok) bySlug.set(slug, compiled.phage);
      }
      for (const slug of drift.unfiled) bySlug.delete(slug);
      await refreshPhagePage(env, [...bySlug.values()]);
    },
  });
}

/**
 * The registry: the compile and write doors a registry save uses. Nothing else is derived from a registry row, so
 * there is no settle step, and the purge is the registry's tag. It has no files until a kind brings records, so an
 * empty set with no rows is converged (emptyOk); an empty set with rows is refused like every other kind's.
 */
export async function syncRegistry(env: OperatorEnv): Promise<ToolResult> {
  const result = await convergeKind(env, {
    tool: "sync_registry",
    dir: REGISTRY_DIR,
    noun: "registry item",
    read: () => readRegistrySides(env),
    compile: (slug, raw) => compileRegistryFile(env, slug, raw),
    write: (compiled) => writeRegistryRow(env, compiled),
    remove: (row) => deleteRegistryRow(env, row),
    purge: purgeRegistry,
    emptyOk: true,
  });
  // The protocols that print a primer carry its facts in their record, so every one that names a primer is recompiled
  // from its file after the primers converge: a primer edited through git reaches them here, and a protocol left reading
  // an old sequence by a failed save is repaired by the same run.
  const refreshed = await refreshProceduresNaming(env, null);
  return result.ok ? { ok: true, data: { ...(result.data as object), protocolsRefreshed: refreshed.length } } : result;
}

// Stores reported SEPARATELY: they fail independently. Exported because the cockpit renders this rather
// than computing a second answer.
export async function syncStatus(env: OperatorEnv) {
  // Counted through Drizzle: interpolating the predicate into a template string stringifies the object and
  // D1 answers `no such column`. `publiclyVisible()` is reused so the visibility rule has one owner.
  const db = getDb(env);
  // The stores are separate and each read is independent (GitHub twice, D1 three times, KV once), so they run
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
    if (typeof row?.n !== "number") throw new Error(`syncStatus: the ${what} count returned no row`);
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
    githubConfigured: Boolean(env.GITHUB_TOKEN),
    // Read from KV: a record of a D1 failure kept in D1 is missing exactly when it matters. `known: false`
    // is not the same answer as an empty list.
    divergences,
  };
}
