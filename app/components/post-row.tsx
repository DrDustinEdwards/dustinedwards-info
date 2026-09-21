import { Link } from "react-router";

import { longDateUTC } from "~/lib/long-date.mjs";
import { tagPath } from "~/lib/tag-path.mjs";

/**
 * One post in a listing, as a RULED ROW. This replaces `PostCard`, which was a card in a system
 * that has none: `.design-sync/conventions.md` has been telling the canvas that PostCard and
 * Pagination were deleted since the vocabulary was cut, while both went on shipping on `/blog` and
 * on the two archives. This file is what makes that sentence true.
 *
 * THE DATE COLUMN IS THE POST PAGE'S RAIL, read from `--rail-w` and `--rail-gap-w` in shell.css
 * rather than restated, so the index, the archives, the home rows and a post all put machine data
 * in the same column at the same measure. One number, four pages.
 *
 * EXTRACTED RATHER THAN COPIED, for the reason the card was: three listings render this markup and
 * a field added to one copy is a field missing from the other two.
 */
export type RowPost = {
  slug: string;
  title: string;
  description: string | null;
  publishAt: Date | string | null;
  readingTimeMinutes: number | null;
  series: string | null;
  part: number | null;
  tags: string[];
};

export function PostRow({ post, mark }: { post: RowPost; mark?: string }) {
  return (
    /*
     * A SUMMARY ENTRY, not a truncated full one: no `e-content`, because a consumer that finds
     * content on a listing entry has been handed a summary labelled as the article. `u-url` is on
     * the anchor, which is where the address actually is.
     */
    <li className="entry h-entry">
      <p className="entry-when">
        {post.publishAt && (
          <time className="dt-published" dateTime={new Date(post.publishAt).toISOString()}>
            {longDateUTC(post.publishAt)}
          </time>
        )}
        {post.readingTimeMinutes ? (
          <span className="entry-minutes">{post.readingTimeMinutes} min</span>
        ) : null}
        {/*
         * THE FEATURED MARKER IS A WORD IN THE MACHINE COLUMN, sentence case and mono, not a
         * tracked-caps label over a bordered well. Ruling 118 item 7 names that label; the post it
         * pointed at is worth pointing at either way, so the pointer moved rather than went.
         */}
        {mark ? <span className="entry-mark">{mark}</span> : null}
      </p>
      <div className="entry-body">
        <h2 className="entry-title p-name">
          <Link className="u-url" to={`/blog/${post.slug}`}>
            {post.title}
          </Link>
        </h2>
        {post.series && (
          <p className="entry-series">
            {post.series}, part {post.part}
          </p>
        )}
        {post.description && <p className="entry-summary p-summary">{post.description}</p>}
        {post.tags.length > 0 && (
          <p className="entry-tags">
            {/*
             * THE TAG NAME LINKS TO THE ARCHIVE, not to a filtered index: the archive is the
             * canonical address of that list. The filter row above the list keeps the filtered
             * view, because its job is composing with the year beside it.
             */}
            {post.tags.map((tag) => (
              <Link key={tag} to={tagPath(tag)}>
                {tag}
              </Link>
            ))}
          </p>
        )}
      </div>
    </li>
  );
}

/**
 * Newer, older, and where you are. `hrefFor` is passed in because the three listings paginate at
 * different URLs: the index composes a query string of three axes, the archives append `?page=` to
 * a path. The MARKUP is what has to be identical, and it is.
 */
export function Pager({
  page,
  pageCount,
  hrefFor,
}: {
  page: number;
  pageCount: number;
  hrefFor: (page: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <nav className="pager" aria-label="Pagination">
      {page > 1 && <Link to={hrefFor(page - 1)}>Newer</Link>}
      <span className="pager-where">
        Page {page} of {pageCount}
      </span>
      {page < pageCount && <Link to={hrefFor(page + 1)}>Older</Link>}
    </nav>
  );
}
