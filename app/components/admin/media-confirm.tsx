import { useEffect, useRef, useState } from "react";
import { Form, Link, useNavigate } from "react-router";

import { CONFIRM_FIELD } from "~/lib/destructive.mjs";

export function MediaConfirm({
  open,
  title,
  body,
  requireTyped,
  confirmLabel,
  children,
  cancelHref,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  requireTyped?: string;
  confirmLabel: string;
  children: React.ReactNode;
  cancelHref?: string;
  onCancel?: () => void;
}) {
  const [typed, setTyped] = useState("");
  // Enabled on the server: without script `typed` stays "" forever, and the action re-checks the count.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const panel = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

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
        // The same exit as the Cancel control: a link when there is one, else the handler.
        if (cancelHref) navigate(cancelHref, { preventScrollReset: true });
        else onCancel?.();
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
  }, [open, onCancel, cancelHref, navigate]);

  if (!open) return null;

  return (
    <div className="media-modal-layer">
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
        <Form method="post" className="media-modal-form">
          {children}
          {requireTyped ? (
            <label className="media-modal-typed">
              <span className="sr-only">Type {requireTyped} to confirm</span>
              {/* From the constant the server also reads, so a rename cannot split the wire name. */}
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
