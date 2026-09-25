import { Form, Link } from "react-router";

import { CopyButton } from "~/components/admin/copy-button";
import { byteSize } from "~/lib/media/byte-size.mjs";
import { usageDescriptor } from "~/lib/media/usage.mjs";

import type { Route } from "../../routes/+types/admin.media._index";

type Listing = Extract<Route.ComponentProps["loaderData"], { detail: unknown }>;
type Detail = NonNullable<Listing["detail"]>;
export type FoundDetail = Extract<Detail, { found: true }>;

/** The address and every fact the system assigns: read-only, because a rebuild recomputes them. */
export function InspectorFacts({ detail }: { detail: FoundDetail }) {
  return (
    <>
      {/* The no-script copy path: a readonly input selects and copies with the platform's own keys. */}
      <label className="media-detail-address" htmlFor="media-detail-url">
        Address
      </label>
      <div className="media-detail-address-row">
        <input
          id="media-detail-url"
          className="posts-filter-input"
          readOnly
          value={detail.url}
        />
        <CopyButton value={detail.url} label={detail.originalName ?? detail.key} />
      </div>

      {/* Derived: `rebuildMediaIndex` recomputes all of this, so an edit here would be overwritten. */}
      <p className="media-facet-hint media-detail-owner">
        assigned by the system
      </p>
      <dl className="media-detail-list">
        <dt>Key</dt>
        <dd className="media-key">{detail.key}</dd>
        <dt>Role</dt>
        <dd>
          <span className="chip">{detail.role}</span> {detail.storage} · {detail.kind}
        </dd>
        <dt>Type</dt>
        <dd>{detail.mime ?? "unknown"}</dd>
        <dt>Size</dt>
        <dd>{byteSize(detail.bytes)}</dd>
        <dt>Dimensions</dt>
        <dd>
          {detail.width && detail.height
            ? `${detail.width}×${detail.height}`
            : "not measured"}
        </dd>
        <dt>Uploaded</dt>
        <dd>{detail.uploadedAt ? detail.uploadedAt.slice(0, 10) : "ships with the repo"}</dd>
      </dl>
    </>
  );
}

/** The alt text form, or the note that a document takes none. */
export function InspectorAltForm({ detail }: { detail: FoundDetail }) {
  return (
    <>
      {/* Authored: a rebuild preserves it because nothing can recompute it. */}
      <p className="media-facet-hint media-detail-owner">yours to edit</p>
      {detail.viewable ? (
        <Form method="post" className="media-alt-form">
          <input type="hidden" name="key" value={detail.key} />
          <label htmlFor="detail-alt">Alt text</label>
          <input
            id="detail-alt"
            name="alt"
            defaultValue={detail.alt}
            placeholder="Describe this image"
            className="media-alt-input"
            data-missing={detail.alt.trim() ? undefined : "yes"}
          />
          <button type="submit" name="intent" value="set-alt" className="btn-ghost">
            Save alt
          </button>
          {/* Through the same `set-alt` intent, so the server keeps one writer. Offered only while the
              field is empty, so it never invites overwriting a written sentence. */}
          {!detail.alt.trim() && detail.altSuggestion ? (
            <button
              type="submit"
              name="alt"
              value={detail.altSuggestion}
              className="media-suggestion"
              aria-label={`Use suggested alt text: ${detail.altSuggestion}`}
            >
              Use suggested: {detail.altSuggestion}
            </button>
          ) : null}
        </Form>
      ) : (
        <p className="muted">
          A document takes no alt text. Its link text is what a
          reader hears, and that lives in the post.
        </p>
      )}
    </>
  );
}

