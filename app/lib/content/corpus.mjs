// Corpus-wide passes, run over every post at once in both writers: related posts and backlinks.

import { isPubliclyVisible, statusForDraft } from "../search/visibility.mjs";

const RELATED_LIMIT = 3;

/**
 * Newest first, then by slug: a total order, so a tie is never left to array order.
 *
 * @param {{ publishAt: string, slug: string }} a
 * @param {{ publishAt: string, slug: string }} b
 */
function newestThenSlug(a, b) {
  return (a.publishAt < b.publishAt ? 1 : a.publishAt > b.publishAt ? -1 : 0) || (a.slug < b.slug ? -1 : 1);
}

/**
 * Must run over the whole corpus in both writers: relatedness is a property of the set.
 * isPubliclyVisible, not !draft, because a scheduled post is not a draft. blog.$slug.tsx filters
 * again because a listed post can be unpublished after this list is stored.
 *
 * @param {any[]} posts
 */
export function withRelated(posts) {
  const now = Date.now();
  return posts.map((post) => {
    const tags = new Set(post.tags);
    const scored = posts
      .filter(
        (other) =>
          other.slug !== post.slug &&
          isPubliclyVisible(
            { status: statusForDraft(other.draft), publishAt: other.publishAt },
            now,
          ),
      )
      .map((other) => ({
        slug: other.slug,
        title: other.title,
        description: other.description ?? null,
        shared: other.tags.filter((/** @type {string} */ t) => tags.has(t)).length,
        publishAt: other.publishAt,
      }))
      .filter((other) => other.shared > 0);

    scored.sort(
      (a, b) =>
        b.shared - a.shared || newestThenSlug(a, b),
    );

    return {
      ...post,
      related: scored
        .slice(0, RELATED_LIMIT)
        .map(({ slug, title, description, shared }) => ({ slug, title, description, shared })),
    };
  });
}

/**
 * Read from rendered HTML, which unifies inline, reference and raw links. Deliberately loose: the
 * corpus in withBacklinks is the filter.
 *
 * @param {string} html
 * @returns {Set<string>}
 */
function outgoingPostLinks(html) {
  const found = new Set();
  for (const match of html.matchAll(/href="\/blog\/([^"#?]+)(?:[#?][^"]*)?"/g)) {
    found.add(match[1]);
  }
  return found;
}

/**
 * Whole corpus, like withRelated. The SOURCE is filtered for visibility so a draft cannot put its title
 * on a public page; blog.$slug.tsx re-checks. No limit: a cap would silently drop real links.
 *
 * @param {any[]} posts
 */
export function withBacklinks(posts) {
  const now = Date.now();
  const isPost = new Set(posts.map((post) => post.slug));
  /** @type {Map<string, Array<{ slug: string, title: string, publishAt: string }>>} */
  const incoming = new Map();

  for (const post of posts) {
    if (
      !isPubliclyVisible(
        { status: statusForDraft(post.draft), publishAt: post.publishAt },
        now,
      )
    ) {
      continue;
    }
    for (const target of outgoingPostLinks(post.html ?? "")) {
      // A post linking to itself is a table of contents, not a backlink.
      if (target === post.slug || !isPost.has(target)) continue;
      const list = incoming.get(target) ?? [];
      list.push({ slug: post.slug, title: post.title, publishAt: post.publishAt });
      incoming.set(target, list);
    }
  }

  return posts.map((post) => {
    // Never leave a tie to array order, which is not stable input.
    const list = (incoming.get(post.slug) ?? []).sort(newestThenSlug);
    return {
      ...post,
      backlinks: list.map(({ slug, title }) => ({ slug, title })),
    };
  });
}
