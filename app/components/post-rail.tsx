import type { Route } from "../routes/+types/blog.$slug";

type LoadedPost = Route.ComponentProps["loaderData"]["post"];

/** Below this, a contents list is furniture rather than a map. */
const TOC_MIN = 3;

export function ymd(value: Date | string | number) {
  return new Date(value).toISOString().slice(0, 10);
}

/** The rail: the machine-readable dates and, past `TOC_MIN` sections, the contents. */
export function PostRail({
  post,
  revisedLabel,
  sections,
}: {
  post: LoadedPost;
  revisedLabel: string | null;
  sections: Route.ComponentProps["loaderData"]["toc"];
}) {
  /* One authored date: `created_at` is when the sync ran, not when the post was written. */
  return (
    <div className="post-rail u-rail">
      <p className="post-machine">
        {post.publishAt && (
          <>
            <b>
              <time className="dt-published" dateTime={new Date(post.publishAt).toISOString()}>
                {ymd(post.publishAt)}
              </time>
            </b>
            first published
          </>
        )}
        {/* Conditional: emitting `updatedAt` regardless would publish a sync timestamp as an edit. */}
        {revisedLabel && (
          <>
            <b>
              <time className="dt-updated" dateTime={new Date(post.updatedAt!).toISOString()}>
                {ymd(post.updatedAt!)}
              </time>
            </b>
            Updated
          </>
        )}
      </p>

      {sections.length >= TOC_MIN && (
        <nav className="post-toc" aria-labelledby="contents-heading">
          <p id="contents-heading">Contents</p>
          <ol>
            {sections.map((entry) => (
              <li key={entry.id}>
                <a href={`#${entry.id}`}>{entry.text}</a>
              </li>
            ))}
          </ol>
        </nav>
      )}
    </div>
  );
}
