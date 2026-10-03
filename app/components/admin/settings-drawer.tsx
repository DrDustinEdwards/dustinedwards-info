import { useEffect, useRef, useState } from "react";
import { Dialog, DialogBody, DialogHeader, DialogTitle } from "capsomer/react/dialog";

import { CopyTextButton } from "./copy-button";
import { MediaPicker } from "./media-picker";
import { OgPreview, SerpPreview, type PreviewPost } from "./social-previews";

import { anHourFromNowLocal, toIso, toLocalInput } from "~/lib/editor/datetime-local";
import { SERP_DESCRIPTION_LIMIT } from "~/lib/seo";

// Each control carries form={formId}: the editing form is outside the dialog, and association is by
// attribute. A closed dialog is display:none, which does not stop its fields submitting.
export function SettingsDrawer({
  open,
  onClose,
  formId,
  slug,
  isNew,
  description,
  onDescriptionChange,
  tags,
  onTagsChange,
  tagOptions,
  coverSrc,
  onCoverSrcChange,
  coverAlt,
  onCoverAltChange,
  date,
  publishAt,
  onPublishAtChange,
  previewPost,
  previewLinkSlot,
  historySlot,
  dangerSlot,
}: {
  open: boolean;
  onClose: () => void;
  formId: string;
  slug: string;
  isNew: boolean;
  description: string;
  onDescriptionChange: (value: string) => void;
  tags: string[];
  onTagsChange: (value: string[]) => void;
  tagOptions: string[];
  coverSrc: string;
  onCoverSrcChange: (value: string) => void;
  coverAlt: string;
  onCoverAltChange: (value: string) => void;
  date: string;
  publishAt: string;
  onPublishAtChange: (value: string) => void;
  previewPost: PreviewPost;
  /** Absent on a published post, so there is nothing to press rather than a disabled button that reads as an offer. */
  previewLinkSlot?: React.ReactNode;
  historySlot?: React.ReactNode;
  dangerSlot?: React.ReactNode;
}) {
  const overLimit = description.length > SERP_DESCRIPTION_LIMIT;
  const coverNeedsAlt = coverSrc.trim() !== "" && coverAlt.trim() === "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      placement="right"
      size="md"
      aria-labelledby="drawer-title"
    >
      <DialogHeader divider>
        <DialogTitle id="drawer-title">Post settings</DialogTitle>
      </DialogHeader>

      <DialogBody>
        <div className="app-form">
          <SlugField formId={formId} slug={slug} isNew={isNew} />

          <div className="cap-field">
            <label className="cap-field-label" htmlFor="field-description">
              Description
              {/* Out of the name, into the description: the count is a hint, not what the field is. */}
              <span id="description-count" aria-hidden="true">
                {" "}
                {description.length}/{SERP_DESCRIPTION_LIMIT}
              </span>
            </label>
            <input
              id="field-description"
              className="cap-input"
              form={formId}
              name="description"
              value={description}
              onChange={(event) => onDescriptionChange(event.target.value)}
              required
              autoComplete="off"
              /* No aria-invalid: the limit is advisory, and the save accepts a long description. */
              aria-describedby={overLimit ? "description-count description-alarm" : "description-count"}
            />
            {/* Alarms, never blocks: the server gates own validity. */}
            {overLimit ? (
              <p className="cap-field-error" id="description-alarm">
                {description.length - SERP_DESCRIPTION_LIMIT} over. Search results
                truncate around {SERP_DESCRIPTION_LIMIT}.
              </p>
            ) : null}
          </div>

          <section className="app-form" aria-labelledby="drawer-appears">
            <h3 className="cap-field-label" id="drawer-appears">
              How this appears
            </h3>
            <SerpPreview post={previewPost} />
            <OgPreview post={previewPost} />
          </section>

          <TagField formId={formId} tags={tags} onChange={onTagsChange} options={tagOptions} />

          <CoverField
            formId={formId}
            src={coverSrc}
            onSrcChange={onCoverSrcChange}
            alt={coverAlt}
            onAltChange={onCoverAltChange}
            needsAlt={coverNeedsAlt}
          />

          <ScheduleField
            formId={formId}
            date={date}
            publishAt={publishAt}
            onPublishAtChange={onPublishAtChange}
          />

          {previewLinkSlot ? (
            <section className="app-form" aria-labelledby="drawer-preview-links">
              <h3 className="cap-field-label" id="drawer-preview-links">
                Preview links
              </h3>
              {previewLinkSlot}
            </section>
          ) : null}

          {historySlot ? (
            <section className="app-form" aria-labelledby="drawer-history">
              <h3 className="cap-field-label" id="drawer-history">
                Version history
              </h3>
              {historySlot}
            </section>
          ) : null}

          {dangerSlot ? (
            <section className="app-form" aria-labelledby="drawer-danger">
              <h3 className="cap-field-label" id="drawer-danger">
                Danger zone
              </h3>
              {dangerSlot}
            </section>
          ) : null}
        </div>
      </DialogBody>
    </Dialog>
  );
}

