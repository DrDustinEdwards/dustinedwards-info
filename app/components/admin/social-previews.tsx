import {
  SERP_DESCRIPTION_LIMIT,
  SERP_TITLE_LIMIT,
  SITE,
  postSocial,
  truncateForSerp,
} from "~/lib/seo";

/**
 * Both read from `postSocial`, the SAME function the post route's `meta()`
 * calls. A preview that derived its own version would eventually disagree with the
 * page, and it would disagree SILENTLY, because no view renders both at once for a
 * human to compare.
 *
 * These are previews of the head tags, not of a search engine's rendering. What
 * they promise is "these are the strings the site emits, cut where they will be
 * cut".
 */

/** The fields both previews need, which is what the editor already holds. */
export type PreviewPost = {
  slug: string;
  title: string;
  description: string;
  coverSrc: string;
  coverAlt: string;
};

/**
 * `ogImage` is deliberately NOT supplied and that is not an omission: the
 * build:og card is a fact about R2 discovered at sync time, and the editor cannot
 * know whether one exists for a title the author is still typing. Claiming one
 * would be the preview inventing an image.
 */
function fromEditor(post: PreviewPost) {
  return postSocial({
    slug: post.slug,
    title: post.title,
    description: post.description,
    coverImage: post.coverSrc || null,
  });
}

/** A search result, cut where a search engine cuts rather than at the field counter. */
export function SerpPreview({ post }: { post: PreviewPost }) {
  const social = fromEditor(post);
  const title = truncateForSerp(social.pageTitle, SERP_TITLE_LIMIT);
  const description = truncateForSerp(social.description, SERP_DESCRIPTION_LIMIT);

  return (
    <div className="serp-preview">
      {/* The breadcrumb form Google shows, not the raw href. */}
      <p className="serp-url">
        {social.canonical.replace(/^https?:\/\//, "").replace(/\//g, " › ")}
      </p>
      <p className="serp-title">{title}</p>
      <p className="serp-description">{description}</p>

      {title !== social.pageTitle || description !== social.description ? (
        <p className="serp-note">
          {/* Named separately, because an author who shortens the description
              should not have to guess that the title was the problem. */}
          {[
            title !== social.pageTitle ? "title" : null,
            description !== social.description ? "description" : null,
          ]
            .filter(Boolean)
            .join(" and ")}{" "}
          will be truncated. The limits are approximate: search engines cut by
          pixel width, not by character count.
        </p>
      ) : null}
    </div>
  );
}

/** The social card, showing what actually gets emitted, including the fallback. */
export function OgPreview({ post }: { post: PreviewPost }) {
  const social = fromEditor(post);

  return (
    <div className="og-preview">
      <div className="og-preview-image">
        {/*
         * The real image, at the real URL, and NOT a placeholder when there is no cover:
         * a post with no cover gets the site mark, so that is what is shown. Inventing a
         * grey rectangle would hide the one case worth seeing.
         */}
        <img
          src={social.image}
          alt={
            social.usingDefaultImage
              ? "The site mark, used because this post has no cover"
              : post.coverAlt || "This post's cover image"
          }
          width={1200}
          height={630}
        />
      </div>
      <div className="og-preview-body">
        <p className="og-preview-host">
          {social.canonical.replace(/^https?:\/\//, "").split("/")[0]}
        </p>
        <p className="og-preview-title">{social.socialTitle}</p>
        <p className="og-preview-description">{social.socialDescription}</p>
      </div>

      {social.usingDefaultImage ? (
        <p className="og-preview-note">
          No cover set, so this shares as the {SITE.name} mark. A generated card
          may still replace it: build:og renders one per post and the editor
          cannot see whether it exists yet.
        </p>
      ) : null}
    </div>
  );
}
