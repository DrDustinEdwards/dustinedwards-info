// The roster table: read by the home page's counts, the roster on /teaching/phage-discovery and the operator
// API. Written only by writeRosterRow in app/lib/roster/save.server.ts and by sync:content, from a compile
// (app/lib/roster/compile.mjs).
import { desc, sql } from "drizzle-orm";

import { sortCohorts, type Cohort } from "~/lib/roster/compile.mjs";

import { getDb } from "./client";
import { roster } from "./schema";

/**
 * Every cohort, newest first: the order the page lists them. An empty table is a fault, never an empty
 * roster: the page and the home page's counts are drawn from these rows, and a table the sync has not
 * written yet must not quietly render a page with no roster on it.
 */
export async function listRoster(env: Env): Promise<Cohort[]> {
  const rows = await getDb(env)
    .select({ record: roster.record })
    .from(roster)
    .orderBy(desc(roster.year));
  if (rows.length === 0) {
    throw new Error(
      "the roster table is empty, so there is no roster to draw. Run the content sync (npm run sync:content -- --remote), or sync_roster.",
    );
  }
  return sortCohorts(rows.map((row) => JSON.parse(row.record) as Cohort));
}

/**
 * What the home page counts, summed in D1 (`rosterFacts` over every cohort, without reading and parsing the
 * records, which carry each researcher's bio and photo). An empty table is the same fault as in `listRoster`.
 */
export async function rosterFactsFromDb(
  env: Env,
): Promise<{ researchers: number; cohorts: number; since: number }> {
  const [row] = await getDb(env)
    .select({
      researchers: sql<number>`coalesce(sum(json_array_length(json_extract(${roster.record}, '$.researchers'))), 0)`,
      cohorts: sql<number>`count(*)`,
      since: sql<number>`min(${roster.year})`,
    })
    .from(roster);
  if (!row || row.cohorts === 0) {
    throw new Error(
      "the roster table is empty, so there is nothing to count. Run the content sync (npm run sync:content -- --remote), or sync_roster.",
    );
  }
  return {
    researchers: Number(row.researchers),
    cohorts: Number(row.cohorts),
    since: Number(row.since),
  };
}

/** For Carrel's list: every row, with when D1 last wrote it. */
export async function listRosterRows(env: Env) {
  const rows = await getDb(env)
    .select({
      slug: roster.slug,
      year: roster.year,
      record: roster.record,
      syncedAt: roster.syncedAt,
    })
    .from(roster)
    .orderBy(desc(roster.year));
  return rows.map(({ record, ...row }) => ({ ...row, cohort: JSON.parse(record) as Cohort }));
}
