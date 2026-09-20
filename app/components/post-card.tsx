import { Link } from "react-router";

import { longDateUTC } from "~/lib/long-date.mjs";
import { tagPath } from "~/lib/tag-path.mjs";

/**
 * One post in a listing. EXTRACTED rather than copied, because two copies of
 * thirty lines of markup are two places a field gets added and one place it gets
 * forgotten, which is how the index and the archive would come to show different
 * things about the same post.
 */
export type CardPost = {
  slug: string;
  title: string;
  description: string | null;
  publishAt: Date | string | null;
  readingTimeMinutes: number | null;
  series: string | null;
  part: number | null;
  tags: string[];
};

export function PostCard({ post }: { post: CardPost }) {
  return (
    /*
     * A SUMMARY ENTRY, not a truncated full one: it deliberately carries no
     * `e-content`, because a consumer that finds content on a listing entry has been
     * handed a summary labelled as the article.
     *
     * `u-url` is on the anchor rather than the `<li>`, because the anchor is where the
     * address actually is.
     */
    <li className="post-card h-entry">
      <h2 className="post-card-title p-name">
        <Link className="u-url" to={`/blog/${post.slug}`}>
          {post.title}
        </Link>
      </h2>
      <p className="post-card-meta">
        {post.publishAt && (
          <time className="dt-published" dateTime={new Date(post.publishAt).toISOString()}>
            {longDateUTC(post.publishAt)}
          </time>
        )}
        {post.readingTimeMinutes && <> · {post.readingTimeMinutes} min read</>}
      </p>
      {post.series && (
        <p className="post-card-series">
          {post.series}, part {post.part}
        </p>
      )}
      {post.description && <p className="p-summary">{post.description}</p>}
      {post.tags.length > 0 && (
        <p className="post-card-tags">
          {/*
           * THE TAG NAME IS A LINK TO THE ARCHIVE, not to a filtered index: every card was
           * linking at the non-canonical address of a page that exists at a better one. The
           * chips on `/blog` keep the filtered view, because their job is composing with the
           * year beside them.
           */}
          {post.tags.map((tag) => (
            <Link key={tag} to={tagPath(tag)}>
              {tag}
            </Link>
          ))}
        </p>
      )}
    </li>
  );
}

/**
 * `hrefFor` is passed in because the two listings paginate at different URLs: the
 * index composes a query string of three axes, the archive appends `?page=` to a
 * path. The MARKUP is what has to be identical, and it is.
 */
export function Pagination({
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
    <nav className="pagination" aria-label="Pagination">
      {page > 1 && <Link to={hrefFor(page - 1)}>Newer</Link>}
      <span className="muted">
        Page {page} of {pageCount}
      </span>
      {page < pageCount && <Link to={hrefFor(page + 1)}>Older</Link>}
    </nav>
  );
}
