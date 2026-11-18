// No `dt-` class on these dates: the rail already publishes `dt-published` and `dt-updated`,
// and a second set in the same tree would tell a parser the post has many update times.
type ChangelogEntry = { date: string; note: string };

export function PostHistory({ entries }: { entries: ChangelogEntry[] }) {
  if (entries.length === 0) return null;

  // Dates are YYYY-MM-DD, so a string compare is a date compare.
  const ordered = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <p className="post-history">
      <span className="post-history-label">Post history</span>
      {ordered.map((fact, i) => (
        <span key={`${fact.date} ${fact.note}`}>
          {i > 0 ? " · " : null}
          <time className="post-history-value" dateTime={fact.date}>
            {fact.date}
          </time>{" "}
          {fact.note}
        </span>
      ))}
    </p>
  );
}
