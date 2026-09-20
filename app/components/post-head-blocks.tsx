/**
 * The three optional author-set blocks at the top of a post: a status tag, an assumed-audience
 * line, and a key-takeaways box.
 *
 * ALL THREE ARE OPTIONAL AND MOST POSTS CARRY NONE. The component renders nothing at all when a
 * post sets none of them, so the ordinary post's markup is unchanged.
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

/**
 * A glyph per status, inline rather than from an icon set, per the repo's bundle-leanness rule.
 *
 * AT 12px WITH `currentColor`, so it survives forced-colors: the OS repaints the text colour and
 * the stroke follows. A background-image glyph disappears entirely in that mode.
 *
 * The glyph is `aria-hidden` because the word beside it carries the meaning. THE WORD IS NEVER
 * DROPPED in favour of the glyph: five shapes are not five things a reader learns at a glance.
 */
function StatusGlyph({ status }: { status: WritingStatus }) {
  const paths: Record<WritingStatus, React.ReactNode> = {
    notes: <path d="M4 4h10M4 8h10M4 12h6" />,
    draft: <path d="M3 13l2-5 7-7 3 3-7 7-5 2z" />,
    "in progress": <path d="M9 2a7 7 0 1 1-7 7" />,
    finished: <path d="M3 9l4 4 8-9" />,
    obsolete: <path d="M9 2a7 7 0 1 1-7 7M2 2l14 14" />,
  };
  return (
    <svg
      className="post-status-glyph"
      width="12"
      height="12"
      viewBox="0 0 18 18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[status]}
    </svg>
  );
}

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
    <div className="post-head-blocks">
      {writingStatus ? (
        <p className="post-status" data-status={writingStatus}>
          <StatusGlyph status={writingStatus} />
          {STATUS_LABEL[writingStatus]}
        </p>
      ) : null}

      {/*
       * A LABELLED LINE, not a bare sentence. "Physicists who have not met phage" reads as the
       * opening of the post without the label telling a reader it is about them.
       */}
      {assumedAudience ? (
        <p className="post-audience">
          <span className="post-audience-label">Assumed audience:</span> {assumedAudience}
        </p>
      ) : null}

      {/*
       * A NAMED REGION, not an aside. A reader who wants the answer before the argument should be
       * able to find this in a landmark list on purpose, and `aside` would put it in the tree as
       * tangential to a post it is in fact summarising.
       */}
      {takeaways.length > 0 ? (
        <section className="post-takeaways" aria-labelledby="takeaways-h">
          <h2 className="post-takeaways-h" id="takeaways-h">
            Key takeaways
          </h2>
          <ul>
            {takeaways.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
