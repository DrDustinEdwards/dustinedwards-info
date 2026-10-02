// The dictionary_entries table: read by the content-page route for the lead and the DefinedTerm, by the page
// compile for the twin and the search record, and by the operator API. Written only by writeRow in
// app/lib/dictionary/save.server.ts and by sync:content, from a compile (app/lib/dictionary/compile.mjs).
import { and, asc, eq } from "drizzle-orm";

import type { DictionaryEntry } from "~/lib/dictionary-entries.mjs";
import { PUBLISHED_STATUS } from "~/lib/search/visibility.mjs";

import { getDb } from "./client";
import { dictionaryEntries } from "./schema";

/** The published entry that opens a page, or null: a page with none shows no lead, and a draft shows none either. */
export async function getPublishedEntryByPath(env: Env, path: string): Promise<DictionaryEntry | null> {
  const row = (
    await getDb(env)
      .select({ record: dictionaryEntries.record })
      .from(dictionaryEntries)
      .where(and(eq(dictionaryEntries.path, path), eq(dictionaryEntries.status, PUBLISHED_STATUS)))
      .limit(1)
  )[0];
  return row ? (JSON.parse(row.record) as DictionaryEntry) : null;
}

/** For list_dictionary and Carrel's list: every row, drafts included, with when D1 last wrote it. */
export async function listDictionaryRows(env: Env) {
  const rows = await getDb(env)
    .select({
      key: dictionaryEntries.key,
      path: dictionaryEntries.path,
      term: dictionaryEntries.term,
      status: dictionaryEntries.status,
      syncedAt: dictionaryEntries.syncedAt,
    })
    .from(dictionaryEntries)
    .orderBy(asc(dictionaryEntries.path));
  return rows.map(({ status, ...row }) => ({ ...row, draft: status === "draft" }));
}
