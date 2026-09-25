import { useEffect, useRef, useState } from "react";

import {
  PUBLISH_CONFIRMED_INTENT,
  transitionsFor,
  type PostState,
} from "~/lib/editor/publish-transition.mjs";
import { OverflowMenu } from "./overflow-menu";

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
            disabled={disabled || busy}
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
          {/* A real submit, so it works without script. `savePost` refuses an unconfirmed first
              publication, so a click before hydration still cannot publish. */}
          <button
            type="submit"
            name="intent"
            value={primary.id}
            className="btn"
            disabled={disabled}
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
            disabled={disabled}
          >
            {busy ? "Saving" : primary.label}
          </button>
          {/* Only where it can be opened: its unreachable reschedule submit would send `draft:false`. */}
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

// Inside the form on purpose: showModal() moves it to the top layer without moving it in the DOM.
// Both buttons send the confirmed intent as the submitter, since a closed dialog still submits its fields.
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
  /* An empty or invalid time would send no publish time, which publishes now: Schedule refuses it. */
  const scheduleAt = iso(when);

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
            aria-invalid={scheduleAt === ""}
            aria-describedby={scheduleAt === "" ? "ceremony-when-problem" : undefined}
          />
          <button
            type="submit"
            name="intent"
            value={intent}
            className="btn-ghost"
            disabled={scheduleAt === ""}
            onClick={(event) => {
              if (scheduleAt === "") {
                event.preventDefault();
                return;
              }
              onPublishAtChange(scheduleAt);
            }}
          >
            Schedule
          </button>
          {scheduleAt === "" ? (
            <p className="field-alarm" id="ceremony-when-problem">
              Pick a date and time to schedule.
            </p>
          ) : null}
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
