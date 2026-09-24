import {
  SERP_DESCRIPTION_LIMIT,
  SERP_TITLE_LIMIT,
  SITE,
  postSocial,
  truncateForSerp,
} from "~/lib/seo";

// Both read from postSocial, the function the post route's meta() calls, so they cannot drift silently.

export type PreviewPost = {
  slug: string;
  title: string;
  description: string;
  coverSrc: string;
  coverAlt: string;
};

// No ogImage: whether a build:og card exists is a fact about R2 the editor cannot know.
function fromEditor(post: PreviewPost) {
  return postSocial({
    slug: post.slug,
    title: post.title,
    description: post.description,
    coverImage: post.coverSrc || null,
  });
}

export function SerpPreview({ post }: { post: PreviewPost }) {
  const social = fromEditor(post);
  const title = truncateForSerp(social.pageTitle, SERP_TITLE_LIMIT);
  const description = truncateForSerp(social.description, SERP_DESCRIPTION_LIMIT);

  return (
    <div className="serp-preview">
      <p className="serp-url">
        {social.canonical.replace(/^https?:\/\//, "").replace(/\//g, " › ")}
      </p>
      <p className="serp-title">{title}</p>
      <p className="serp-description">{description}</p>

      {title !== social.pageTitle || description !== social.description ? (
        <p className="serp-note">
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

export function OgPreview({ post }: { post: PreviewPost }) {
  const social = fromEditor(post);

  return (
    <div className="og-preview">
      <div className="og-preview-image">
        {/* No placeholder when there is no cover: the post gets the site mark, so that is what is shown. */}
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
