// The statements that replace one document's search records and rebuild both indexes: what a save of a page, and
// the CV, write beside their own row. One owner, so the column list and the rebuild cannot differ between them.

import { recordsForPages } from "./records.mjs";

export type SearchRecords = ReturnType<typeof recordsForPages>;

/**
 * Deletes the records whose doc_uid is `uid`, inserts `records`, and rebuilds the two FTS indexes, as one batch
 * with whatever statements the caller puts in front of it.
 */
export function replaceSearchRecords(db: D1Database, uid: string, records: SearchRecords): D1PreparedStatement[] {
  return [
    db.prepare(`DELETE FROM search_docs WHERE doc_uid = ?1`).bind(uid),
    ...records.map((s) =>
      db
        .prepare(
          `INSERT INTO search_docs (uid, url, type, title, body, tags, doc_tags, doc_uid,
             doc_title, doc_url, anchor, ordinal, status, publish_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)`,
        )
        .bind(s.uid, s.url, s.type, s.title, s.body, s.tags, s.docTags, s.docUid, s.docTitle, s.docUrl, s.anchor, s.ordinal, s.status, null),
    ),
    db.prepare(`INSERT INTO search_identity (search_identity) VALUES ('rebuild')`),
    db.prepare(`INSERT INTO search_prose (search_prose) VALUES ('rebuild')`),
  ];
}