// Only the new-post flow gets an input: changing the slug later would be a rename plus a redirect.
function SlugField({
  formId,
  slug,
  isNew,
}: {
  formId: string;
  slug: string;
  isNew: boolean;
}) {
  if (isNew) {
    return (
      <p className="cap-field-help">
        The slug is set once, next to the title, and becomes the public URL.
      </p>
    );
  }

  return (
    <div className="cap-field">
      <span className="cap-field-label">URL</span>
      <div className="app-actions">
        <code className="cap-mono">/writing/{slug}</code>
        <CopyTextButton
          value={`/writing/${slug}`}
          label="Copy URL"
          name={`/writing/${slug}`}
          subject={`the URL /writing/${slug}`}
        />
      </div>
      {/* Read-only, not disabled: a disabled field submits nothing, and without the slug every save
          looks like a new post. */}
      <input type="hidden" form={formId} name="slug" value={slug} />
      <span className="cap-field-help">
        Fixed after the first save. It is the filename and the public URL.
      </span>
    </div>
  );
}

function TagField({
  formId,
  tags,
  onChange,
  options,
}: {
  formId: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  options: string[];
}) {
  const [entry, setEntry] = useState("");
  // What the last add or remove did, for the status region: a token appearing is silent otherwise.
  const [note, setNote] = useState("");
  const entryRef = useRef<HTMLInputElement>(null);
  const listId = "tag-options";

  const add = (raw: string) => {
    const value = raw.trim().toLowerCase();
    if (!value || tags.includes(value)) {
      setEntry("");
      return;
    }
    onChange([...tags, value]);
    setNote(`Added tag ${value}.`);
    setEntry("");
  };

  const remove = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
    setNote(`Removed tag ${tag}.`);
  };

  return (
    <div className="cap-field">
      <span className="cap-field-label" id="tags-label">
        Tags
      </span>
      <ul className="app-pills" aria-labelledby="tags-label">
        {tags.map((tag) => (
          <li key={tag}>
            <span className="cap-pill" data-variant="outline">
              {tag}
              <button
                type="button"
                className="cap-link-btn"
                onClick={() => {
                  remove(tag);
                  // The button goes with its token, so focus moves to the field rather than to the page.
                  entryRef.current?.focus();
                }}
              >
                <span aria-hidden="true">x</span>
                <span className="cap-sr-only">Remove tag {tag}</span>
              </button>
            </span>
          </li>
        ))}
      </ul>
      <input
        ref={entryRef}
        className="cap-input"
        value={entry}
        list={listId}
        aria-label="Add a tag"
        placeholder="Add a tag"
        autoComplete="off"
        onChange={(event) => {
          const value = event.target.value;
          if (value.endsWith(",")) add(value.slice(0, -1));
          else setEntry(value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            add(entry);
          }
          const last = tags[tags.length - 1];
          if (event.key === "Backspace" && entry === "" && last !== undefined) {
            remove(last);
          }
        }}
        onBlur={() => add(entry)}
      />
      <datalist id={listId}>
        {options
          .filter((option) => !tags.includes(option))
          .map((option) => (
            <option key={option} value={option} />
          ))}
      </datalist>
      <input type="hidden" form={formId} name="tags" value={tags.join(", ")} />
      <p className="cap-sr-only" role="status">
        {note}
      </p>
    </div>
  );
}

