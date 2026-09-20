/**
 * The three optional author-set blocks at the top of a post: writing status, assumed audience and
 * key takeaways, as ruled `dl` rows.
 *
 * ALL THREE ARE OPTIONAL AND MOST POSTS CARRY NONE. The component renders nothing at all when a
 * post sets none of them, so the ordinary post's markup is unchanged. A row a post has nothing to
 * say in is omitted rather than filled.
 *
 * A `dl` AND NOT HEADINGS, which is the change Direction D made and the reason it matters: the
 * takeaways used to carry an `h2`, so every post that set them put a heading in the contents list
 * that was not one of the article's own sections. Labels are `dt`, values are `dd`, and the
 * heading list is the argument's.
 *
 * NONE OF THEM IS A BYLINE, and that is the constraint worth stating rather than discovering. The
 * missing byline on this site is deliberate: there is one author, the site is his name, and a
 * hidden `p-author` h-card carries it for microformats. A line naming a person in this block would
 * reintroduce by accident exactly what was removed on purpose. None of these three names anybody:
 * the status describes the POST, the audience line describes the READER, and the takeaways
 * describe the ARGUMENT.
 *
 * THEY ARE NOT MICROFORMATS. No `p-` or `dt-` class goes on any of this. The h-entry is a contract
 * with parsers about what a post IS; an editorial status is the author talking to a reader, and
 * publishing "draft" into a syndication feed as though it were structured data would be a claim
 * this site does not want to make.
 */

/** The five words, in the order a post moves through them. The type is the pipeline's. */
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

      {/* The only row that may be a list, because it is the only one that is several claims. */}
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
