import { useEffect, useRef, useState } from "react";

import { MediaPicker } from "./media-picker";
import { OgPreview, SerpPreview, type PreviewPost } from "./social-previews";

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
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Escape and the backdrop both fire `close`, so the parent syncs from the element.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onNativeClose = () => onClose();
    dialog.addEventListener("close", onNativeClose);
    return () => dialog.removeEventListener("close", onNativeClose);
  }, [onClose]);

  const overLimit = description.length > SERP_DESCRIPTION_LIMIT;
  const coverNeedsAlt = coverSrc.trim() !== "" && coverAlt.trim() === "";

  return (
    <dialog ref={ref} className="drawer" aria-labelledby="drawer-title">
      <div className="drawer-head">
        <h2 id="drawer-title">Post settings</h2>
        <button type="button" className="drawer-close" onClick={onClose}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          <span className="sr-only">Close settings</span>
        </button>
      </div>

      <div className="drawer-body">
        <SlugField formId={formId} slug={slug} isNew={isNew} />

        <div className="field">
          <label className="field-label" htmlFor="field-description">
            Description
            <span className={overLimit ? "count over" : "count"}>
              {description.length}/{SERP_DESCRIPTION_LIMIT}
            </span>
          </label>
          <input
            id="field-description"
            form={formId}
            name="description"
            value={description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            required
            autoComplete="off"
            aria-invalid={overLimit}
            aria-describedby={overLimit ? "description-alarm" : undefined}
          />
          {/* Alarms, never blocks: the server gates own validity. */}
          {overLimit ? (
            <p className="field-alarm" id="description-alarm">
              {description.length - SERP_DESCRIPTION_LIMIT} over. Search results
              truncate around {SERP_DESCRIPTION_LIMIT}.
            </p>
          ) : null}
        </div>

        <section className="drawer-section">
          <h3>How this appears</h3>
          <SerpPreview post={previewPost} />
          <OgPreview post={previewPost} />
        </section>

        <TagField
          formId={formId}
          tags={tags}
          onChange={onTagsChange}
          options={tagOptions}
        />

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
          <section className="drawer-section">
            <h3>Preview links</h3>
            {previewLinkSlot}
          </section>
        ) : null}

        {historySlot ? (
          <section className="drawer-section">
            <h3>Version history</h3>
            {historySlot}
          </section>
        ) : null}

        {dangerSlot ? (
          <section className="drawer-section drawer-danger">
            <h3>Danger zone</h3>
            {dangerSlot}
          </section>
        ) : null}
      </div>
    </dialog>
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
  const [copied, setCopied] = useState(false);

  if (isNew) {
    return (
      <p className="field-hint muted">
        The slug is set once, next to the title, and becomes the public URL.
      </p>
    );
  }

  return (
    <div className="field">
      <span className="field-label">URL</span>
      <div className="slug-line">
        <code className="slug-value">/blog/{slug}</code>
        <button
          type="button"
          className="row-action"
          onClick={() => {
            navigator.clipboard?.writeText(`/blog/${slug}`).then(
              () => setCopied(true),
              () => setCopied(false),
            );
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {/* Read-only, not disabled: a disabled field submits nothing, and without the slug every save
          looks like a new post. */}
      <input type="hidden" form={formId} name="slug" value={slug} />
      <span className="field-hint muted">
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
  const listId = "tag-options";

  const add = (raw: string) => {
    const value = raw.trim().toLowerCase();
    if (!value || tags.includes(value)) {
      setEntry("");
      return;
    }
    onChange([...tags, value]);
    setEntry("");
  };

  return (
    <div className="field">
      <span className="field-label" id="tags-label">
        Tags
      </span>
      <ul className="tag-tokens" aria-labelledby="tags-label">
        {tags.map((tag) => (
          <li key={tag}>
            <span className="tag-token">
              {tag}
              <button
                type="button"
                className="tag-token-remove"
                onClick={() => onChange(tags.filter((t) => t !== tag))}
              >
                <span aria-hidden="true">x</span>
                <span className="sr-only">Remove tag {tag}</span>
              </button>
            </span>
          </li>
        ))}
      </ul>
      <input
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
          if (event.key === "Backspace" && entry === "" && tags.length > 0) {
            onChange(tags.slice(0, -1));
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

  return (
    <div className="field">
      <span className="field-label">Cover image</span>

      {src ? (
        <div className="cover-preview">
          <img src={src} alt="" className="cover-thumb" />
          <div className="cover-preview-meta">
            <code>{src}</code>
            <button type="button" className="row-action" onClick={() => onSrcChange("")}>
              Remove
            </button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="row-action"
        aria-expanded={picking}
        onClick={() => setPicking((was) => !was)}
      >
        {src ? "Choose a different image" : "Choose an image"}
      </button>

      {/* Picking pre-fills alt only when the field is empty: an alt already written for this cover
          outranks the stored one. */}
      {picking ? (
        <div className="cover-picker">
          <MediaPicker
            onCancel={() => setPicking(false)}
            onPick={(picked) => {
              onSrcChange(picked.url);
              if (picked.alt && !alt.trim()) onAltChange(picked.alt);
              setPicking(false);
            }}
          />
        </div>
      ) : null}

      <input type="hidden" form={formId} name="coverSrc" value={src} />

      <label className="field-label" htmlFor="field-cover-alt">
        Cover alt text
      </label>
      <input
        id="field-cover-alt"
        form={formId}
        name="coverAlt"
        value={alt}
        onChange={(event) => onAltChange(event.target.value)}
        autoComplete="off"
        aria-invalid={needsAlt}
        aria-describedby={needsAlt ? "cover-alt-alarm" : undefined}
      />
      {needsAlt ? (
        <p className="field-alarm" id="cover-alt-alarm">
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
  const scheduled = publishAt.trim() !== "";

  return (
    <div className="field">
      <label className="field-label" htmlFor="field-date">
        Post date
      </label>
      <input id="field-date" form={formId} name="date" type="date" defaultValue={date} required />

      <span className="field-label">Publication</span>
      {/* Unnamed on purpose: a control with no `name` is never submitted, so the toggle stays out
          of the payload. */}
      <label className="schedule-option">
        <input
          type="checkbox"
          checked={scheduled}
          onChange={(event) =>
            onPublishAtChange(event.target.checked ? toIso(defaultScheduleLocal()) : "")
          }
        />
        <span>Hold until a set time, rather than going live on publish</span>
      </label>

      {scheduled ? (
        <>
          <label className="field-label" htmlFor="field-schedule">
            Goes live at (your local time)
          </label>
          <input
            id="field-schedule"
            type="datetime-local"
            value={toLocalInput(publishAt)}
            onChange={(event) => onPublishAtChange(toIso(event.target.value))}
          />
          <span className="field-hint muted">
            Stored as {publishAt || "an invalid date"} (UTC).
          </span>
        </>
      ) : null}

      <input type="hidden" form={formId} name="publishAt" value={publishAt} />
    </div>
  );
}

/** `datetime-local` wants `YYYY-MM-DDTHH:mm` in LOCAL time. */
function toLocalInput(iso: string) {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  const local = new Date(at - new Date(at).getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toIso(local: string) {
  if (!local) return "";
  const at = Date.parse(local);
  return Number.isNaN(at) ? "" : new Date(at).toISOString();
}

function defaultScheduleLocal() {
  const soon = new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(soon.getTime() - soon.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
