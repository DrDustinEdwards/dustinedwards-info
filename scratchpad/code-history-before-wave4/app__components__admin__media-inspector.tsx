/*
 * THE `?key=` INSPECTOR: the panel that opens over the library when a row is
 * addressed by key.
 *
 * Moved out of `app/routes/admin.media._index.tsx` on 2026-08-24. The JSX is
 * unchanged, comments included; the route renders it where the block used to
 * sit and passes the two values it reads from the page around it.
 *
 * `detail` is the loader's own row, taken from the route's generated types
 * rather than restated here, so the shape has ONE owner and this file cannot
 * drift from what the loader actually returns.
 */

import { Form, Link } from "react-router";

import { CopyButton } from "~/components/admin/media-copy-button";
import { MediaDrawer } from "~/components/admin/media-drawer";
import { CONFIRM_FIELD } from "~/lib/destructive.mjs";
import { byteSize } from "~/lib/media/byte-size.mjs";
import { copySnippetsFor, usageDescriptor } from "~/lib/media/usage.mjs";
import type { hrefWith } from "~/lib/media/view.mjs";

import type { Route } from "../../routes/+types/admin.media._index";

/*
 * The loader returns a UNION of three shapes: the picker, the palette and the
 * library listing. Only the listing carries `detail`, so the member is selected
 * rather than the property read off the union, which is what the compiler
 * refused. Still one owner: the loader.
 */
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
        {/*
          THE SCRIM, and it is a LINK rather than a div with a handler.

          Clicking outside a drawer closes it, and that expectation does not
          depend on script, so the mechanism must not either. A link to the same
          view with `key` cleared is the whole implementation, it works with
          scripting off, and it is the same URL the Close control uses, so there
          is one way to close and not two.

          `preventScrollReset` because closing is not a new place to be: the
          reader was looking at a grid and should still be looking at the same
          part of it.
        */}
        <Link
          to={linkTo({ key: "" })}
          className="media-detail-scrim"
          preventScrollReset
          aria-label="Close the inspector"
        />
        <section
          className="media-detail"
          /*
            A DIALOG in role, because that is what a scrim plus a focus trap
            makes it. Not a `<dialog>` element: that would need `showModal()` to
            behave, which is script, and this panel is server-rendered and has to
            work without any. The role and the label are what assistive
            technology reads either way, and `MediaDrawer` supplies the trap.
          */
          role="dialog"
          aria-modal="true"
          aria-label={`Details for ${detail.found ? (detail.originalName ?? detail.key) : detail.key}`}
          tabIndex={-1}
        >
          {detail.found ? (
            <>
              {/*
                THE STICKY HEAD, which the mockup has and which a scrolling
                drawer needs: the name of the thing you are reading about must
                not scroll away from the facts about it, and Close must stay
                reachable without scrolling back up.

                The name ELLIPSISES rather than wrapping. A content-addressed key
                is 20 characters of hash and a static one is a path; either can
                wrap to three lines and push the whole panel down. The full
                string is in the `title` and in the Address field below.

                The usage pill repeats the state the panel explains further down.
                That is deliberate: it is the one fact somebody opens this panel
                to check, and it belongs where the eye lands first.
              */}
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
                  {/* THE NO-SCRIPT PATH FOR THE PAGE'S ONE JOB. A readonly
                      input rather than a <code>: it selects with a click and
                      a keyboard, and it copies with the platform's own
                      shortcut, none of which needs this page to be running. */}
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

                  {/* DERIVED, and the inspector says so. The mockup made this
                      distinction with a Role row marked "assigned by the
                      system" and a Tags row marked "yours to edit"; this page
                      has no tags column, so the same honesty lands on the two
                      groups it does have. Everything in this list is
                      recomputable from the object by `rebuildMediaIndex`, and
                      an edit here would be overwritten by the next rebuild. */}
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

                  {/* AUTHORED, and the only field on this panel that is. A
                      rebuild preserves it precisely because nothing can
                      recompute it. */}
                  <p className="media-facet-hint media-detail-owner">yours to edit</p>
                  {/*
                    ALT TEXT, FOR IMAGES ONLY.

                    A document does not take alt text, so offering the field on
                    one invents an obligation the author cannot discharge. 31 of
                    the 70 rows are documents, and the field was on all of them.
                  */}
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
                      {/*
                        THE SUGGESTION, AS A SUBMIT BUTTON CARRYING ITS VALUE.

                        One press writes it, through the SAME `set-alt` intent
                        the field above submits, so the server keeps one writer
                        and check:admin-ui sees no new payload shape. The value
                        rides on the button rather than in a hidden field for the
                        reason the upload intent does: a button name and value
                        pin the token, a hidden field lands in the field list as
                        a bare name.

                        Offered only while the field is EMPTY. A suggestion
                        beside text somebody has already written is an invitation
                        to overwrite their sentence with a filename.

                        A FORM, not a click handler that fills the input, so it
                        works with scripting off like everything else here.
                      */}
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

                  {/*
                    TAGS. A comma separated text field, which is the same shape
                    the post editor's tag field submits, so an author who has
                    tagged a post already knows how this behaves.

                    The field carries the PARSED list joined back with commas,
                    never the delimiter-wrapped storage form. Nothing outside
                    `tags.mjs` should ever see `,alpha,beta,`.
                  */}
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

                  {/*
                    THE APPLIED TAGS AS CHIPS, each with a remove control, and
                    the SUGGESTIONS the path implies beside them.

                    Every one of these is a submit button on the SAME `set-tags`
                    intent, carrying the WHOLE resulting list as its value, with
                    ONE exception: the chip whose removal would leave nothing
                    submits `clear` instead, because an empty `tags` value is no
                    longer an instruction to clear. A button carries exactly one
                    name and value, so the marker replaces the list rather than
                    accompanying it. That
                    is deliberate: `setMediaTags` stays the one writer and the one
                    author of the delimiter rule, so a chip cannot become a second
                    way to write a tag that formats it differently. This table has
                    already been bitten once by two writers disagreeing about a
                    join character.

                    It also means every chip works with scripting off, which a
                    click handler mutating a text field would not.

                    A dashed outline on a suggestion and a solid one on an applied
                    tag, so the two differ by SHAPE and not only by a plus sign.
                  */}
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
                      {/*
                        CLEAR ALL, an explicit act with its own control.

                        Without it the only way to empty a long list would be to
                        remove chips one at a time, which is the kind of friction
                        that gets routed around. The point of the fix is that
                        clearing is DELIBERATE, not that it is tedious. Shown
                        only above one tag, because at exactly one tag the chip
                        beside it already does this and two controls for one act
                        is noise.
                      */}
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

                  {/*
                    THE ADDRESS, in the three forms an author actually pastes,
                    and THE LABELS CHANGE WITH THE FILE.

                    An image goes into a post as `![alt](src)` and a document
                    goes in as `[title](href)`, so a control labelled HTML has to
                    produce a different thing for each. It produced an `<img>`
                    tag for all seventy rows, which for the 31 documents is a
                    snippet that renders a broken image where a link was wanted.
                    The label is what stops somebody pressing it: "HTML tag" for a
                    picture, "HTML link" for a paper.

                    `copySnippetsFor` owns both the label and the value, so the
                    two cannot disagree, and it is unit tested with the document
                    case asserting that no `<img>` ever reaches one.
                  */}
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

                  {/*
                    TWINS: rows carrying IDENTICAL BYTES, found by content hash.
                    Exact identity only, never a similarity score.

                    The copy is careful, because this is the one place the page
                    offers to remove something on the strength of a comparison:
                    trashing a twin hides it from the library and BOTH addresses
                    keep working, so nothing here can cost a published page its
                    image.
                  */}
                  {detail.twins.length > 0 ? (
                    <div className="media-detail-twins">
                      <h4>Identical files</h4>
                      <ul className="media-detail-refs">
                        {detail.twins.map((twin) => (
                          <li key={twin.key}>
                            {/*
                              THE SENTENCE THE MOCKUP WRITES, per twin, because
                              it is the one that makes the offer safe to accept.

                              "Byte-identical" says the comparison was exact, not
                              a similarity score. "Both addresses resolve to the
                              same content" says what a reader most needs before
                              trashing one: the surviving address serves the same
                              bytes, so no published page changes. Naming the twin
                              in the button is the other half; "trash that one"
                              was ambiguous on a panel showing two files.
                            */}
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

                  {/*
                    THE CONTENT HASH, shown and never recomputed: the key already
                    carries it. A static row has a path rather than a hash, so it
                    gets nothing rather than a truncated path dressed as a digest.
                  */}
                  {detail.hash ? (
                    <p className="media-detail-hash">
                      <span className="media-display-label">sha256</span>
                      <code>{detail.hash}</code>
                    </p>
                  ) : null}

                  {/*
                    USAGE, IN THREE STATES, each with its title, its sentence and
                    the evidence behind it.

                    This section used to have two outcomes and the second one was
                    a confession: "an asset a route references in code would look
                    the same here". It was true, it was written by somebody who
                    knew the answer was incomplete, and it appeared on nine
                    photographs the site serves on every visit.

                    Now the third state has evidence of its own and the panel
                    names it. The heading is the CLAIM, the sentence is its
                    BOUNDARY, and the list underneath is what was actually found:
                    posts for `used`, source files for `in template`.
                  */}
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

                        {/* THE POSTS, which is what `used` is evidence of. */}
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

                        {/*
                          THE SOURCE FILES, which is what `in template` is
                          evidence of, and the whole reason the state exists.

                          Repo-relative paths rather than the mockup prose labels
                          ("Phage Hunters roster, page template"): those were
                          authored strings in a fixture, and a path is a fact the
                          reader can open and check. Not links, because the admin
                          has no source browser and a link to nothing is worse
                          than text.
                        */}
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

                  {/*
                    TRASH AND RESTORE, and NEITHER carries a confirm.

                    That is the friction ladder working, not a gap in it.
                    Trashing is reversible and changes nothing a reader can see,
                    so a confirm on it would be ceremony, and ceremony that is
                    always harmless is ceremony people learn to click through.
                    The confirm is spent where it buys something: on Delete
                    below, which is irreversible.

                    Offered on a static row too, unlike delete. Trashing tidies
                    the library and touches no file, which is exactly the thing a
                    static asset can safely have done to it.
                  */}
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

                  {/* A static asset shows WHY it cannot be deleted rather than
                      simply lacking a button. The action refuses it regardless;
                      this is so the page explains the refusal instead of
                      leaving a gap the operator has to interpret. */}
                  {detail.deletable ? (
                    <Form
                      method="post"
                      onSubmit={(event) => {
                        /*
                         * EARLIER FEEDBACK, NOT THE GATE. The action checks the
                         * same thing server-side, because this handler does not
                         * run for a reader without JavaScript and the R2 delete
                         * did. On accept it fills the field the server reads, so
                         * a scripted operator is asked once rather than twice.
                         */
                        if (!confirm(`Delete ${detail.key}? This removes the object from R2.`)) {
                          event.preventDefault();
                          return;
                        }
                        const field =
                          event.currentTarget.elements.namedItem(CONFIRM_FIELD);
                        if (field instanceof HTMLInputElement) field.value = "1";
                      }}
                    >
                      <input type="hidden" name="key" value={detail.key} />
                      {/* Empty with scripting off, which is what makes the action
                          refuse and open the confirmation below. */}
                      <input type="hidden" name={CONFIRM_FIELD} defaultValue="" />
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
        {/* Escape, the focus trap and focus return. Renders nothing; with no
            script the drawer still opens, works and closes by its own links. */}
        <MediaDrawer activeKey={detail.key} closeHref={linkTo({ key: "" })} />
        </>
  );
}
