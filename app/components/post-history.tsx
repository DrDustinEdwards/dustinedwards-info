import { longDateUTC } from "~/lib/long-date.mjs";

/**
 * The author-written post history: one line per revision, saying what changed.
 *
 * IT ANSWERS THE QUESTION `updatedAt` CANNOT. The row's timestamp says when something happened and
 * is rewritten by every sync, which is why the page puts a threshold in front of it. This says
 * what, and only the author has that.
 *
 * WHETHER IT APPEARS AT ALL IS THE ROUTE'S DECISION, not this component's. The same 24-hour
 * threshold that governs the "Updated" line governs this, so the comparison has one owner and a
 * post cannot claim a revision in one place and deny it in the other.
 *
 * CLOSED BY DEFAULT AND OPEN ON PAPER. It is the history of the argument rather than the argument,
 * so it does not sit between a reader and the end of the post; a printed page has no disclosure to
 * click, so the print sheet opens it.
 *
 * NOT MICROFORMATS. Each date is a plain `time` with no `dt-` class: the h-entry already publishes
 * `dt-updated`, and a second set of dates in the same tree would tell a parser the post has many
 * update times.
 */
export type ChangelogEntry = { date: string; note: string };

export function PostHistory({ entries }: { entries: ChangelogEntry[] }) {
  if (entries.length === 0) return null;

  /*
   * NEWEST FIRST, SORTED HERE. The dates are YYYY-MM-DD, so a string compare is a date compare, and
   * doing it at render means an author may append a line to the end of the list in the file, which
   * is where a hand writes one.
   */
  const ordered = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <details className="post-history">
      <summary>Post history</summary>
      <ol className="post-history-list">
        {ordered.map((entry) => (
          <li key={`${entry.date} ${entry.note}`}>
            <time dateTime={entry.date}>{longDateUTC(`${entry.date}T00:00:00Z`)}</time>{" "}
            {entry.note}
          </li>
        ))}
      </ol>
    </details>
  );
}
