import { Link } from "react-router";

import { Signs } from "~/components/signs";
import { seriesPath } from "~/lib/series-path.mjs";

import type { Route } from "../routes/+types/blog.$slug";

type LoadedPost = Route.ComponentProps["loaderData"]["post"];

/** The series this post is a part of: every part, with this one marked, then the parts either side. */
export function SeriesNav({
  post,
  series,
  seriesParts,
}: {
  post: LoadedPost;
  /** `post.series`, narrowed: the caller renders this only for a post in a series. */
  series: string;
  seriesParts: Route.ComponentProps["loaderData"]["seriesParts"];
}) {
  const partIndex = seriesParts.findIndex((entry) => entry.slug === post.slug);
  const seriesPrevious = partIndex > 0 ? seriesParts[partIndex - 1] : undefined;
  const seriesNext =
    partIndex >= 0 && partIndex < seriesParts.length - 1
      ? seriesParts[partIndex + 1]
      : undefined;

  return (
    <nav className="post-series" aria-labelledby="series-heading">
      <h2 id="series-heading">
        Part {post.part} of {seriesParts.length}:{" "}
        <Link to={seriesPath(series)}>{series}</Link>
      </h2>
      <ol>
        {seriesParts.map((entry) => (
          <li key={entry.slug} aria-current={entry.slug === post.slug ? "true" : undefined}>
            {entry.slug === post.slug ? (
              <span>{entry.title}</span>
            ) : (
              <Link to={`/writing/${entry.slug}`}>{entry.title}</Link>
            )}
          </li>
        ))}
      </ol>
      {(seriesPrevious || seriesNext) && (
        <div className="post-series-steps">
          <Signs
            label={`Parts of ${series}`}
            prev={seriesPrevious ? { href: `/writing/${seriesPrevious.slug}`, title: seriesPrevious.title, label: "Previous part" } : null}
            next={seriesNext ? { href: `/writing/${seriesNext.slug}`, title: seriesNext.title, label: "Next part" } : null}
          />
        </div>
      )}
    </nav>
  );
}
