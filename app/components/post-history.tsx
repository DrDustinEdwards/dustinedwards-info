/**
 * The post's provenance, as ONE mono line under a rule at the foot of the column.
 *
 * IT ANSWERS THE QUESTION `updatedAt` CANNOT. The row's timestamp says when something happened and
 * is rewritten by every sync, which is why the page puts a threshold in front of it. The notes say
 * what, and only the author has that.
 *
 * WHETHER IT APPEARS AT ALL IS THE ROUTE'S DECISION, not this component's. The same 24-hour
 * threshold that governs the rail's Updated line governs this, so the comparison has one owner and
 * a post cannot claim a revision in one place and deny it in the other.
 *
 * IT WAS A `details` AND IS NOT ANY MORE. Direction D gives the column one ruled line of machine
 * data rather than a disclosure: there is nothing left to hide, because the line is now four facts
 * rather than a list of paragraphs.
 *
 * NOT MICROFORMATS. Each date is plain text with no `dt-` class: the h-entry already publishes
 * `dt-published` and `dt-updated` in the rail, and a second set of dates in the same tree would
 * tell a parser the post has many update times.
 */
export type ChangelogEntry = { date: string; note: string };

export function PostHistory({
  entries,
  publishedAt,
  sourceHash,
}: {
  entries: ChangelogEntry[];
  publishedAt: string | null;
  sourceHash: string | null;
}) {
  if (entries.length === 0) return null;

  /*
   * OLDEST FIRST, which is the opposite of the list this replaced and is the reason to say so: the
   * line reads as a chronology left to right, so publication comes first and the most recent
   * revision sits nearest the hash describing the copy on screen. The dates are YYYY-MM-DD, so a
   * string compare is a date compare.
   */
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  /*
   * A FACT IS A DATE AND A SENTENCE, kept apart rather than joined into a string, because ruling
   * 118 item 6 gives the mono channel to the VALUE alone: the date is machine data and takes the
   * mono, the words beside it are prose and stay sans. Joining them made one text node that no
   * stylesheet could tell apart.
   */
  const facts = [
    ...(publishedAt ? [{ date: publishedAt, note: "first published" }] : []),
    ...ordered,
  ];

  return (
    <p className="post-history">
      <span className="post-history-label">Post history</span>
      {facts.map((fact, i) => (
        <span key={`${fact.date} ${fact.note}`}>
          {i > 0 ? " · " : null}
          <time className="post-history-value" dateTime={fact.date}>
            {fact.date}
          </time>{" "}
          {fact.note}
        </span>
      ))}
      {/* The hash is the whole claim the page makes about itself: it names the markdown this copy
          was rendered from. Absent on a row written before the column existed. */}
      {sourceHash ? (
        <>
          {" · rendered from source hash "}
          <span className="post-history-value">{sourceHash.slice(0, 7)}</span>
        </>
      ) : null}
    </p>
  );
}
