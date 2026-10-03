import { Segmented } from "capsomer/react/segmented";
import { Status } from "capsomer/react/status";

import type { EditorFeedback } from "~/lib/editor/feedback";
import type { PostState } from "~/lib/editor/publish-transition.mjs";
import { PublishActions } from "./publish-actions";
import type { Layout } from "./use-live-preview";

// Rendered only beside "Unsaved changes", so the local buffer never reads as a save.
function bufferAgeLabel(savedAt: string, now: number): string {
  const minutes = Math.floor((now - new Date(savedAt).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "just now";
  return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}

/**
 * The editor's controls, which the page head carries: the layout choice, save state, settings and publish.
 * They sit outside the editing form, so each submit button names it with `form`.
 */
export function EditorBar({
  formId,
  state,
  richBody,
  layout,
  chooseLayout,
  dirty,
  headSha,
  feedback,
  savedAt,
  ageNow,
  bufferTried,
  busy,
  drawerOpen,
  openDrawer,
  everPublished,
  publishAt,
  onPublishAtChange,
}: {
  formId: string;
  state: PostState;
  richBody: boolean;
  layout: Layout;
  chooseLayout: (next: Layout) => void;
  dirty: boolean;
  headSha: string;
  feedback?: EditorFeedback | null;
  savedAt: string | null;
  ageNow: number;
  bufferTried: boolean;
  busy: boolean;
  drawerOpen: boolean;
  openDrawer: () => void;
  everPublished: boolean;
  publishAt: string;
  onPublishAtChange: (value: string) => void;
}) {
  const shortHead = headSha ? headSha.slice(0, 7) : "";

  return (
    <>
      {/* Gated on CodeMirror mounting: in the preview layout the write pane is `display:none`, and a
          required control that is not displayed blocks submission unreachably. */}
      {richBody ? (
        <Segmented
          legend="Editor layout"
          hideLegend
          size="sm"
          value={layout}
          onChange={chooseLayout}
          options={[
            { value: "write", label: "Write" },
            { value: "split", label: "Split" },
            { value: "preview", label: "Preview" },
          ]}
        />
      ) : null}

      <span>
        {!headSha ? (
          <Status tone="crit">Saving unavailable</Status>
        ) : dirty ? (
          <Status tone="warn">Unsaved changes</Status>
        ) : (
          <Status tone="ok">{`Saved ${feedback && feedback.state !== "failed" ? feedback.sha : shortHead}`}</Status>
        )}

        {/* Nothing renders on the server, so the static harness render is unchanged. */}
        {dirty && savedAt ? (
          /* Not live: the age ticks every minute, and each tick would interrupt the author. */
          <span className="cap-muted"> last written {bufferAgeLabel(savedAt, ageNow)}</span>
        ) : dirty && bufferTried ? (
          <span className="cap-muted" aria-live="polite">
            {" "}
            Not backed up: browser storage unavailable
          </span>
        ) : null}
      </span>

      {/* The zero-JS preview path. Removed rather than hidden once scripted: it carries no value
          the save path needs. */}
      {!richBody ? (
        <button
          type="submit"
          form={formId}
          name="intent"
          value="preview"
          className="cap-btn"
          aria-disabled={busy || undefined}
        >
          Render
        </button>
      ) : null}

      <button
        type="button"
        className="cap-btn"
        data-icon-only=""
        aria-expanded={drawerOpen}
        aria-haspopup="dialog"
        aria-label="Post settings"
        title="Post settings"
        onClick={openDrawer}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path
            d="M2.5 4.5h6M11.5 4.5h2M2.5 8h2M7.5 8h6M2.5 11.5h6M11.5 11.5h2M10 3v3M5.5 6.5v3M10 10v3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <PublishActions
        formId={formId}
        state={state}
        everPublished={everPublished}
        publishAt={publishAt}
        onPublishAtChange={onPublishAtChange}
        busy={busy}
        disabled={!headSha}
      />
    </>
  );
}
