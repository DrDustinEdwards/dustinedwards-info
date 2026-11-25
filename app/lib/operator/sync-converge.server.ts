// The shared converge loop for the kinds that rebuild D1 rows from repository files.

import { EditorError } from "~/lib/editor/publish.server";
import { readFile } from "~/lib/source/store.server";
import { contentDriftCompare } from "~/lib/health/verdicts.mjs";
import type { OperatorEnv } from "./auth.server";
import type { ToolResult } from "./descriptors";

/** A converge's answer, read after its writes: D1 reads its own writes in-request, so drift reported here is real. */
export function convergedResult(
  after: {
    files: Array<{ slug: string; sha: string }>;
    rows: Array<{ slug: string; source_blob_sha: string | null }>;
  },
  counts: { repaired: number; removed: number; unpurged: number },
): ToolResult {
  const residual = contentDriftCompare(after.files, after.rows);
  const residualCount = residual.changed.length + residual.unrowed.length + residual.unfiled.length;
  return {
    ok: true,
    data: {
      ...counts,
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
type CompiledOk<Result extends CompileResult> = Extract<Result, { ok: true }> & {
  sourceBlobSha: string;
};

type KindSync<
  Row extends { slug: string; source_blob_sha: string | null },
  Result extends CompileResult,
> = {
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
  settle?: (plan: {
    files: DriftSides<Row>["files"];
    rows: Row[];
    drift: ReturnType<typeof contentDriftCompare>;
  }) => Promise<void>;
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
 * honoring it would delete every row.
 *
 * A file that fails the validator cannot be written: every other drifted file is still converged, then the
 * failures are returned as a 422 naming each file and its messages, so the repair never reports success
 * over a file it could not apply.
 */
export async function convergeKind<
  Row extends { slug: string; source_blob_sha: string | null },
  Result extends CompileResult,
>(env: OperatorEnv, spec: KindSync<Row, Result>): Promise<ToolResult> {
  const before = await spec.read();
  if (before.files.length === 0 && before.rows.length === 0 && spec.emptyOk) {
    return {
      ok: true,
      data: { repaired: 0, removed: 0, unpurged: 0, expected: 0, present: 0, converged: true },
    };
  }
  if (before.files.length === 0) {
    return {
      ok: false,
      status: 422,
      error:
        `${spec.tool} refused: ${spec.dir} lists no ${spec.noun} files, and converging to an empty set ` +
        `would delete every ${spec.noun} row. Check the source listing.`,
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
        failed
          .map((f) => `${f.path} fails ${f.errors.length} check(s), first: ${f.errors[0]}`)
          .join("; ") +
        `. The other ${repaired} drifted ${spec.noun}(s) were converged.`,
      detail: { failed, repaired, removed },
    };
  }

  return convergedResult(await spec.read(), { repaired, removed, unpurged });
}
