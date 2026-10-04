import type { Dispatch, SetStateAction } from "react";

import {
  SLUG_ATTRIBUTE_PATTERN,
  SLUG_MAX_LENGTH,
  SLUG_PATTERN,
} from "~/lib/content/slug.mjs";
import { seriesSlug } from "~/lib/series-path.mjs";

const TITLE_LIMIT = 70;

// Strips rather than transliterates: a wrong guess at a non-ASCII character lands in a permanent URL.
// The series rule, with apostrophes dropped rather than split on ("don't" is "dont") and a length cap.
function slugify(title: string) {
  return seriesSlug(title.replace(/['’]/g, ""))
    .slice(0, 80)
    .replace(/-+$/, "");
}

/** The title with its length count and, for a new post, the slug it derives until the author pins one. */
export function TitleSlugRow({
  title,
  setTitle,
  slug,
  setSlug,
  slugPinned,
  setSlugPinned,
  isNew,
  existingSlugs,
}: {
  title: string;
  setTitle: Dispatch<SetStateAction<string>>;
  slug: string;
  setSlug: Dispatch<SetStateAction<string>>;
  slugPinned: boolean;
  setSlugPinned: Dispatch<SetStateAction<boolean>>;
  isNew: boolean;
  existingSlugs: string[];
}) {
  const slugValid = SLUG_PATTERN.test(slug);
  const slugTaken = isNew && slug !== "" && existingSlugs.includes(slug);
  const slugProblem = slug === "" ? null : !slugValid ? "lowercase kebab-case only" : slugTaken ? "already taken" : null;

  return (
    <>
      <div className="cap-field">
        <label className="cap-field-label" htmlFor="field-title">
          Title
        </label>
        <input
          id="field-title"
          name="title"
          className="cap-input"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (isNew && !slugPinned) setSlug(slugify(event.target.value));
          }}
          placeholder="Untitled"
          required
          autoComplete="off"
          aria-describedby="title-count"
        />
        <span
          id="title-count"
          className="cap-field-help"
          data-over={title.length > TITLE_LIMIT ? "" : undefined}
        >
          {title.length}/{TITLE_LIMIT}
          {title.length > TITLE_LIMIT ? " (over the length search results show)" : ""}
        </span>
      </div>

      {isNew ? (
        <div className="cap-field" data-invalid={slugProblem ? "" : undefined}>
          <label className="cap-field-label" htmlFor="field-slug">
            Slug
            {/* Hidden from the name: the full sentence reaches the field by describedby. */}
            {slugProblem ? <span aria-hidden="true"> ({slugProblem})</span> : null}
          </label>
          <div className="cap-input-group" role="group" aria-label="Slug">
            <div className="cap-input-addon" data-align="inline-start">
              <span className="cap-input-group-text">/writing/</span>
            </div>
            <input
              id="field-slug"
              className="cap-input"
              name="slug"
              value={slug}
              onChange={(event) => {
                setSlugPinned(true);
                setSlug(event.target.value);
              }}
              required
              pattern={SLUG_ATTRIBUTE_PATTERN}
              /* An HTML pattern cannot carry a length without a lookahead, so the bound is its own attribute. */
              maxLength={SLUG_MAX_LENGTH}
              aria-invalid={slugProblem !== null}
              aria-describedby={slugProblem ? "slug-problem slug-hint" : "slug-hint"}
              autoComplete="off"
            />
          </div>
          {slugProblem ? (
            <p className="cap-field-error" id="slug-problem">
              {slugTaken
                ? `A post already lives at /writing/${slug}. Saving would be refused.`
                : "Lowercase letters, digits and single hyphens."}
            </p>
          ) : null}
          <span className="cap-field-help" id="slug-hint">
            Derived from the title until you change it. Fixed after the first save, because it is
            the filename and the public URL.
          </span>
        </div>
      ) : null}
    </>
  );
}
