// The phages table: read by the page compile that draws the table on /research/phages (a page save and
// sync_pages read it here) and by the operator API. Written only by writePhageRow in
// app/lib/phages/save.server.ts and by sync:content, from a compile (app/lib/phages/compile.mjs).
import { asc } from "drizzle-orm";

import { sortPhages, type Phage } from "~/lib/phages/compile.mjs";

import { getDb } from "./client";
import { phages } from "./schema";

/**
 * Every phage, in the page's order. An empty table is a fault, never an empty table on the page: the page is
 * compiled from these rows, and a table the sync has not written yet must not quietly compile a page with no
 * phages on it (expandPhagePage refuses an empty set and names the sync).
 */
export async function listPhages(env: Env): Promise<Phage[]> {
  const rows = await getDb(env).select({ record: phages.record }).from(phages);
  return sortPhages(rows.map((row) => JSON.parse(row.record) as Phage));
}

/** For list_phages and Carrel's list: every row, with when D1 last wrote it. */
export async function listPhageRows(env: Env) {
  const rows = await getDb(env)
    .select({ slug: phages.slug, name: phages.name, year: phages.year, record: phages.record, syncedAt: phages.syncedAt })
    .from(phages)
    .orderBy(asc(phages.year), asc(phages.name));
  return rows.map(({ record, ...row }) => ({ ...row, phage: JSON.parse(record) as Phage }));
}
