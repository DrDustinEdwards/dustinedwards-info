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
            <div className="editor-title-row">
              <label className="sr-only" htmlFor="field-title">
                Title
              </label>
              <input
                id="field-title"
                name="title"
                className="editor-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (isNew && !slugPinned) setSlug(slugify(event.target.value));
                }}
                placeholder="Untitled"
                required
                autoComplete="off"
              />
              <span className={title.length > TITLE_LIMIT ? "count over" : "count"}>
                {title.length}/{TITLE_LIMIT}
              </span>
            </div>

            {isNew ? (
              <div className="editor-slug-row">
                <label className="field-label" htmlFor="field-slug">
                  Slug
                  {slugProblem ? <span className="count over">{slugProblem}</span> : null}
                </label>
                <div className="editor-slug-input">
                  <span className="muted">/blog/</span>
                  <input
                    id="field-slug"
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
                    aria-describedby={slugProblem ? "slug-problem" : undefined}
                    autoComplete="off"
                  />
                </div>
                {slugProblem ? (
                  <p className="field-alarm" id="slug-problem">
                    {slugTaken
                      ? `A post already lives at /blog/${slug}. Saving would be refused.`
                      : "Lowercase letters, digits and single hyphens."}
                  </p>
                ) : null}
                <span className="field-hint muted">
                  Derived from the title until you change it. Fixed after the
                  first save, because it is the filename and the public URL.
                </span>
              </div>
            ) : null}
    </>
  );
}
