import { useRef } from "react";
import { Form, Link } from "react-router";

import { CopyButton } from "~/components/admin/copy-button";
import { LiveNotice } from "~/components/admin/live-notice";
import { useInspectorDialog } from "~/components/admin/media-drawer";
import { MediaToast } from "~/components/admin/toast";
import {
  InspectorAltForm,
  InspectorDangerZone,
  InspectorFacts,
  InspectorTagForms,
  InspectorUsage,
} from "~/components/admin/media-inspector-sections";
import { copySnippetsFor, usageDescriptor } from "~/lib/media/usage.mjs";
import type { hrefWith } from "~/lib/media/view.mjs";

import type { Route } from "../../routes/+types/admin.media._index";

type Listing = Extract<Route.ComponentProps["loaderData"], { detail: unknown }>;
type Detail = NonNullable<Listing["detail"]>;

export function MediaInspector({
  detail,
  linkTo,
  message,
  refused,
}: {
  detail: Detail;
  linkTo: (over?: Parameters<typeof hrefWith>[1]) => string;
  /** The last action's result: announced in here, because the page behind a modal is inert. */
  message?: string;
  refused?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const hydrated = useInspectorDialog(ref, detail.key, linkTo({ key: "" }));

  return (
        <>
        {/* A link, not a div with a handler, so closing by clicking outside needs no script. */}
        <Link
          to={linkTo({ key: "" })}
          className="media-detail-scrim"
          preventScrollReset
          aria-label="Close the inspector"
        />
        {/* `data-inline`, not `open`: an `open` in the JSX would fight showModal(). Until then the
            server render shows it as the fixed panel it always was, working without script. */}
        <dialog
          ref={ref}
          className="media-detail"
          data-inline={hydrated ? undefined : ""}
          aria-label={`Details for ${detail.found ? (detail.originalName ?? detail.key) : detail.key}`}
          tabIndex={-1}
        >
          {/* First in the document so it survives the found and missing branches; CSS draws it under the header. */}
          <div className="media-detail-notice">
            <LiveNotice
              status={message && !refused ? message : undefined}
              alert={message && refused ? message : undefined}
            />
          </div>
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
                  <InspectorFacts detail={detail} />
                  <InspectorAltForm detail={detail} />
                  <InspectorTagForms detail={detail} />

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

                  <InspectorUsage detail={detail} />
                  <InspectorDangerZone detail={detail} />
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
          <MediaToast inDialog />
        </dialog>
        </>
  );
}
