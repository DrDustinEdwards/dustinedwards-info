// The cv table: read by the CV page, its charts, its markdown twin and the operator API. Written only by
// writeCvRow in app/lib/cv/save.server.ts and by sync:content, from a compile (app/lib/cv/compile.mjs).
import { asc, eq } from "drizzle-orm";

import { compileCv } from "~/lib/cv/compile.mjs";
import type { CvFileRecord } from "~/lib/cv/types";

import { listPublishedPublications } from "./publications";
import { getDb } from "./client";
import { cv } from "./schema";

/** Every file's row, in slug order, with its record parsed. */
export async function listCvRows(env: Env) {
  const rows = await getDb(env)
    .select({
      slug: cv.slug,
      type: cv.type,
      record: cv.record,
      sourceBlobSha: cv.sourceBlobSha,
      syncedAt: cv.syncedAt,
    })
    .from(cv)
    .orderBy(asc(cv.slug));
  return rows.map(({ record, ...row }) => ({ ...row, record: JSON.parse(record) as CvFileRecord }));
}

/**
 * The CV as the page, the charts and the twin draw it: the rows joined to the published publication records
 * and compiled by the one door (compileCv). A set of rows that does not make a CV (a row missing before the
 * first sync, a cited paper unpublished since) throws, naming the repair, rather than answering a partial CV.
 */
export async function readCv(env: Env) {
  const [rows, publications] = await Promise.all([listCvRows(env), listPublishedPublications(env)]);
  const compiled = compileCv({ records: rows.map((row) => row.record), publications });
  if (!compiled.ok) {
    throw new Error(
      `The CV rows in D1 do not make a CV: ${compiled.errors.join("; ")}. The repair is the content sync ` +
        "(npm run sync:content, or the sync_cv operator tool).",
    );
  }
  return compiled.cv;
}

/**
 * The DOIs (lower-cased) the CV's publications file cites, as D1 holds them now. The publication save reads it to
 * refuse a change that would leave the CV citing a paper that is gone, and to know when a paper's save changes the CV.
 */
export async function listCvCitedDois(env: Env): Promise<Set<string>> {
  const row = (await getDb(env).select({ record: cv.record }).from(cv).where(eq(cv.slug, "publications")).limit(1))[0];
  if (!row) return new Set();
  const record = JSON.parse(row.record) as CvFileRecord;
  if (record.type === "profile") return new Set();
  return new Set(record.entries.flatMap((entry) => ("doi" in entry ? [entry.doi.toLowerCase()] : [])));
}
