import {
  FR_CONTROL,
  FR_INTERNAL,
  FR_TITLE,
  FR_URL,
  splitReading,
} from "~/lib/editor/frontmatter";

// Not in the settings drawer: that is a showModal() dialog, and these fields must work without script.
// An absent field never means cleared.
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
  title: string;
  description: string;
  linkTargets: { slug: string; title: string; state: string }[];
  currentSlug: string;
}) {
  const reading = splitReading(furtherReading);
  const chosen = new Set(
    reading.internal.map((item) => item.url.replace(/^\/blog\//, "")),
  );

  // Published only: further reading is public, so offering a draft would be offering a link that 404s.
  const candidates = linkTargets.filter(
    (target) => target.state === "published" && target.slug !== currentSlug,
  );

  // One spare row is what makes adding a link possible without script.
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
          {/* An unticked checkbox submits nothing, so this carries the "false". It comes first
              because `fieldsFromForm` takes the LAST value. */}
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
          {/* The marker says this control was on the page, so an empty result means the author
              cleared the list; the hidden value is the fallback for every other caller. */}
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
                      {/* Slug and title in one value, so the picker adds one field name however long the blog gets. */}
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
