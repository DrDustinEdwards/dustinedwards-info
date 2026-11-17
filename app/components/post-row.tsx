import { Link } from "react-router";

import "capsomer/eyebrow.css";
import { formatDate } from "capsomer/behavior/time";
import { tagPath } from "~/lib/tag-path.mjs";

type RowPost = {
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
            {formatDate(post.publishAt)}
          </time>
        )}
        {post.readingTimeMinutes ? (
          <span className="entry-minutes">{post.readingTimeMinutes} min</span>
        ) : null}
        {mark ? <span className="entry-mark">{mark}</span> : null}
      </p>
      <div className="entry-body">
        <h2 className="entry-title p-name">
          <Link className="u-url" to={`/writing/${post.slug}`}>
            {post.title}
          </Link>
        </h2>
        {post.series && (
          <p className="cap-eyebrow entry-series" data-variant="mono">
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
