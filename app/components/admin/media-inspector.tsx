import { Form, Link } from "react-router";

import { CopyButton } from "~/components/admin/copy-button";
import { MediaDrawer } from "~/components/admin/media-drawer";
import { byteSize } from "~/lib/media/byte-size.mjs";
import { copySnippetsFor, usageDescriptor } from "~/lib/media/usage.mjs";
import type { hrefWith } from "~/lib/media/view.mjs";

import type { Route } from "../../routes/+types/admin.media._index";

type Listing = Extract<Route.ComponentProps["loaderData"], { detail: unknown }>;
type Detail = NonNullable<Listing["detail"]>;

export function MediaInspector({
  detail,
  linkTo,
}: {
  detail: Detail;
  linkTo: (over?: Parameters<typeof hrefWith>[1]) => string;
}) {
  return (
        <>
        {/* A link, not a div with a handler, so closing by clicking outside needs no script. */}
        <Link
          to={linkTo({ key: "" })}
          className="media-detail-scrim"
          preventScrollReset
          aria-label="Close the inspector"
        />
        <section
          className="media-detail"
          /* A dialog role rather than <dialog>, which needs showModal() and so script. */
          role="dialog"
          aria-modal="true"
          aria-label={`Details for ${detail.found ? (detail.originalName ?? detail.key) : detail.key}`}
          tabIndex={-1}
        >
          {detail.found ? (
            <>
              {/* Ellipsised, not wrapped: a content-addressed key can wrap to three lines and push the panel down. */}
              <header className="media-detail-head">
                <h3 title={detail.key}>{detail.originalName ?? detail.key}</h3>
                <span className="media-detail-usage-pill">
                  <span
                    className="media-usage-dot"
                    data-usage={detail.usage}
                    aria-hidden="true"
                  />
                  {usageDescriptor(detail.usage).label}
                </span>
                <Link
                  to={linkTo({ key: "" })}
                  className="media-detail-close"
                  preventScrollReset
                  aria-label="Close the inspector"
                  title="Close, or press escape"
                >
                  <span aria-hidden="true">&times;</span>
                </Link>
              </header>

              <div className="media-detail-body">
                <div className="media-detail-preview" data-viewable={detail.viewable}>
                  {detail.viewable ? (
                    <img src={detail.thumb} alt="" width={640} height={427} />
                  ) : (
                    <span className="media-thumb-label" aria-hidden="true">
                      {(detail.mime ?? "file").split("/").pop()?.toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="media-detail-facts">
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

                  <div className="media-detail-copy">
                    <h4>Copy</h4>
                    {copySnippetsFor({
                      url: detail.url,
                      viewable: detail.viewable,
                      alt: detail.alt,
                      base: detail.originalName ?? detail.key.split("/").pop() ?? detail.key,
                    }).map((snippet) => (
                      <CopyButton
                        key={snippet.id}
                        value={snippet.value}
                        label={snippet.label}
                        name={snippet.name}
                        showLabel
                      />
                    ))}
                  </div>

                  {/* Trashing a twin hides it and both addresses keep working, so no published page loses its image. */}
                  {detail.twins.length > 0 ? (
                    <div className="media-detail-twins">
                      <h4>Identical files</h4>
                      <ul className="media-detail-refs">
                        {detail.twins.map((twin) => (
                          <li key={twin.key}>
                            <p className="media-twin-note">
                              Byte-identical to{" "}
                              <Link to={linkTo({ key: twin.key })}>{twin.key}</Link>, both
                              addresses resolve to the same content.
                            </p>
                            <Form method="post" className="media-twin-form">
                              <input type="hidden" name="key" value={twin.key} />
                              <button
                                type="submit"
                                name="intent"
                                value="trash"
                                className="media-destructive"
                              >
                                Keep this, trash {twin.originalName ?? twin.key.split("/").pop() ?? twin.key}
                              </button>
                            </Form>
                          </li>
                        ))}
                      </ul>
                      <p className="muted">
                        Trashing one hides it from the library. Every address
                        keeps working and no page changes.
                      </p>
                    </div>
                  ) : null}

                  {/* Read off the key, never recomputed. A static row's key is a path, so it shows nothing. */}
                  {detail.hash ? (
                    <p className="media-detail-hash">
                      <span className="media-display-label">sha256</span>
                      <code>{detail.hash}</code>
                    </p>
                  ) : null}

                  <div className="media-detail-usage" data-usage={detail.usage}>
                    <h4>Usage</h4>
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
                </div>
              </div>
            </>
          ) : (
            <p className="muted">
              Nothing in the index has the key {detail.key}. It may have been deleted.{" "}
              <Link to={linkTo({ key: "" })} preventScrollReset>
                Back to the library
              </Link>
              .
            </p>
          )}
        </section>
        {/* With no script the drawer still opens, works and closes by its own links. */}
        <MediaDrawer activeKey={detail.key} closeHref={linkTo({ key: "" })} />
        </>
  );
}
