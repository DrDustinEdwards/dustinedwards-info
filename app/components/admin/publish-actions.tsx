import { useEffect, useRef, useState } from "react";

import {
  PUBLISH_CONFIRMED_INTENT,
  transitionsFor,
  type PostState,
} from "~/lib/editor/publish-transition.mjs";
import { OverflowMenu } from "./overflow-menu";

/**
 * The publish state machine, as controls. The primary button names the
 * transition rather than stating a field.
 *
 * EVERY BUTTON CARRIES ITS OWN TRANSITION. Each control submits
 * `intent=<transition id>` and the server reads the draft flag off that intent, so
 * nothing is flipped, nothing is armed, and no handler has to run for the request
 * to say what the author asked for.
 *
 * That the transitions map correctly is asserted by `check:admin-ui` against
 * `publish-transition.mjs`: the intent is in the markup, so the gate reads it off
 * the rendered page rather than taking a click handler on trust.
 */
export function PublishActions({
  state,
  everPublished,
  publishAt,
  onPublishAtChange,
  busy,
  disabled,
}: {
  state: PostState;
  everPublished: boolean;
  publishAt: string;
  onPublishAtChange: (value: string) => void;
  busy?: boolean;
  disabled?: boolean;
}) {
  const [ceremony, setCeremony] = useState(false);
  const transitions = transitionsFor(state, everPublished);
  const [primary, ...secondary] = transitions;

  return (
    <div className="publish-actions">
      <OverflowMenu label="More">
        {secondary.map((transition) => (
          <button
            key={transition.id}
            type="submit"
            name="intent"
            value={transition.id}
            data-menu-item
            className={
              transition.danger ? "overflow-menu-item is-danger" : "overflow-menu-item"
            }
            disabled={disabled}
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
          {/*
           * A REAL SUBMIT that a script INTERCEPTS. It was `type="button"`, so with
           * scripting off there was no path to a first publication at all. Unscripted, the
           * request reaches the server as a plain `publish`, which is the ASK rather than
           * the answer. The ceremony was never the dialog: it is `savePost` refusing an
           * unconfirmed first publication, so a click landing before hydration still cannot
           * publish.
           */}
          <button
            type="submit"
            name="intent"
            value={primary.id}
            className="btn"
            disabled={disabled || busy}
            onClick={(event) => {
              event.preventDefault();
              setCeremony(true);
            }}
          >
            {primary.label}
          </button>
          <PublishCeremony
            open={ceremony}
            onClose={() => setCeremony(false)}
            publishAt={publishAt}
            onPublishAtChange={onPublishAtChange}
          />
        </>
      ) : (
        <>
          <button
            type="submit"
            name="intent"
            value={primary.id}
            className="btn"
            disabled={disabled || busy}
          >
            {busy ? "Saving" : primary.label}
          </button>
          {/*
           * RENDERED ONLY WHERE IT CAN BE OPENED. An unconditional dialog would leave two
           * submits nothing can reach, and they would not be harmless: the reschedule arm
           * sends the in-place save, which on a draft means `draft:false`, so the page would
           * carry a publication nobody can see and the fixture would record it.
           */}
          {state !== "draft" ? (
            <PublishCeremony
              open={ceremony}
              onClose={() => setCeremony(false)}
              publishAt={publishAt}
              onPublishAtChange={onPublishAtChange}
              reschedule
            />
          ) : null}
        </>
      )}
    </div>
  );
}

/**
 * A `<dialog>` for the platform focus trap. It sits INSIDE the editing form and
 * `showModal()` moves an element to the top layer visually without moving it in
 * the DOM, so form association by containment still holds.
 *
 * BOTH SEND THE CONFIRMED INTENT. A closed `<dialog>` still submits the fields it
 * contains, so a confirmation in a hidden input would have to be armed on click;
 * the submitter is the only part of a form that means "this is the control that
 * was pressed".
 *
 * The RESCHEDULE arm sends the ordinary in-place save: a post already public is
 * not publishing for the first time.
 */
function PublishCeremony({
  open,
  onClose,
  publishAt,
  onPublishAtChange,
  reschedule,
}: {
  open: boolean;
  onClose: () => void;
  publishAt: string;
  onPublishAtChange: (value: string) => void;
  reschedule?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [when, setWhen] = useState(() => localInput(publishAt) || soonLocal());
  const intent = reschedule ? "save" : PUBLISH_CONFIRMED_INTENT;

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
          value={intent}
          className="btn"
          onClick={() => onPublishAtChange("")}
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
            value={intent}
            className="btn-ghost"
            onClick={() => onPublishAtChange(iso(when))}
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
