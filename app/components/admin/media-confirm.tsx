import { useEffect, useRef, useState } from "react";
import { Form, Link } from "react-router";

import { CONFIRM_FIELD } from "~/lib/destructive.mjs";

/**
 * A DESTRUCTIVE CONFIRMATION, as a real modal rather than `window.prompt`.
 *
 * WHY prompt() HAD TO GO: it was called from an `onSubmit` handler, so WITH
 * SCRIPTING OFF THE HANDLER NEVER RAN AND THE FORM SUBMITTED STRAIGHT THROUGH,
 * deleting every trashed object with no confirmation at all. It is also
 * unstyleable, blocks the browser, and is silently disabled in some contexts.
 *
 * THE TYPE-THE-COUNT LADDER IS PRESERVED EXACTLY: the count is the thing a
 * distracted person gets wrong, and the confirm button stays DISABLED until the
 * typed value matches, which `prompt()` could not express.
 *
 * TWO TRIGGERS, ONE APPEARANCE: empty-trash opens from a URL and works with no
 * script; bulk trash opens from client state, because the selection it acts on IS
 * client state.
 */
export function MediaConfirm({
  open,
  title,
  body,
  /** When set, the operator must type this exact string to enable confirm. */
  requireTyped,
  confirmLabel,
  /** Rendered inside the form: the intent and any keys being acted on. */
  children,
  /** A link for the no-script cancel path, or a handler for the client one. */
  cancelHref,
  onCancel,
  method = "post",
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  requireTyped?: string;
  confirmLabel: string;
  children: React.ReactNode;
  cancelHref?: string;
  onCancel?: () => void;
  method?: "post";
}) {
  const [typed, setTyped] = useState("");
  /*
   * THE SERVER IS THE AUTHORITY EITHER WAY: the action re-reads the typed count and
   * refuses on a mismatch, so disabling the button is EARLIER FEEDBACK, not the
   * check.
   *
   * That is what makes the no-script path work. Rendering it disabled on the server
   * would leave a reader without script unable to empty the trash at all, because
   * `typed` stays "" forever. Initialized false so the hydration render matches.
   */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const panel = useRef<HTMLDivElement | null>(null);

  const satisfied = !requireTyped || typed.trim() === requireTyped;

  useEffect(() => {
    if (!open) return;
    const el = panel.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>("input,button,a[href]");
    first?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onCancel?.();
        return;
      }
      if (event.key !== "Tab") return;
      const stops = [
        ...el.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled])',
        ),
      ];
      const firstStop = stops[0];
      const last = stops[stops.length - 1];
      // The values are guarded rather than the length. Same early return on an
      // empty list, and it is what tells the compiler these two are elements.
      if (!firstStop || !last) return;
      if (!el.contains(document.activeElement)) {
        event.preventDefault();
        firstStop.focus();
      } else if (event.shiftKey && document.activeElement === firstStop) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        firstStop.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="media-modal-layer">
      {/* The scrim. A link when there is a URL to go back to, a button when the
          trigger was client state; either way clicking outside cancels. */}
      {cancelHref ? (
        <Link
          to={cancelHref}
          preventScrollReset
          className="media-modal-scrim"
          aria-label="Cancel"
        />
      ) : (
        <button
          type="button"
          className="media-modal-scrim"
          aria-label="Cancel"
          onClick={onCancel}
        />
      )}
      <div
        ref={panel}
        className="media-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="media-modal-title"
      >
        <h2 id="media-modal-title">{title}</h2>
        <div className="media-modal-body">{body}</div>
        <Form method={method} className="media-modal-form">
          {children}
          {requireTyped ? (
            <label className="media-modal-typed">
              <span className="sr-only">Type {requireTyped} to confirm</span>
              {/*
               * NAMED FROM THE CONSTANT, because the server reads the same one: two spellings
               * of one wire name would split silently on a rename.
               */}
              <input
                name={CONFIRM_FIELD}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder="Type the number to confirm"
                autoComplete="off"
              />
            </label>
          ) : null}
          <div className="media-modal-actions">
            {cancelHref ? (
              <Link to={cancelHref} preventScrollReset className="btn-ghost">
                Cancel
              </Link>
            ) : (
              <button type="button" className="btn-ghost" onClick={onCancel}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn-danger" disabled={hydrated && !satisfied}>
              {confirmLabel}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