/** The tags field and the chip form that removes, clears or adds one tag at a time. */
export function InspectorTagForms({ detail }: { detail: FoundDetail }) {
  return (
    <>
      {/* The parsed list joined with commas, never the delimiter-wrapped storage form. */}
      <Form method="post" className="media-alt-form">
        <input type="hidden" name="key" value={detail.key} />
        <label htmlFor="detail-tags">Tags</label>
        <input
          id="detail-tags"
          name="tags"
          defaultValue={detail.tags.join(", ")}
          placeholder="photo, roster, 2019"
          className="media-alt-input"
        />
        <button type="submit" name="intent" value="set-tags" className="btn-ghost">
          Save tags
        </button>
      </Form>

      {/* Each chip submits the whole resulting list on `set-tags`, except the last one, which submits
          `clear`: an empty value is not an instruction to clear. */}
      {detail.tags.length > 0 || detail.tagSuggestions.length > 0 ? (
        <Form method="post" className="media-tag-chips">
          <input type="hidden" name="key" value={detail.key} />
          <input type="hidden" name="intent" value="set-tags" />
          {detail.tags.map((tag) => (
            <button
              key={`applied-${tag}`}
              type="submit"
              {...(detail.tags.length === 1
                ? { name: "clear", value: "1" }
                : {
                    name: "tags",
                    value: detail.tags.filter((t) => t !== tag).join(", "),
                  })}
              className="media-tag-chip"
              aria-label={`Remove tag ${tag}`}
              title={`Remove tag ${tag}`}
            >
              {tag} <span aria-hidden="true">&times;</span>
            </button>
          ))}
          {/* Shown only above one tag: at one, the chip already does this. */}
          {detail.tags.length > 1 ? (
            <button
              type="submit"
              name="clear"
              value="1"
              className="media-tag-chip media-tag-clear"
              title={`Remove all ${detail.tags.length} tags`}
            >
              Clear all
            </button>
          ) : null}
          {detail.tagSuggestions.map((tag) => (
            <button
              key={`suggested-${tag}`}
              type="submit"
              name="tags"
              value={[...detail.tags, tag].join(", ")}
              className="media-tag-suggestion"
              aria-label={`Add suggested tag ${tag}`}
            >
              <span aria-hidden="true">+</span> {tag}
            </button>
          ))}
        </Form>
      ) : null}
    </>
  );
}

/** Where the file is used: posts, artifact citations and template files, or that the scan failed. */
export function InspectorUsage({ detail }: { detail: FoundDetail }) {
  return (
    <div className="media-detail-usage" data-usage={detail.usage}>
      <h3>Usage</h3>
      {!detail.scanComplete ? (
        <p className="muted">The reference scan failed, so usage is unknown.</p>
      ) : (
        <>
          <p className="media-usage-claim">
            <span
              className="media-usage-dot"
              data-usage={detail.usage}
              aria-hidden="true"
            />
            <strong>{usageDescriptor(detail.usage).title}.</strong>{" "}
            {usageDescriptor(detail.usage).note}
          </p>

          {detail.refs.length > 0 || detail.citations.length > 0 ? (
            <ul className="media-detail-refs">
              {detail.refs.map((ref) => (
                <li key={`ref-${ref.sourceId}-${ref.form}-${ref.detail ?? ""}`}>
                  <Link to={`/admin/posts/${ref.sourceId}/edit`}>{ref.sourceId}</Link>{" "}
                  <span className="muted">
                    {ref.form}
                    {ref.detail ? `, ${ref.detail}` : ""}
                  </span>
                </li>
              ))}
              {detail.citations.map((citation) => (
                <li key={`cite-${citation.id}-${citation.form}-${citation.detail}`}>
                  <Link to={`/admin/posts/${citation.id}/edit`}>{citation.title}</Link>{" "}
                  <span className="muted">
                    {citation.form}, {citation.detail}, from the artifact scan
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Not links: the admin has no source browser, and a link to nothing is worse than text. */}
          {detail.templateRefs.length > 0 ? (
            <ul className="media-detail-refs media-template-refs">
              {detail.templateRefs.map((file) => (
                <li key={`tpl-${file}`}>
                  <code>{file}</code>{" "}
                  <span className="muted">references this address</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}

/** Trash or restore, then delete: the reversible action first, the permanent one last. */
export function InspectorDangerZone({ detail }: { detail: FoundDetail }) {
  return (
    <>
      {/* No confirm on purpose: trashing is reversible and invisible to readers, and always-harmless
          ceremony teaches people to click through. */}
      {detail.trashedAt ? (
        <Form method="post" className="media-trash-form">
          <input type="hidden" name="key" value={detail.key} />
          <button type="submit" name="intent" value="restore" className="btn-ghost">
            Restore to the library
          </button>
        </Form>
      ) : (
        <Form method="post" className="media-trash-form">
          <input type="hidden" name="key" value={detail.key} />
          <button type="submit" name="intent" value="trash" className="media-destructive">
            Move to trash
          </button>
          <span className="media-facet-hint">
            Hides it here. The address keeps working.
          </span>
        </Form>
      )}

      {detail.deletable ? (
        <Form method="post">
          <input type="hidden" name="key" value={detail.key} />
          {/* No confirmation field: the action refuses and opens the typed confirmation, script or not. */}
          <button type="submit" name="intent" value="delete" className="btn-danger">
            Delete
          </button>
        </Form>
      ) : (
        <p className="muted">Ships with the repo. Remove it with a commit.</p>
      )}
    </>
  );
}
