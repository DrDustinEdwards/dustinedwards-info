// Frozen procedure versions (drizzle/0027_procedure_versions.sql): the rendered copy of every published version,
// written once and never changed. Read by the version pages and the twin at `<page>/v/<version>`; written by
// freezeStatement, in the same batch as the live row (app/lib/procedures/save.server.ts, writeRow).
import { and, asc, eq } from "drizzle-orm";

import type { ProcedureRecord } from "~/lib/procedures/render.mjs";

import { getDb } from "./client";
import { procedureVersions } from "./schema";

export type FrozenVersion = {
  slug: string;
  version: string;
  path: string;
  profile: "protocol" | "recipe" | "computational";
  record: ProcedureRecord;
  markdown: string;
  sourceBlobSha: string;
};

/** The sealed copy of a procedure's version, or null. An unsealed row (a sync part way through) is never served. */
export async function getFrozenVersion(env: Env, path: string, version: string): Promise<FrozenVersion | null> {
  const row = (
    await getDb(env)
      .select()
      .from(procedureVersions)
      .where(and(eq(procedureVersions.path, path), eq(procedureVersions.version, version), eq(procedureVersions.sealed, 1)))
      .limit(1)
  )[0];
  if (!row) return null;
  return {
    slug: row.slug,
    version: row.version,
    path: row.path,
    profile: row.profile,
    record: JSON.parse(row.record) as ProcedureRecord,
    markdown: row.markdown,
    sourceBlobSha: row.sourceBlobSha,
  };
}

/** The frozen versions of a procedure, oldest first, as the history links them. */
export async function listFrozenVersions(env: Env, slug: string): Promise<string[]> {
  const rows = await getDb(env)
    .select({ version: procedureVersions.version })
    .from(procedureVersions)
    .where(and(eq(procedureVersions.slug, slug), eq(procedureVersions.sealed, 1)))
    .orderBy(asc(procedureVersions.frozenAt));
  return rows.map((r) => r.version);
}

/** The blob sha a version was frozen from, or null when it has no sealed copy. */
export async function frozenBlobSha(env: Env, slug: string, version: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT source_blob_sha FROM procedure_versions WHERE slug = ?1 AND version = ?2 AND sealed = 1")
    .bind(slug, version)
    .first<{ source_blob_sha: string }>();
  return row?.source_blob_sha ?? null;
}

/**
 * The statement that freezes a version: inserted sealed, and left alone when a sealed copy exists. It may replace a
 * row still unsealed (an interrupted sync:content), which the triggers allow. Bound parameters carry the record and the
 * twin, so D1's 100 KB statement cap does not apply.
 */
export function freezeStatement(
  db: D1Database,
  frozen: { slug: string; version: string; path: string; profile: string; record: string; markdown: string; sourceBlobSha: string },
) {
  return db
    .prepare(
      `INSERT INTO procedure_versions (slug, version, path, profile, record, markdown, source_blob_sha, sealed)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)
       ON CONFLICT(slug, version) DO UPDATE SET path = excluded.path, profile = excluded.profile, record = excluded.record,
         markdown = excluded.markdown, source_blob_sha = excluded.source_blob_sha, sealed = 1, frozen_at = unixepoch()
       WHERE procedure_versions.sealed = 0`,
    )
    .bind(frozen.slug, frozen.version, frozen.path, frozen.profile, frozen.record, frozen.markdown, frozen.sourceBlobSha);
}
