import { longDateUTC } from "~/lib/long-date.mjs";
import { safeHttpHref } from "~/lib/webmention/urls.mjs";

import type { Route } from "../routes/+types/blog.$slug";

/**
 * Mention text is third party: rendered as escaped React children, never `dangerouslySetInnerHTML`,
 * and the one `href` is re-parsed by `safeHttpHref`.
 */
function Mention({
  mention,
}: {
  mention: Route.ComponentProps["loaderData"]["mentions"][number];
}) {
  /* A row whose URLs both fail still renders as text: dropping it would hide something the admin approved. */
  const href = safeHttpHref(mention.authorUrl) ?? safeHttpHref(mention.sourceUrl);

  /* Falls back to the source URL, a fact, never an invented name attributed to a real person. */
  const name = mention.authorName ?? mention.sourceUrl;
  const decided = longDateUTC(mention.decidedAt);

  return (
    <li>
      {href ? (
        <a href={href} rel="nofollow ugc noopener noreferrer">
          {name}
        </a>
      ) : (
        <span>{name}</span>
      )}
      {mention.excerpt ? <p className="post-mention-excerpt">{mention.excerpt}</p> : null}
      {decided ? (
        <time className="post-mention-date" dateTime={new Date(mention.decidedAt!).toISOString()}>
          {decided}
        </time>
      ) : null}
    </li>
  );
}

/** Approved webmentions, each a `Mention`. */
export function PostMentions({
  mentions,
}: {
  mentions: Route.ComponentProps["loaderData"]["mentions"];
}) {
  return (
    <section className="post-mentions" aria-labelledby="mentions-heading">
      <h2 id="mentions-heading">Mentions</h2>
      <ul>
        {mentions.map((mention) => (
          <Mention key={mention.id} mention={mention} />
        ))}
      </ul>
    </section>
  );
}
