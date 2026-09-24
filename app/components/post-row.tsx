import { Link } from "react-router";

import { longDateUTC } from "~/lib/long-date.mjs";
import { tagPath } from "~/lib/tag-path.mjs";

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
    // No `e-content`: this is a summary entry, and content here would be handed to consumers as the article.
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
