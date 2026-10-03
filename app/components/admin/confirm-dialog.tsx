import { useEffect, useId, useRef, useState } from "react";
import { Form, Link, useNavigate } from "react-router";

import { CONFIRM_FIELD } from "~/lib/destructive.mjs";

// Capsomer's dialog markup and look, on this component's own behaviour: Capsomer's ConfirmDialog is driven
// from script, and this one is opened by the server's answer, so the second step exists without script too.
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
  /** Cancel for a dialog opened from client state rather than the URL, which has nowhere to go. */
  onCancel,
  children,
}: {
  title: string;
  body: React.ReactNode;
  stake?: string[];
  /** Absent for a reversible action: the dialog then confirms without a typed value. */
  requireTyped?: string;
  confirmLabel: string;
  children: React.ReactNode;
} & ({ cancelHref: string; onCancel?: never } | { cancelHref?: never; onCancel: () => void })) {
  const ref = useRef<HTMLDialogElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const titleId = useId();
  const formId = useId();
  const navigate = useNavigate();

  useEffect(() => {
    setHydrated(true);
    // Read before showModal() moves focus: the control that opened it, or nothing on a page load.
    const active = document.activeElement;
    const origin = active instanceof HTMLElement && active !== document.body ? active : null;
    const el = ref.current;
    if (el && !el.open) el.showModal();
    // autoFocus is not enough: React focuses on mount, and the dialog's focus rules run at showModal().
    fieldRef.current?.focus();
    // Unmounting drops focus on the body. Deferred, so the page Cancel returns to has rendered.
    return () => {
      window.setTimeout(() => {
        if (document.activeElement && document.activeElement !== document.body) return;
        // In order: the opener; its menu's button, when the opener was an item in a row menu whose
        // popover has since closed and so cannot take focus; the page.
        const panel = origin?.closest<HTMLElement>("[popover]");
        const candidates = [
          origin,
          panel?.id
            ? document.querySelector<HTMLElement>(`[popovertarget="${CSS.escape(panel.id)}"]`)
            : null,
          document.getElementById("main"),
        ];
        for (const back of candidates) {
          if (!back?.isConnected) continue;
          back.focus({ preventScroll: true });
          if (document.activeElement === back) return;
        }
      }, 0);
    };
  }, []);

  const satisfied = requireTyped === undefined || typed.trim() === requireTyped;
  // Cancel keeps the scroll position: the page behind the dialog is where the reader still is.
  const cancel = () => {
    if (cancelHref === undefined) onCancel?.();
    else navigate(cancelHref, { preventScrollReset: true });
  };

  return (
    <dialog
      ref={ref}
      className="cap-dialog"
      data-placement="center"
      data-size="md"
      role="alertdialog"
      data-inline={hydrated ? undefined : ""}
      aria-labelledby={titleId}
      /* Escape leaves the way Cancel does: a natively closed dialog would leave the page still asking. */
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      {/* The form holds the caller's hidden fields; the typed field and the submit button join it by
          `form`, so the dialog's header, body and footer stay its direct children, as Capsomer lays them out. */}
      <Form method="post" id={formId}>
        {children}
      </Form>
      <div className="cap-dialog-header">
        <h2 className="cap-dialog-title" id={titleId}>
          {title}
        </h2>
      </div>
      <div className="cap-dialog-body">
        {body}
        {stake && stake.length > 0 ? (
          <ul>
            {stake.map((item) => (
              <li key={item}>
                <code>{item}</code>
              </li>
            ))}
          </ul>
        ) : null}
        {requireTyped === undefined ? null : (
          <div className="cap-confirm-typed">
            <label htmlFor={`${formId}-typed`}>
              Type <b>{requireTyped}</b> to confirm
            </label>
            {/* From the constant the action also reads, so a rename cannot split the wire name. */}
            <input
              id={`${formId}-typed`}
              ref={fieldRef}
              className="cap-input"
              form={formId}
              type="text"
              name={CONFIRM_FIELD}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </div>
        )}
      </div>
      <div className="cap-dialog-footer" data-align="between">
        {cancelHref === undefined ? (
          <button type="button" className="cap-btn" onClick={onCancel}>
            Cancel
          </button>
        ) : (
          <Link to={cancelHref} preventScrollReset className="cap-btn">
            Cancel
          </Link>
        )}
        <button
          type="submit"
          form={formId}
          className="cap-btn"
          data-variant="danger"
          disabled={hydrated && !satisfied}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