function CoverField({
  formId,
  src,
  onSrcChange,
  alt,
  onAltChange,
  needsAlt,
}: {
  formId: string;
  src: string;
  onSrcChange: (value: string) => void;
  alt: string;
  onAltChange: (value: string) => void;
  needsAlt: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const chooseRef = useRef<HTMLButtonElement>(null);
  // Picking or cancelling unmounts the picker and the focused control with it, so focus goes back
  // to the button that opened it.
  const closePicker = () => {
    setPicking(false);
    chooseRef.current?.focus();
  };

  return (
    <div className="cap-field">
      <span className="cap-field-label">Cover image</span>

      {src ? (
        <div className="app-actions">
          <img src={src} alt="" className="app-thumb" width={96} height={54} />
          <code className="cap-mono">{src}</code>
          <button
            type="button"
            className="cap-btn"
            data-size="sm"
            data-variant="quiet"
            onClick={() => onSrcChange("")}
          >
            Remove
          </button>
        </div>
      ) : null}

      <div>
        <button
          ref={chooseRef}
          type="button"
          className="cap-btn"
          data-size="sm"
          aria-expanded={picking}
          onClick={() => setPicking((was) => !was)}
        >
          {src ? "Choose a different image" : "Choose an image"}
        </button>
      </div>

      {/* Picking pre-fills alt only when the field is empty: an alt already written for this cover
          outranks the stored one. */}
      {picking ? (
        <MediaPicker
          onCancel={closePicker}
          onPick={(picked) => {
            onSrcChange(picked.url);
            if (picked.alt && !alt.trim()) onAltChange(picked.alt);
            closePicker();
          }}
        />
      ) : null}

      <input type="hidden" form={formId} name="coverSrc" value={src} />

      <label className="cap-field-label" htmlFor="field-cover-alt">
        Cover alt text
      </label>
      <input
        id="field-cover-alt"
        className="cap-input"
        form={formId}
        name="coverAlt"
        value={alt}
        onChange={(event) => onAltChange(event.target.value)}
        autoComplete="off"
        aria-invalid={needsAlt}
        aria-describedby={needsAlt ? "cover-alt-alarm" : undefined}
      />
      {needsAlt ? (
        <p className="cap-field-error" id="cover-alt-alarm">
          A cover without alt text will be refused by the save gate.
        </p>
      ) : null}
    </div>
  );
}

// The visible control is unnamed so it stays out of the payload; the hidden publishAt carries the ISO.
// With scripting off a schedule cannot be changed, but the hidden field preserves an existing one.
function ScheduleField({
  formId,
  date,
  publishAt,
  onPublishAtChange,
}: {
  formId: string;
  date: string;
  publishAt: string;
  onPublishAtChange: (value: string) => void;
}) {
  /*
   * The hold and the typed time are kept apart from `publishAt`: clearing the field used to set it
   * to "", which silently dropped the hold. Now only the checkbox drops it, and a cleared or invalid
   * time leaves the last valid one in place and says so.
   */
  const [holding, setHolding] = useState(publishAt.trim() !== "");
  const [raw, setRaw] = useState(() => toLocalInput(publishAt));
  const rawValid = toIso(raw) !== "";

  // A change from elsewhere (the publish dialog) wins; a cleared field leaves `publishAt` unchanged, so this does not run.
  useEffect(() => {
    setHolding(publishAt.trim() !== "");
    setRaw((current) => (toIso(current) === publishAt ? current : toLocalInput(publishAt)));
  }, [publishAt]);

  return (
    <div className="cap-field">
      <label className="cap-field-label" htmlFor="field-date">
        Post date
      </label>
      <input
        id="field-date"
        className="cap-input"
        form={formId}
        name="date"
        type="date"
        defaultValue={date}
        required
      />

      <span className="cap-field-label">Publication</span>
      {/* Unnamed on purpose: a control with no `name` is never submitted, so the toggle stays out
          of the payload. */}
      <label className="cap-check">
        <input
          type="checkbox"
          checked={holding}
          onChange={(event) => {
            if (event.target.checked) {
              const local = anHourFromNowLocal();
              setRaw(local);
              setHolding(true);
              onPublishAtChange(toIso(local));
            } else {
              setHolding(false);
              onPublishAtChange("");
            }
          }}
        />
        Hold until a set time, rather than going live on publish
      </label>

      {holding ? (
        <>
          <label className="cap-field-label" htmlFor="field-schedule">
            Goes live at (your local time)
          </label>
          <input
            id="field-schedule"
            className="cap-input"
            type="datetime-local"
            value={raw}
            onChange={(event) => {
              setRaw(event.target.value);
              const next = toIso(event.target.value);
              if (next) onPublishAtChange(next);
            }}
            aria-invalid={!rawValid}
            aria-describedby={rawValid ? undefined : "field-schedule-problem"}
          />
          {rawValid ? (
            <span className="cap-field-help">Stored as {publishAt} (UTC).</span>
          ) : (
            <p className="cap-field-error" id="field-schedule-problem">
              Not a valid date and time. Saving keeps the last valid one, {publishAt} (UTC).
            </p>
          )}
        </>
      ) : null}

      <input type="hidden" form={formId} name="publishAt" value={publishAt} />
    </div>
  );
}
