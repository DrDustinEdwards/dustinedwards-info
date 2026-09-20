import { useEffect, useRef, useState } from "react";
import { Form, Link } from "react-router";

import { CONFIRM_FIELD } from "~/lib/destructive.mjs";

/**
 * THE ONE DESTRUCTIVE CONFIRMATION. A real `<dialog>`, opened with
 * `showModal()`, with an inline fallback for a reader without script.
 *
 * ## It is rendered because the ACTION refused, not because a handler ran
 *
 * An unconfirmed destructive POST is not an error, it is the confirmation step:
 * the action refuses, returns what it would have destroyed, and the route
 * renders this from that. So the ceremony is reachable on the no-script path by
 * construction rather than by a second code path that has to be remembered.
 * `window.confirm` and `window.prompt` are not confirmations; they are
 * script-only ceremony in front of destruction that is not script-only, and
 * this repo has now found that same defect on five separate controls.
 *
 * ## WHY `data-inline` AND NOT THE `open` ATTRIBUTE
 *
 * A `<dialog>` with no `open` is `display: none`, so with script disabled a
 * dialog nobody called `showModal()` on is simply gone, and the confirmation
 * would be unreachable exactly where it matters most.
 *
 * Putting `open` in the JSX solves that and creates a worse problem: React then
 * owns the attribute, `showModal()` sets it too, and `close()` removes it
 * behind React's back, so the element's modal state and the VDOM disagree the
 * first time either side changes.
 *
 * So the attribute React writes is `data-inline`, which is a plain data hook
 * this component owns and the UA has no opinion about. It is present on the
 * server render, `admin-posts.css` gives `dialog[data-inline]` a static
 * in-flow box, and the effect below removes it in the same pass that calls
 * `showModal()`. First hydration render matches the server exactly, because
 * `hydrated` starts false.
 *
 * ## THE DISABLED BUTTON IS FEEDBACK. THE ACTION IS THE GATE.
 *
 * The confirm button is rendered ENABLED on the server, because `typed` starts
 * empty and would never become anything without script: rendering it disabled
 * would leave a scriptless reader unable to confirm at all. Once hydrated it
 * refuses early. Either way `confirmationSatisfied` re-checks the typed count
 * inside the action, which is the only thing a crawler, a prefetch or a reader
 * without JavaScript cannot skip.
 *
 * ## THE INTENT IS A HIDDEN FIELD, NEVER THE SUBMITTER'S VALUE
 *
 * This is what makes the disabled button possible at all, and the posts list
 * carried the bug it prevents: a disabled submitter contributes NO name and NO
 * value, so a form whose intent rides on `<button name="intent">` sends no
 * intent the moment that button is disabled. `MediaConfirm` already put the
 * intent in a field for this reason; the posts and editor confirmations did
 * not, which is why neither could adopt disable-until-it-matches.
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
    // The field the ceremony is about, focused. `autoFocus` is not enough:
    // React applies it on mount rather than emitting the attribute, and the
    // dialog's own focus rules run when showModal is called, which is here.
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
          {/* NAMED FROM THE CONSTANT, because the action reads the same one. A
              literal here and a CONFIRM_FIELD there is two spellings of one
              wire name, and a rename would split them silently. */}
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
