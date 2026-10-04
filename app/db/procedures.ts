// The procedures table: read by the procedure pages, the sitemap and the operator API. Written only by
// writeProcedureRow, from a compile (app/lib/procedures/compile.mjs).
import { and, asc, eq, inArray } from "drizzle-orm";

import { PUBLISHED_STATUS } from "~/lib/search/visibility.mjs";
import type { ProcedureRecord } from "~/lib/procedures/render.mjs";

import { getDb } from "./client";
import { procedures } from "./schema";

export type ProcedureRow = {
  slug: string;
  path: string;
  status: "draft" | "published";
  record: ProcedureRecord;
};

/** The page's row, or null. A draft comes back too: the route decides who may see it. */
export async function getProcedureByPath(env: Env, path: string): Promise<ProcedureRow | null> {
  const row = (
    await getDb(env)
      .select({ slug: procedures.slug, path: procedures.path, status: procedures.status, record: procedures.record })
      .from(procedures)
      .where(eq(procedures.path, path))
      .limit(1)
  )[0];
  if (!row) return null;
  return { ...row, record: JSON.parse(row.record) as ProcedureRecord };
}

/** The twin, published rows only: a draft's twin answers 404 like its page. */
export async function getPublishedProcedureMarkdown(env: Env, path: string) {
  const row = (
    await getDb(env)
      .select({ markdown: procedures.markdown })
      .from(procedures)
      .where(and(eq(procedures.path, path), eq(procedures.status, PUBLISHED_STATUS)))
      .limit(1)
  )[0];
  return row?.markdown ?? null;
}

/** For the sitemap and llms-full: the published pages, by path. */
export async function listPublishedProcedures(env: Env) {
  return getDb(env)
    .select({ path: procedures.path, title: procedures.title, description: procedures.description, updated: procedures.updated, markdown: procedures.markdown })
    .from(procedures)
    .where(eq(procedures.status, PUBLISHED_STATUS))
    .orderBy(asc(procedures.path));
}

/** For the operator's list_procedures: every row, drafts included. */
export async function listProceduresForOperator(env: Env) {
  const rows = await getDb(env)
    .select({
      slug: procedures.slug,
      path: procedures.path,
      profile: procedures.profile,
      title: procedures.title,
      status: procedures.status,
      version: procedures.version,
      updated: procedures.updated,
      record: procedures.record,
    })
    .from(procedures)
    .orderBy(asc(procedures.slug));
  return rows.map(({ record, status, ...row }) => {
    const parsed = JSON.parse(record) as ProcedureRecord;
    return {
      ...row,
      draft: status === "draft",
      gaps: parsed.gaps.length,
      // The admin's view, so Dustin can find the protocols still to set: the level, or MISSING. Public output never says MISSING.
      biosafetyLevel: row.profile === "protocol" ? (parsed.biosafetyLevel ?? "MISSING") : null,
    };
  });
}

/** For the protocol library: every published protocol and computational method, with its full record. */
export async function listPublishedLibraryRecords(env: Env): Promise<ProcedureRecord[]> {
  const rows = await getDb(env)
    .select({ record: procedures.record })
    .from(procedures)
    .where(and(eq(procedures.status, PUBLISHED_STATUS), inArray(procedures.profile, ["protocol", "computational"])))
    .orderBy(asc(procedures.path));
  return rows.map((row) => JSON.parse(row.record) as ProcedureRecord);
}
