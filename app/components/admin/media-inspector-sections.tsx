import { Form, Link } from "react-router";
import { Pill, Status } from "capsomer/react/status";

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
      <div className="cap-field">
        <label className="cap-field-label" htmlFor="media-detail-url">
          Address
        </label>
        <div className="app-actions">
          <input id="media-detail-url" className="cap-input" readOnly value={detail.url} />
          <CopyButton value={detail.url} label={detail.originalName ?? detail.key} />
        </div>
      </div>

      {/* Derived: `rebuildMediaIndex` recomputes all of this, so an edit here would be overwritten. */}
      <div className="cap-field">
        <span className="cap-field-label">Assigned by the system</span>
        <dl className="app-facts">
          <dt>Key</dt>
          <dd className="cap-mono">{detail.key}</dd>
          <dt>Role</dt>
          <dd>
            <Pill variant="outline">{detail.role}</Pill> {detail.storage} · {detail.kind}
          </dd>
          <dt>Type</dt>
          <dd>{detail.mime ?? "unknown"}</dd>
          <dt>Size</dt>
          <dd>{byteSize(detail.bytes)}</dd>
          <dt>Dimensions</dt>
          <dd>
            {detail.width && detail.height ? `${detail.width}×${detail.height}` : "not measured"}
          </dd>
          <dt>Uploaded</dt>
          <dd>{detail.uploadedAt ? detail.uploadedAt.slice(0, 10) : "ships with the repo"}</dd>
        </dl>
      </div>
    </>
  );
}

/** The alt text form, or the note that a document takes none. */
export function InspectorAltForm({ detail }: { detail: FoundDetail }) {
  return (
    <>
      {/* Authored: a rebuild preserves it because nothing can recompute it. */}
      {detail.viewable ? (
        <Form method="post" className="cap-field">
          <input type="hidden" name="key" value={detail.key} />
          <label className="cap-field-label" htmlFor="detail-alt">
            Alt text <span className="cap-muted">yours to edit</span>
          </label>
          <input
            id="detail-alt"
            className="cap-input"
            name="alt"
            defaultValue={detail.alt}
            placeholder="Describe this image"
            aria-invalid={detail.alt.trim() ? undefined : true}
          />
          <div className="app-actions">
            <button type="submit" name="intent" value="set-alt" className="cap-btn" data-size="sm">
              Save alt
            </button>
            {/* Through the same `set-alt` intent, so the server keeps one writer. Offered only while the
                field is empty, so it never invites overwriting a written sentence. */}
            {!detail.alt.trim() && detail.altSuggestion ? (
              <button
                type="submit"
                name="alt"
                value={detail.altSuggestion}
                className="cap-btn"
                data-variant="quiet"
                data-size="sm"
                aria-label={`Use suggested alt text: ${detail.altSuggestion}`}
              >
                Use suggested: {detail.altSuggestion}
              </button>
            ) : null}
          </div>
        </Form>
      ) : (
        <p className="cap-muted">
          A document takes no alt text. Its link text is what a reader hears, and that lives in the
          post.
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
      <Form method="post" className="cap-field">
        <input type="hidden" name="key" value={detail.key} />
        <label className="cap-field-label" htmlFor="detail-tags">
          Tags
        </label>
        <input
          id="detail-tags"
          className="cap-input"
          name="tags"
          defaultValue={detail.tags.join(", ")}
          placeholder="photo, roster, 2019"
        />
        <div>
          <button type="submit" name="intent" value="set-tags" className="cap-btn" data-size="sm">
            Save tags
          </button>
        </div>
      </Form>

      {/* Each chip submits the whole resulting list on `set-tags`, except the last one, which submits
          `clear`: an empty value is not an instruction to clear. */}
      {detail.tags.length > 0 || detail.tagSuggestions.length > 0 ? (
        <Form method="post" className="app-pills">
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
              className="cap-btn"
              data-size="xs"
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
              className="cap-btn"
              data-size="xs"
              data-variant="quiet"
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
              className="cap-btn"
              data-size="xs"
              data-variant="quiet"
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

const USAGE_TONE: Record<string, "ok" | "warn" | "nodata"> = {
  used: "ok",
  unattached: "warn",
  unknown: "nodata",
};

/** Where the file is used: posts, artifact citations and template files, or that the scan failed. */
export function InspectorUsage({ detail }: { detail: FoundDetail }) {
  return (
    <div className="cap-field">
      <h3 className="cap-field-label">Usage</h3>
      {!detail.scanComplete ? (
        <p className="cap-muted">The reference scan failed, so usage is unknown.</p>
      ) : (
        <>
          <p>
            <Status tone={USAGE_TONE[detail.usage] ?? "nodata"}>{usageDescriptor(detail.usage).title}</Status>{" "}
            {usageDescriptor(detail.usage).note}
          </p>

          {detail.refs.length > 0 || detail.citations.length > 0 ? (
            <ul className="app-form">
              {detail.refs.map((ref) => (
                <li key={`ref-${ref.sourceId}-${ref.form}-${ref.detail ?? ""}`}>
                  <Link to={`/admin/posts/${ref.sourceId}/edit`}>{ref.sourceId}</Link>{" "}
                  <span className="cap-muted">
                    {ref.form}
                    {ref.detail ? `, ${ref.detail}` : ""}
                  </span>
                </li>
              ))}
              {detail.citations.map((citation) => (
                <li key={`cite-${citation.id}-${citation.form}-${citation.detail}`}>
                  <Link to={`/admin/posts/${citation.id}/edit`}>{citation.title}</Link>{" "}
                  <span className="cap-muted">
                    {citation.form}, {citation.detail}, from the artifact scan
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {/* Not links: the admin has no source browser, and a link to nothing is worse than text. */}
          {detail.templateRefs.length > 0 ? (
            <ul className="app-form">
              {detail.templateRefs.map((file) => (
                <li key={`tpl-${file}`}>
                  <code className="cap-mono">{file}</code>{" "}
                  <span className="cap-muted">references this address</span>
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
        <Form method="post">
          <input type="hidden" name="key" value={detail.key} />
          <button type="submit" name="intent" value="restore" className="cap-btn">
            Restore to the library
          </button>
        </Form>
      ) : (
        <Form method="post" className="app-actions">
          <input type="hidden" name="key" value={detail.key} />
          <button type="submit" name="intent" value="trash" className="cap-btn" data-variant="danger">
            Move to trash
          </button>
          <span className="cap-muted">Hides it here. The address keeps working.</span>
        </Form>
      )}

      {detail.deletable ? (
        <Form method="post">
          <input type="hidden" name="key" value={detail.key} />
          {/* No confirmation field: the action refuses and opens the typed confirmation, script or not. */}
          <button type="submit" name="intent" value="delete" className="cap-btn" data-variant="danger">
            Delete
          </button>
        </Form>
      ) : (
        <p className="cap-muted">Ships with the repo. Remove it with a commit.</p>
      )}
    </>
  );
}
