// None of these may name a person: the missing byline is deliberate (a hidden `p-author` h-card
// carries it). No `p-` or `dt-` classes either, so a status like "draft" never reaches parsers as data.

const STATUS_LABEL = {
  notes: "Notes",
  draft: "Draft",
  "in progress": "In progress",
  finished: "Finished",
  obsolete: "Obsolete",
} as const;

export type WritingStatus = keyof typeof STATUS_LABEL;

export function PostHeadBlocks({
  writingStatus,
  assumedAudience,
  keyTakeaways,
}: {
  writingStatus: WritingStatus | null;
  assumedAudience: string | null;
  keyTakeaways: string[] | null;
}) {
  const takeaways = keyTakeaways ?? [];
  if (!writingStatus && !assumedAudience && takeaways.length === 0) return null;

  return (
    <dl className="post-blocks">
      {writingStatus ? (
        <div className="post-block">
          <dt>Writing status</dt>
          <dd>{STATUS_LABEL[writingStatus]}</dd>
        </div>
      ) : null}

      {assumedAudience ? (
        <div className="post-block">
          <dt>Assumed audience</dt>
          <dd>{assumedAudience}</dd>
        </div>
      ) : null}

      {takeaways.length > 0 ? (
        <div className="post-block">
          <dt>Key takeaways</dt>
          <dd>
            <ul>
              {takeaways.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}
