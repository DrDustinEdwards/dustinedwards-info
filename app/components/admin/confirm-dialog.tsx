import { useEffect, useRef, useState } from "react";
import { Form, Link } from "react-router";

import { CONFIRM_FIELD } from "~/lib/destructive.mjs";

/**
 * THE ONE DESTRUCTIVE CONFIRMATION. A real `<dialog>` opened with `showModal()`,
 * with an inline fallback for a reader without script.
 *
 * IT IS RENDERED BECAUSE THE ACTION REFUSED, not because a handler ran. An
 * unconfirmed destructive POST is the confirmation step, so the ceremony is
 * reachable on the no-script path by construction. `window.confirm` and
 * `window.prompt` are not confirmations; they are script-only ceremony in front of
 * destruction that is not.
 *
 * WHY `data-inline` AND NOT `open`: a `<dialog>` with no `open` is
 * `display: none`, and putting `open` in the JSX makes React and `showModal()`
 * fight over the attribute. `data-inline` is a hook this component owns and the UA
 * has no opinion about.
 *
 * THE DISABLED BUTTON IS FEEDBACK. THE ACTION IS THE GATE. It renders ENABLED on
 * the server, because `typed` would never become anything without script.
 *
 * THE INTENT IS A HIDDEN FIELD, NEVER THE SUBMITTER'S VALUE: a disabled submitter
 * contributes NO name and NO value.
 */
export function ConfirmDialog({
  title,
  body,
  /** Each item at stake, shown to the reader. Re-carry them in `children`. */
  stake,
  /** The value the operator must type exactly. Rendered, so it is a string. */
  requireTyped,
  confirmLabel,
  /** Where Cancel goes. Carry the current query so filters survive. */
  cancelHref,
  /** Hidden fields: the intent, and whatever identifies what is at stake. */
  children,
}: {
  title: string;
  body: React.ReactNode;
  stake?: string[];
  requireTyped: string;
  confirmLabel: string;
  cancelHref: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  /** False on the server AND on the first client render, so they match. */
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const el = ref.current;
    if (!el) return;
    // Mounting IS opening: the route renders this only when the action refused.
    if (!el.open) el.showModal();
    // `autoFocus` is not enough: React applies it on mount rather than emitting the
    // attribute, and the dialog's own focus rules run when `showModal` is called,
    // which is here.
    fieldRef.current?.focus();
  }, []);

  const satisfied = typed.trim() === requireTyped;

  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      data-inline={hydrated ? undefined : ""}
      aria-labelledby="confirm-dialog-title"
    >
      <Form method="post" className="confirm-dialog-form">
        <h2 id="confirm-dialog-title">{title}</h2>
        <div className="confirm-dialog-body">{body}</div>
        {stake && stake.length > 0 ? (
          <ul className="confirm-dialog-stake">
            {stake.map((item) => (
              <li key={item}>
                <code>{item}</code>
              </li>
            ))}
          </ul>
        ) : null}
        {children}
        <label className="confirm-dialog-typed">
          <span>
            Type <strong>{requireTyped}</strong> to confirm
          </span>
          {/*
           * NAMED FROM THE CONSTANT, because the action reads the same one: a literal here
           * and a `CONFIRM_FIELD` there is two spellings of one wire name, and a rename
           * would split them silently.
           */}
          <input
            ref={fieldRef}
            type="text"
            name={CONFIRM_FIELD}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            inputMode="numeric"
            autoComplete="off"
            required
          />
        </label>
        <div className="confirm-dialog-actions">
          <Link to={cancelHref} className="btn-secondary">
            Cancel
          </Link>
          <button
            type="submit"
            className="btn-danger"
            disabled={hydrated && !satisfied}
          >
            {confirmLabel}
          </button>
        </div>
      </Form>
    </dialog>
  );
}
