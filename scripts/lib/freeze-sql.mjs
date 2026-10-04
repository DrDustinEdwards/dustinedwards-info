// The statements that freeze a published, versioned procedure's copy (drizzle/0027_procedure_versions.sql), the Node
// twin of freezeStatement in app/db/procedure-versions.ts. sync:content applies them at ship.
//
// A copy is written once and never changed, so unlike the live row it is only inserted: a sealed copy is left alone
// (the conflict clause does nothing, and the pieces below only ever append to an UNSEALED row). D1 refuses a statement
// over 100 KB, so the record and the twin go in pieces into an unsealed row, and the last statement seals it; a run that
// stops half way leaves a row the pages never serve, which the next run deletes and writes again.

import { textChunks } from "../../app/lib/content/chunks.mjs";
import { sqlLiteral as sql } from "./sql-literal.mjs";

/**
 * @param {{ slug: string, version: string | null, status: string, path: string, profile: string, record: string, markdown: string, sourceBlobSha: string }} r
 *   a row of content/generated/procedures.json
 * @returns {string[]}
 */
export function freezeSql(r) {
  if (r.status !== "published" || !r.version) return [];
  const key = `slug = ${sql(r.slug)} AND version = ${sql(r.version)}`;
  const [firstRecord = "", ...moreRecord] = textChunks(r.record);
  return [
    `DELETE FROM procedure_versions WHERE ${key} AND sealed = 0;`,
    `INSERT INTO procedure_versions (slug, version, path, profile, record, markdown, source_blob_sha, sealed) VALUES ` +
      `(${sql(r.slug)}, ${sql(r.version)}, ${sql(r.path)}, ${sql(r.profile)}, ${sql(firstRecord)}, '', ${sql(r.sourceBlobSha)}, 0) ` +
      `ON CONFLICT(slug, version) DO NOTHING;`,
    ...moreRecord.map((chunk) => `UPDATE procedure_versions SET record = record || ${sql(chunk)} WHERE ${key} AND sealed = 0;`),
    ...textChunks(r.markdown).map((chunk) => `UPDATE procedure_versions SET markdown = markdown || ${sql(chunk)} WHERE ${key} AND sealed = 0;`),
    `UPDATE procedure_versions SET sealed = 1 WHERE ${key} AND sealed = 0;`,
  ];
}
