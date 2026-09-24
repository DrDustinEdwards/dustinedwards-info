// No `dt-` class on these dates: the rail already publishes `dt-published` and `dt-updated`,
// and a second set in the same tree would tell a parser the post has many update times.
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

  // Dates are YYYY-MM-DD, so a string compare is a date compare.
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // Date and note stay separate nodes so the date alone takes the mono face.
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
      {/* Absent on a row written before the column existed. */}
      {sourceHash ? (
        <>
          {" · rendered from source hash "}
          <span className="post-history-value">{sourceHash.slice(0, 7)}</span>
        </>
      ) : null}
    </p>
  );
}
