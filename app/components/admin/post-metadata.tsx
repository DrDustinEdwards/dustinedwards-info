import { Disclosure } from "capsomer/react/disclosure";

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
    reading.internal.map((item) => item.url.replace(/^\/writing\//, "")),
  );

  // Published only: further reading is public, so offering a draft would be offering a link that 404s.
  const candidates = linkTargets.filter(
    (target) => target.state === "published" && target.slug !== currentSlug,
  );

  // One spare row is what makes adding a link possible without script.
  const rows = [...reading.external, { title: "", url: "" }];

  return (
    <Disclosure
      summary={
        <>
          Post metadata{" "}
          <span className="cap-muted">Featured, series, further reading, social overrides</span>
        </>
      }
    >
      <div className="app-form">
        <fieldset className="cap-field">
          <legend className="cap-field-label">Index</legend>
          {/* An unticked checkbox submits nothing, so this carries the "false". It comes first
              because `fieldsFromForm` takes the LAST value. */}
          <input type="hidden" form={formId} name="featured" value="false" />
          <label className="cap-check">
            <input
              type="checkbox"
              form={formId}
              name="featured"
              value="true"
              defaultChecked={featured}
            />
            Featured
          </label>
          <p className="cap-field-help">The index shows one featured post as its hero.</p>
        </fieldset>

        <fieldset className="cap-field">
          <legend className="cap-field-label">Series</legend>
          <p className="cap-field-help">
            Both travel together. A part with no series is refused by the schema.
          </p>
          <div className="app-fields">
            <div className="cap-field">
              <label className="cap-field-label" htmlFor="field-series">
                Series name
              </label>
              <input
                id="field-series"
                className="cap-input"
                form={formId}
                name="series"
                type="text"
                defaultValue={series}
                autoComplete="off"
              />
            </div>
            <div className="cap-field">
              <label className="cap-field-label" htmlFor="field-part">
                Part
              </label>
              <input
                id="field-part"
                className="cap-input"
                form={formId}
                name="part"
                type="number"
                min="1"
                step="1"
                defaultValue={part}
                inputMode="numeric"
              />
            </div>
          </div>
        </fieldset>

        <fieldset className="cap-field">
          <legend className="cap-field-label">Social overrides</legend>
          <div className="app-fields">
            <div className="cap-field">
              <label className="cap-field-label" htmlFor="field-og-title">
                OG title
              </label>
              <input
                id="field-og-title"
                className="cap-input"
                form={formId}
                name="ogTitle"
                type="text"
                defaultValue={ogTitle}
                autoComplete="off"
                aria-describedby="og-title-note"
              />
              <p className="cap-field-help" id="og-title-note">
                Left empty, cards use the post title: {title.trim() || "(untitled)"}
              </p>
            </div>
            <div className="cap-field">
              <label className="cap-field-label" htmlFor="field-og-description">
                OG description
              </label>
              <input
                id="field-og-description"
                className="cap-input"
                form={formId}
                name="ogDescription"
                type="text"
                defaultValue={ogDescription}
                autoComplete="off"
                aria-describedby="og-description-note"
              />
              <p className="cap-field-help" id="og-description-note">
                Left empty, cards use the description: {description.trim() || "(none set)"}
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset className="cap-field">
          <legend className="cap-field-label">Further reading</legend>
          {/* The marker says this control was on the page, so an empty result means the author
              cleared the list; the hidden value is the fallback for every other caller. */}
          <input type="hidden" form={formId} name={FR_CONTROL} value="1" />
          <input type="hidden" form={formId} name="furtherReading" value={furtherReading} />

          <p className="cap-field-help">
            External links, and posts from this site. Both render as one list under the post.
          </p>

          {rows.map((row, index) => (
            // eslint-disable-next-line react/no-array-index-key
            <div key={index} className="app-fields">
              <div className="cap-field">
                <label className="cap-field-label" htmlFor={`field-fr-title-${index}`}>
                  Title
                </label>
                <input
                  id={`field-fr-title-${index}`}
                  className="cap-input"
                  form={formId}
                  name={FR_TITLE}
                  type="text"
                  defaultValue={row.title}
                  autoComplete="off"
                />
              </div>
              <div className="cap-field">
                <label className="cap-field-label" htmlFor={`field-fr-url-${index}`}>
                  URL
                </label>
                <input
                  id={`field-fr-url-${index}`}
                  className="cap-input"
                  form={formId}
                  name={FR_URL}
                  type="url"
                  defaultValue={row.url}
                  autoComplete="off"
                  placeholder="https://"
                />
              </div>
            </div>
          ))}

          {candidates.length > 0 ? (
            <fieldset className="cap-field">
              <legend className="cap-field-label">Posts from this site</legend>
              <p className="cap-field-help">Stored as a path, so these survive a change of domain.</p>
              <div className="cap-field-options">
                {candidates.map((target) => (
                  <label key={target.slug} className="cap-check">
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
                    {target.title}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="cap-field-help">No other published post to link to yet.</p>
          )}
        </fieldset>
      </div>
    </Disclosure>
  );
}
