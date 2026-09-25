import { Link } from "react-router";

import type { EditorFeedback } from "~/lib/editor/feedback";
import type { PostState } from "~/lib/editor/publish-transition.mjs";
import { PublishActions } from "./publish-actions";
import { moveRovingFocus } from "./roving-focus";
import type { Layout } from "./use-live-preview";

const LAYOUTS: Layout[] = ["write", "split", "preview"];

// Rendered only beside "Unsaved changes", so the local buffer never reads as a save.
function bufferAgeLabel(savedAt: string, now: number): string {
  const minutes = Math.floor((now - new Date(savedAt).getTime()) / 60_000);
  if (!Number.isFinite(minutes) || minutes < 1) return "just now";
  return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
}

/** The editor's top bar: back link and identity, the layout toggle, save state, settings and publish. */
export function EditorBar({
  title,
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
  title: string;
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
        <header className="editor-bar">
          <div className="editor-bar-group editor-bar-left">
            <Link to="/admin/posts" className="editor-back">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              Posts
            </Link>
            <span className="editor-identity">
              <span className="editor-identity-title">{title || "Untitled"}</span>
              <span className="status-pill" data-state={state}>
                {state}
              </span>
            </span>
          </div>

          {/* Gated on CodeMirror mounting: in the preview layout the write pane is `display:none`, and a
              required control that is not displayed blocks submission unreachably. */}
          <div className="editor-bar-group editor-bar-center">
            {richBody ? (
              /* A radio group, not three toggles: exactly one layout is on. Arrows move and choose,
                 and the chosen one is the single tab stop (APG radio group). */
              <div
                className="editor-layout-toggle"
                role="radiogroup"
                aria-label="Editor layout"
                onKeyDown={(event) => {
                  const next = moveRovingFocus(event, ".editor-layout-option", "both");
                  const option = next === null ? undefined : LAYOUTS[next];
                  if (option) chooseLayout(option);
                }}
              >
                {LAYOUTS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    className="editor-layout-option"
                    aria-checked={layout === option}
                    tabIndex={layout === option ? 0 : -1}
                    onClick={() => chooseLayout(option)}
                  >
                    {option === "write" ? "Write" : option === "split" ? "Split" : "Preview"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="editor-bar-group editor-bar-right">
            <span className={dirty ? "editor-dirty is-dirty" : "editor-dirty"}>
              <span className="editor-dirty-dot" aria-hidden="true" />
              {!headSha
                ? "Saving unavailable"
                : dirty
                  ? "Unsaved changes"
                  : feedback && feedback.state !== "failed"
                    ? `Saved ${feedback.sha}`
                    : `Saved ${shortHead}`}
            </span>

            {/* Nothing renders on the server, so the static harness render is unchanged. */}
            {dirty && savedAt ? (
              <span className="editor-buffer-age" aria-live="polite">
                last written {bufferAgeLabel(savedAt, ageNow)}
              </span>
            ) : dirty && bufferTried ? (
              /* Muted, not warning: its neighbor is already warning-tinted, and two would read as two problems. */
              <span className="editor-buffer-age" aria-live="polite">
                Not backed up: browser storage unavailable
              </span>
            ) : null}

            {/* The zero-JS preview path. Removed rather than hidden once scripted: it carries no value
                the save path needs. */}
            {!richBody ? (
              <button
                type="submit"
                name="intent"
                value="preview"
                className="btn-ghost editor-preview-submit"
                disabled={busy}
              >
                Render
              </button>
            ) : null}

            <button
              type="button"
              className="editor-icon-button"
              aria-expanded={drawerOpen}
              aria-haspopup="dialog"
              aria-label="Post settings"
              title="Post settings"
              onClick={openDrawer}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.3.38.55.67.7H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            <div className="editor-primary">
              <PublishActions
                state={state}
                everPublished={everPublished}
                publishAt={publishAt}
                onPublishAtChange={onPublishAtChange}
                busy={busy}
                disabled={!headSha}
              />
            </div>
          </div>
        </header>
  );
}
