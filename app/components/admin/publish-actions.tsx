import { useEffect, useRef, useState } from "react";

import { transitionsFor, type PostState } from "~/lib/editor/publish-transition.mjs";
import { OverflowMenu } from "./overflow-menu";

/**
 * The publish state machine, as controls.
 *
 * The draft checkbox is gone. What replaced it names the transition instead of
 * stating a field: the primary button says Publish, Republish or Save changes,
 * and the author never has to translate "draft is unticked" into "this is on
 * the internet".
 *
 * The payload is unchanged, and the mechanism deserves stating because it looks
 * like a trick. `fieldsFromForm` reads `form.get("draft") === "on"`, so a
 * checkbox sent `draft=on` when ticked and sent NOTHING when unticked. A hidden
 * input reproduces exactly that, because a DISABLED control is not submitted:
 * enabled it sends `draft=on`, disabled it sends no key at all. Each button
 * sets that flag in its own `onClick`, which fires before the submit, and it
 * does so imperatively through a ref rather than through state because a React
 * state update would not have landed by the time the form serialises.
 *
 * That the transitions map correctly is asserted by check:admin-ui against
 * publish-transition.mjs, not by this component. Rendering cannot see what a
 * button does on click, so the table lives in a module a gate can import.
 */
export function PublishActions({
  state,
  everPublished,
  draftFieldRef,
  publishAt,
  onPublishAtChange,
  busy,
  disabled,
}: {
  state: PostState;
  everPublished: boolean;
  /** The hidden `draft` input. Toggled, never re-rendered. */
  draftFieldRef: React.RefObject<HTMLInputElement | null>;
  publishAt: string;
  onPublishAtChange: (value: string) => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const [ceremony, setCeremony] = useState(false);
  const transitions = transitionsFor(state, everPublished);
  const [primary, ...secondary] = transitions;

  /** Sets what this submit will send for `draft`, synchronously. */
  const arm = (wantsDraft: boolean) => {
    const field = draftFieldRef.current;
    if (field) field.disabled = !wantsDraft;
  };

  return (
    <div className="publish-actions">
      <OverflowMenu label="More">
        {secondary.map((transition) => (
          <button
            key={transition.id}
            type="submit"
            name="intent"
            value="save"
            data-menu-item
            className={
              transition.danger ? "overflow-menu-item is-danger" : "overflow-menu-item"
            }
            disabled={disabled}
            onClick={() => arm(transition.wantsDraft)}
          >
            {transition.label}
            <span className="overflow-menu-item-hint">
              {transition.id === "unpublish"
                ? "Takes it off the public site. The file and the history stay."
                : "Commits without changing whether it is public."}
            </span>
          </button>
        ))}
        {state !== "draft" ? (
          <button
            type="button"
            data-menu-item
            className="overflow-menu-item"
            onClick={() => setCeremony(true)}
          >
            Reschedule
            <span className="overflow-menu-item-hint">
              Change when this goes live.
            </span>
          </button>
        ) : null}
      </OverflowMenu>

      {primary.ceremony ? (
        <>
          {/* A first publication does not happen on a single click. The button
              opens the choice; the dialog contains the two submits. */}
          <button
            type="button"
            className="btn"
            disabled={disabled || busy}
            onClick={() => setCeremony(true)}
          >
            {primary.label}
          </button>
          <PublishCeremony
            open={ceremony}
            onClose={() => setCeremony(false)}
            publishAt={publishAt}
            onPublishAtChange={onPublishAtChange}
            onArm={arm}
          />
        </>
      ) : (
        <>
          <button
            type="submit"
            name="intent"
            value="save"
            className="btn"
            disabled={disabled || busy}
            onClick={() => arm(primary.wantsDraft)}
          >
            {busy ? "Saving" : primary.label}
          </button>
          <PublishCeremony
            open={ceremony}
            onClose={() => setCeremony(false)}
            publishAt={publishAt}
            onPublishAtChange={onPublishAtChange}
            onArm={arm}
            reschedule
          />
        </>
      )}
    </div>
  );
}

/**
 * Publish now, or hold until a time.
 *
 * A `<dialog>` again, for the platform focus trap. Both buttons inside it are
 * real submits of the editing form: the dialog sits INSIDE that form, and
 * `showModal()` moves an element to the top layer visually without moving it in
 * the DOM, so form association by containment still holds.
 */
function PublishCeremony({
  open,
  onClose,
  publishAt,
  onPublishAtChange,
  onArm,
  reschedule,
}: {
  open: boolean;
  onClose: () => void;
  publishAt: string;
  onPublishAtChange: (value: string) => void;
  onArm: (wantsDraft: boolean) => void;
  reschedule?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [when, setWhen] = useState(() => localInput(publishAt) || soonLocal());

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const sync = () => onClose();
    dialog.addEventListener("close", sync);
    return () => dialog.removeEventListener("close", sync);
  }, [onClose]);

  return (
    <dialog ref={ref} className="ceremony" aria-labelledby="ceremony-title">
      <h2 id="ceremony-title">
        {reschedule ? "When does this go live?" : "Publish this post"}
      </h2>
      {reschedule ? null : (
        <p>
          It has never been public. Publishing puts it on the blog, in the feed,
          the sitemap, the search index and the AI answer layer.
        </p>
      )}

      <div className="ceremony-choice">
        <button
          type="submit"
          name="intent"
          value="save"
          className="btn"
          onClick={() => {
            onPublishAtChange("");
            onArm(false);
          }}
        >
          Publish now
        </button>

        <div className="ceremony-schedule">
          <label className="field-label" htmlFor="ceremony-when">
            Or hold until
          </label>
          <input
            id="ceremony-when"
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
          />
          <button
            type="submit"
            name="intent"
            value="save"
            className="btn-ghost"
            onClick={() => {
              onPublishAtChange(iso(when));
              onArm(false);
            }}
          >
            Schedule
          </button>
        </div>
      </div>

      <button type="button" className="btn-ghost" onClick={onClose}>
        Cancel
      </button>
    </dialog>
  );
}

function localInput(value: string) {
  const at = Date.parse(value);
  if (Number.isNaN(at)) return "";
  return new Date(at - new Date(at).getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function iso(local: string) {
  if (!local) return "";
  const at = Date.parse(local);
  return Number.isNaN(at) ? "" : new Date(at).toISOString();
}

function soonLocal() {
  const soon = new Date(Date.now() + 60 * 60 * 1000);
  return new Date(soon.getTime() - soon.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
