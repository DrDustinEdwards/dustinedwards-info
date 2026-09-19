import {
  FR_CONTROL,
  FR_INTERNAL,
  FR_TITLE,
  FR_URL,
  splitReading,
} from "~/lib/editor/frontmatter";

/**
 * The frontmatter keys the editor carried and never offered.
 *
 * `featured`, `series`/`part`, `further_reading`, `og_title` and
 * `og_description` are all real schema keys that reach D1 and the public page.
 * Until 2026-09-03 the editor relayed them through hidden inputs so that saving
 * did not DELETE them (finding B004) while giving the author no way to set one:
 * the only routes to a series or a featured flag were hand-editing the markdown
 * or the operator API.
 *
 * ## WHY THIS IS NOT IN THE SETTINGS DRAWER
 *
 * The drawer is a real `<dialog>` opened with `showModal()`. Its fields are
 * submitted whether or not it was ever opened, because they carry `form=`, but
 * they can only be EDITED by someone whose browser ran the script that opens
 * it. That is a fine home for a control the author can also live without.
 *
 * It is not a home for these, because the brief for this work is that they work
 * with scripting off, and the further-reading picker in particular is specified
 * as a server-rendered checkbox list. A control inside a modal nobody can open
 * is a control that does not exist on that path. So this section lives in the
 * editing form itself, disclosed by `<details>`, which is the same element the
 * overflow menu uses and for the same recorded reason: it opens without script.
 *
 * ## THE RULE EVERY CONTROL HERE OBEYS
 *
 * **An absent field never means cleared.** A text input always submits, even
 * empty, so `series`, `part`, `ogTitle` and `ogDescription` are safe as
 * ordinary inputs and their payload is unchanged. The two that are not safe are
 * handled explicitly and each carries its argument at the point of use:
 * `featured` pairs a hidden "false" with the checkbox, and further reading
 * carries a marker plus the untouched stored JSON. Neither adds a way for a
 * missing field to read as an author's decision.
 */
