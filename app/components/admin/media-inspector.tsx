import { useRef } from "react";
import { Form, Link } from "react-router";
import { Status } from "capsomer/react/status";

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

const USAGE_TONE: Record<string, "ok" | "warn" | "nodata"> = {
  used: "ok",
  unattached: "warn",
  unknown: "nodata",
};

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

  /* `data-inline`, not `open`: an `open` in the JSX would fight showModal(). Until then the server
     render shows it in the page, working without script. */
  return (
    <dialog
      ref={ref}
      className="cap-dialog"
      data-media-inspector=""
      data-placement="right"
      data-size="md"
      data-inline={hydrated ? undefined : ""}
      aria-label={`Details for ${detail.found ? (detail.originalName ?? detail.key) : detail.key}`}
      tabIndex={-1}
    >
      {detail.found ? (
        <div className="cap-dialog-header" data-divider="">
          {/* Ellipsised, not wrapped: a content-addressed key can wrap to three lines and push the panel down. */}
          <h2 className="cap-dialog-title" title={detail.key}>
            {detail.originalName ?? detail.key}
          </h2>
          <p className="cap-dialog-description">
            <Status tone={USAGE_TONE[detail.usage] ?? "nodata"}>{usageDescriptor(detail.usage).label}</Status>
          </p>
        </div>
      ) : null}

      <div className="cap-dialog-body">
        <div className="app-form">
          {/* First in the body so it survives the found and missing branches. */}
          <LiveNotice
            status={message && !refused ? message : undefined}
            alert={message && refused ? message : undefined}
          />
          {detail.found ? (
            <>
              <div className="cap-media-preview">
                {detail.viewable ? (
                  <img src={detail.thumb} alt="" width={640} height={427} />
                ) : (
                  <span className="cap-media-doc" aria-hidden="true">
                    {(detail.mime ?? "file").split("/").pop()?.toUpperCase()}
                  </span>
                )}
              </div>

              <InspectorFacts detail={detail} />
              <InspectorAltForm detail={detail} />
              <InspectorTagForms detail={detail} />

              <div className="cap-field">
                <h3 className="cap-field-label">Copy</h3>
                <div className="app-actions">
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
              </div>

              {/* Trashing a twin hides it and both addresses keep working, so no published page loses its image. */}
              {detail.twins.length > 0 ? (
                <div className="cap-field">
                  <h3 className="cap-field-label">Identical files</h3>
                  <ul className="app-form">
                    {detail.twins.map((twin) => (
                      <li key={twin.key} className="app-form">
                        <p>
                          Byte-identical to <Link to={linkTo({ key: twin.key })}>{twin.key}</Link>, both
                          addresses resolve to the same content.
                        </p>
                        <Form method="post">
                          <input type="hidden" name="key" value={twin.key} />
                          <button
                            type="submit"
                            name="intent"
                            value="trash"
                            className="cap-btn"
                            data-variant="danger"
                            data-size="sm"
                          >
                            Keep this, trash {twin.originalName ?? twin.key.split("/").pop() ?? twin.key}
                          </button>
                        </Form>
                      </li>
                    ))}
                  </ul>
                  <p className="cap-muted">
                    Trashing one hides it from the library. Every address keeps working and no page
                    changes.
                  </p>
                </div>
              ) : null}

              {/* Read off the key, never recomputed. A static row's key is a path, so it shows nothing. */}
              {detail.hash ? (
                <div className="cap-field">
                  <span className="cap-field-label">sha256</span>
                  <code className="cap-mono">{detail.hash}</code>
                </div>
              ) : null}

              <InspectorUsage detail={detail} />
              <InspectorDangerZone detail={detail} />
            </>
          ) : (
            <p className="cap-muted">
              Nothing in the index has the key {detail.key}. It may have been deleted.{" "}
              <Link to={linkTo({ key: "" })} preventScrollReset>
                Back to the library
              </Link>
              .
            </p>
          )}
          <MediaToast inDialog />
        </div>
      </div>

      <Link
        to={linkTo({ key: "" })}
        className="cap-btn cap-dialog-close"
        data-variant="quiet"
        data-icon-only=""
        preventScrollReset
        aria-label="Close the inspector"
        title="Close, or press escape"
      >
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
          <path d="m4 4 8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </Link>
    </dialog>
  );
}
