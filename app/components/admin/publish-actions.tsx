import { useRef, useState } from "react";

import {
  FIRST_PUBLICATION_NOTE,
  PUBLISH_CONFIRMED_INTENT,
  transitionsFor,
  type PostState,
} from "~/lib/editor/publish-transition.mjs";
import { anHourFromNowLocal, toIso, toLocalInput } from "~/lib/editor/datetime-local";
import { Dialog, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "capsomer/react/dialog";

import { OverflowMenu } from "./overflow-menu";

export function PublishActions({
  formId,
  state,
  everPublished,
  publishAt,
  onPublishAtChange,
  busy,
  disabled,
}: {
  /** The editing form, which these buttons sit outside of. */
  formId: string;
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
    rootRef.current?.querySelector<HTMLElement>("button[popovertarget]")?.focus();
  };

  return (
    <div className="app-actions" ref={rootRef}>
      {secondary.length > 0 || state !== "draft" ? (
        <OverflowMenu label="More">
          {secondary.map((transition) => (
            <button
              key={transition.id}
              type="submit"
              form={formId}
              name="intent"
              value={transition.id}
              data-menu-item
              className="cap-option"
              data-tone={transition.danger ? "crit" : undefined}
              disabled={disabled || busy}
            >
              <span className="cap-option-label">{transition.label}</span>
              <span className="cap-option-hint">
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
              className="cap-option"
              onClick={() => {
                fromMenu.current = true;
                setCeremony(true);
              }}
            >
              <span className="cap-option-label">Reschedule</span>
              <span className="cap-option-hint">Change when this goes live.</span>
            </button>
          ) : null}
        </OverflowMenu>
      ) : null}

      {primary.ceremony ? (
        <>
          {/* A real submit, so it works without script. `savePost` refuses an unconfirmed first
              publication, so a click before hydration still cannot publish. */}
          <button
            type="submit"
            form={formId}
            name="intent"
            value={primary.id}
            className="cap-btn"
            data-variant="primary"
            disabled={disabled || busy}
            onClick={(event) => {
              event.preventDefault();
              setCeremony(true);
            }}
          >
            {primary.label}
          </button>
          <PublishCeremony
            formId={formId}
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
            form={formId}
            name="intent"
            value={primary.id}
            className="cap-btn"
            data-variant="primary"
            disabled={disabled || busy}
          >
            {busy ? "Saving" : primary.label}
          </button>
          {/* Only where it can be opened: its unreachable reschedule submit would send `draft:false`. */}
          {state !== "draft" ? (
            <PublishCeremony
              formId={formId}
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

// Both buttons send the confirmed intent as the submitter, by `form`, since the dialog sits outside the
// editing form; a closed dialog's fields are not submitted, so nothing here travels unless pressed.
function PublishCeremony({
  formId,
  open,
  onClose,
  publishAt,
  onPublishAtChange,
  reschedule,
}: {
  formId: string;
  open: boolean;
  onClose: () => void;
  publishAt: string;
  onPublishAtChange: (value: string) => void;
  reschedule?: boolean;
}) {
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      placement="center"
      size="md"
      aria-labelledby="ceremony-title"
      /* The first focus goes to the least final choice: the time when rescheduling, Cancel when publishing. */
      initialFocus={reschedule ? whenRef : cancelRef}
    >
      <DialogHeader>
        <DialogTitle id="ceremony-title">
          {reschedule ? "When does this go live?" : "Publish this post"}
        </DialogTitle>
        {reschedule ? null : <DialogDescription>{FIRST_PUBLICATION_NOTE}</DialogDescription>}
      </DialogHeader>

      <DialogBody>
        <div className="app-form">
          <div>
            <button
              type="submit"
              form={formId}
              name="intent"
              value={intent}
              className="cap-btn"
              data-variant="primary"
              onClick={() => onPublishAtChange("")}
            >
              Publish now
            </button>
          </div>

          <div className="cap-field" data-invalid={problem ? "" : undefined}>
            <label className="cap-field-label" htmlFor="ceremony-when">
              Or hold until (your local time)
            </label>
            <input
              ref={whenRef}
              id="ceremony-when"
              className="cap-input"
              type="datetime-local"
              value={when}
              onChange={(event) => setWhen(event.target.value)}
              aria-invalid={problem !== null}
              aria-describedby={problem ? "ceremony-when-problem" : undefined}
            />
            {problem ? (
              <p className="cap-field-error" id="ceremony-when-problem">
                {problem}
              </p>
            ) : null}
            <div>
              <button
                type="submit"
                form={formId}
                name="intent"
                value={intent}
                className="cap-btn"
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
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogFooter>
        <button type="button" className="cap-btn" data-cap-part="cancel" ref={cancelRef}>
          Cancel
        </button>
      </DialogFooter>
    </Dialog>
  );
}
