import { useEffect, useRef, useState } from "react";

import {
  FIRST_PUBLICATION_NOTE,
  PUBLISH_CONFIRMED_INTENT,
  transitionsFor,
  type PostState,
} from "~/lib/editor/publish-transition.mjs";
import { anHourFromNowLocal, toIso, toLocalInput } from "~/lib/editor/datetime-local";
import { OverflowMenu } from "./overflow-menu";
import { useDialogOpen } from "./use-dialog-open";

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
  const rootRef = useRef<HTMLDivElement>(null);
  /* Opened from the More menu, whose item is hidden once the menu closes: the dialog would hand
     focus back to it and lose it, so it goes to the menu's own button instead. */
  const fromMenu = useRef(false);
  const closeCeremony = () => {
    setCeremony(false);
    if (!fromMenu.current) return;
    fromMenu.current = false;
    rootRef.current?.querySelector<HTMLElement>("summary")?.focus();
  };

  return (
    <div className="publish-actions" ref={rootRef}>
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
            onClick={() => {
              fromMenu.current = true;
              setCeremony(true);
            }}
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
            onClose={closeCeremony}
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
          {/* Only where it can be opened: its unreachable reschedule submit would send `draft:false`. */}
          {state !== "draft" ? (
            <PublishCeremony
              open={ceremony}
              onClose={closeCeremony}
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
  const whenRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const [when, setWhen] = useState(() => toLocalInput(publishAt) || anHourFromNowLocal());
  const intent = reschedule ? "save" : PUBLISH_CONFIRMED_INTENT;
  /* An empty, invalid or past time would publish now: Schedule refuses all three. */
  const scheduleAt = toIso(when);
  const past = scheduleAt !== "" && Date.parse(scheduleAt) <= Date.now();
  const problem =
    scheduleAt === ""
      ? "Pick a date and time to schedule."
      : past
        ? "Pick a time in the future to schedule."
        : null;

  useDialogOpen(ref, open, onClose);

  /* After showModal, which focuses the first control, Publish now: the first focus goes to the
     least final choice instead, the time when rescheduling and Cancel when publishing. */
  useEffect(() => {
    if (open) (reschedule ? whenRef : cancelRef).current?.focus();
  }, [open, reschedule]);

  return (
    <dialog ref={ref} className="ceremony" aria-labelledby="ceremony-title">
      <h2 id="ceremony-title">
        {reschedule ? "When does this go live?" : "Publish this post"}
      </h2>
      {reschedule ? null : <p>{FIRST_PUBLICATION_NOTE}</p>}

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
            Or hold until (your local time)
          </label>
          <input
            ref={whenRef}
            id="ceremony-when"
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
            aria-invalid={problem !== null}
            aria-describedby={problem ? "ceremony-when-problem" : undefined}
          />
          <button
            type="submit"
            name="intent"
            value={intent}
            className="btn-ghost"
            disabled={problem !== null}
            onClick={(event) => {
              if (problem !== null) {
                event.preventDefault();
                return;
              }
              onPublishAtChange(scheduleAt);
            }}
          >
            Schedule
          </button>
          {problem ? (
            <p className="field-alarm" id="ceremony-when-problem">
              {problem}
            </p>
          ) : null}
        </div>
      </div>

      {/* Closes the element, whose close event reaches `onClose`: focus is moved once the dialog
          has let go of it, not while it is still modal. */}
      <button
        ref={cancelRef}
        type="button"
        className="btn-ghost"
        onClick={() => ref.current?.close()}
      >
        Cancel
      </button>
    </dialog>
  );
}
