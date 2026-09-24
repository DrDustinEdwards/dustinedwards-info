import { useEffect, useRef, useState } from "react";
import { Form, Link } from "react-router";

import { CONFIRM_FIELD } from "~/lib/destructive.mjs";

// `data-inline`, not `open`: putting `open` in the JSX makes React and showModal() fight over it.
// The intent is a hidden field because a disabled submitter contributes no name and no value.
export function ConfirmDialog({
  title,
  body,
  stake,
  requireTyped,
  confirmLabel,
  /** Where Cancel goes. Carry the current query so filters survive. */
  cancelHref,
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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    const el = ref.current;
    if (!el) return;
    if (!el.open) el.showModal();
    // autoFocus is not enough: React focuses on mount, and the dialog's focus rules run at showModal().
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
          {/* From the constant the action also reads, so a rename cannot split the wire name. */}
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