export function PostMetadata({
  formId,
  featured,
  series,
  part,
  furtherReading,
  ogTitle,
  ogDescription,
  title,
  description,
  linkTargets,
  currentSlug,
}: {
  formId: string;
  featured: boolean;
  series: string;
  part: string;
  furtherReading: string;
  ogTitle: string;
  ogDescription: string;
  /** For the OG fallback notes, which quote the value that would be used. */
  title: string;
  description: string;
  /** Every post with its state; the picker offers the published ones. */
  linkTargets: { slug: string; title: string; state: string }[];
  /** The post being edited, so it cannot cite itself. */
  currentSlug: string;
}) {
  const reading = splitReading(furtherReading);
  const chosen = new Set(
    reading.internal.map((item) => item.url.replace(/^\/blog\//, "")),
  );

  /*
   * PUBLISHED ONLY, and not the post being edited.
   *
   * `linkTargets` deliberately carries every post with its state, because the
   * Cmd+K palette wants to link forward to a scheduled part and marks it. This
   * picker is a different question: further reading is rendered to the public,
   * so offering a draft would be offering a link that 404s for every reader.
   * The palette's own comment argues for the wider list; the narrowing is here
   * rather than there so both stay right.
   *
   * A post citing itself is filtered for the same reason a self-link is not
   * further reading. Nothing enforces it downstream, so it is enforced by not
   * being offered.
   */
  const candidates = linkTargets.filter(
    (target) => target.state === "published" && target.slug !== currentSlug,
  );

  /*
   * One spare row, always. Existing links render as filled rows and the spare
   * is what makes adding one possible without script; saving reveals the next
   * spare. Two spares were considered and rejected as clutter, since the cost
   * of a second link is one more save rather than a lost one.
   */
  const rows = [...reading.external, { title: "", url: "" }];

  return (
    <details className="post-metadata">
      <summary>
        Post metadata
        <span className="post-metadata-hint">
          Featured, series, further reading, social overrides
        </span>
      </summary>

      <div className="post-metadata-body">
        <fieldset className="post-metadata-group">
          <legend>Index</legend>
          {/*
            THE HIDDEN "false" IS NOT REDUNDANT. It is the half that makes the
            checkbox safe: an unticked checkbox is absent from the submission
            entirely, so without this the request would carry no `featured` key
            and the parser would read that absence. It is rendered BEFORE the
            checkbox because `fieldsFromForm` takes the LAST value, so ticking
            the box overrides it and leaving it alone does not.
          */}
          <input type="hidden" form={formId} name="featured" value="false" />
          <label className="post-metadata-check">
            <input
              type="checkbox"
              form={formId}
              name="featured"
              value="true"
              defaultChecked={featured}
            />
            <span>
              Featured
              <small>The index shows one featured post as its hero.</small>
            </span>
          </label>
        </fieldset>

        <fieldset className="post-metadata-group">
          <legend>Series</legend>
          <p className="post-metadata-note">
            Both travel together. A part with no series is refused by the schema.
          </p>
          <div className="post-metadata-pair">
            <label className="field-label" htmlFor="field-series">
              Series name
            </label>
            <input
              id="field-series"
              form={formId}
              name="series"
              type="text"
              defaultValue={series}
              autoComplete="off"
            />
            <label className="field-label" htmlFor="field-part">
              Part
            </label>
            <input
              id="field-part"
              form={formId}
              name="part"
              type="number"
              min="1"
              step="1"
              defaultValue={part}
              inputMode="numeric"
            />
          </div>
        </fieldset>

        <fieldset className="post-metadata-group">
          <legend>Social overrides</legend>
          <label className="field-label" htmlFor="field-og-title">
            OG title
          </label>
          <input
            id="field-og-title"
            form={formId}
            name="ogTitle"
            type="text"
            defaultValue={ogTitle}
            autoComplete="off"
            aria-describedby="og-title-note"
          />
          <p className="post-metadata-note" id="og-title-note">
            Left empty, cards use the post title: {title.trim() || "(untitled)"}
          </p>

          <label className="field-label" htmlFor="field-og-description">
            OG description
          </label>
          <input
            id="field-og-description"
            form={formId}
            name="ogDescription"
            type="text"
            defaultValue={ogDescription}
            autoComplete="off"
            aria-describedby="og-description-note"
          />
          <p className="post-metadata-note" id="og-description-note">
            Left empty, cards use the description:{" "}
            {description.trim() || "(none set)"}
          </p>
        </fieldset>

        <fieldset className="post-metadata-group">
          <legend>Further reading</legend>
          {/*
            THE MARKER AND THE CARRIED VALUE, together, and neither is optional.

            The marker says this control was on the page, so an empty result is
            the author clearing the list rather than a form that never offered
            one. The hidden `furtherReading` is what the parser falls back to
            when the marker is absent, which is every caller that is not this
            section; it is the same relay the editor had before this existed and
            it is kept for exactly that case. `furtherReadingFromForm` carries
            the full argument.
          */}
          <input type="hidden" form={formId} name={FR_CONTROL} value="1" />
          <input
            type="hidden"
            form={formId}
            name="furtherReading"
            value={furtherReading}
          />

          <p className="post-metadata-note">
            External links, and posts from this site. Both render as one list
            under the post.
          </p>

          <ul className="post-metadata-rows">
            {rows.map((row, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <li key={index} className="post-metadata-row">
                <label className="field-label" htmlFor={`field-fr-title-${index}`}>
                  Title
                </label>
                <input
                  id={`field-fr-title-${index}`}
                  form={formId}
                  name={FR_TITLE}
                  type="text"
                  defaultValue={row.title}
                  autoComplete="off"
                />
                <label className="field-label" htmlFor={`field-fr-url-${index}`}>
                  URL
                </label>
                <input
                  id={`field-fr-url-${index}`}
                  form={formId}
                  name={FR_URL}
                  type="url"
                  defaultValue={row.url}
                  autoComplete="off"
                  placeholder="https://"
                />
              </li>
            ))}
          </ul>

          {candidates.length > 0 ? (
            <div className="post-metadata-picker">
              <h4>Posts from this site</h4>
              <p className="post-metadata-note">
                Stored as a path, so these survive a change of domain.
              </p>
              <ul>
                {candidates.map((target) => (
                  <li key={target.slug}>
                    <label className="post-metadata-check">
                      {/*
                        The VALUE carries the slug and the title together, so
                        the picker contributes exactly one field name to the
                        submission tuple no matter how long the blog gets.
                      */}
                      <input
                        type="checkbox"
                        form={formId}
                        name={FR_INTERNAL}
                        value={JSON.stringify({
                          slug: target.slug,
                          title: target.title,
                        })}
                        defaultChecked={chosen.has(target.slug)}
                      />
                      <span>{target.title}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="post-metadata-note">
              No other published post to link to yet.
            </p>
          )}
        </fieldset>
      </div>
    </details>
  );
}
