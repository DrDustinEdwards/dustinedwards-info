import { useEffect, useRef, useState } from "react";
import { Form, Link } from "react-router";

/**
 * A DESTRUCTIVE CONFIRMATION, as a real modal rather than `window.prompt`.
 *
 * ## WHY prompt() HAD TO GO, and it is worse than "it looks wrong"
 *
 * The empty-trash control called `prompt()` from an `onSubmit` handler and
 * cancelled the submit unless the reader typed the count. **With scripting off
 * the handler never ran and the form submitted straight through**, deleting
 * every trashed object with no confirmation at all. The ceremony was
 * script-only while the destruction was not, which is the exact inversion of
 * what a friction ladder is for.
 *
 * `prompt()` is also unstyleable, unreadable to a screen reader beyond its bare
 * string, blocks the whole browser, and is silently disabled in some contexts,
 * where the form would again submit unconfirmed.
 *
 * ## THE TYPE-THE-COUNT LADDER IS PRESERVED EXACTLY
 *
 * The ruling is unchanged: a bulk delete asks the operator to type the number
 * of files, because the count is the thing a distracted person gets wrong. The
 * confirm button stays DISABLED until the typed value matches, which `prompt()`
 * could not express at all.
 *
 * ## TWO TRIGGERS, ONE APPEARANCE
 *
 * Empty-trash opens from a URL (`?confirm=empty-trash`), so it is
 * server-rendered and works with no script. Bulk trash opens from client state,
 * because the selection it acts on IS client state and the bulk bar it lives in
 * does not exist without script either. Same component, same ladder, same look;
 * only the trigger differs, and each trigger matches what its subject depends
 * on.
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
   * WHETHER SCRIPT IS RUNNING, which decides who enforces the ladder.
   *
   * **THE SERVER IS THE AUTHORITY EITHER WAY.** The action re-reads the typed
   * count and refuses on a mismatch, so the ladder holds whether or not this
   * component is alive. Disabling the button is EARLIER FEEDBACK, not the
   * check.
   *
   * That distinction is what makes the no-script path work. Rendering the
   * button disabled on the server would leave a reader without script unable to
   * empty the trash at all, because nothing would ever enable it: `typed` stays
   * "" forever. So the server renders it ENABLED, the reader types and submits,
   * and the action decides. Once hydrated, the button starts refusing early.
   *
   * Initialised false so the hydration render matches the server's.
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
      if (stops.length === 0) return;
      const firstStop = stops[0];
      const last = stops[stops.length - 1];
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
              {/* NAMED, because the server is the one that checks it. */}
              <input
                name="confirm-count"
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
