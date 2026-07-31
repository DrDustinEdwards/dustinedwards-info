import { useEffect, useRef, useState } from "react";
import { useFetcher } from "react-router";

const DESCRIPTION_LIMIT = 160;

/**
 * Everything about a post that is not the writing.
 *
 * Built on a real `<dialog>` opened with `showModal()`, which is the same
 * choice the command palette made and for the same reasons: the focus trap,
 * the Escape handling and the focus return are the platform's, not a
 * hand-rolled keydown handler that will be subtly wrong in a way nobody
 * notices. CLAUDE.md records that decision for the palette; this inherits it.
 *
 * The controls inside it belong to the EDITING form, which is outside the
 * dialog, so every one of them carries `form={formId}`. That is what lets the
 * drawer be a modal and still be part of the same submission: form association
 * in HTML is by attribute, not by containment. A closed dialog is
 * `display: none`, and display has no bearing on whether a control is
 * submitted, so the drawer's fields ride along whether or not it was ever
 * opened. Only `disabled` removes a field, and nothing here is disabled.
 */
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

  // Escape and the backdrop both fire `close`, so the parent's state is synced
  // from the element rather than from every path that can shut it.
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onNativeClose = () => onClose();
    dialog.addEventListener("close", onNativeClose);
    return () => dialog.removeEventListener("close", onNativeClose);
  }, [onClose]);

  const overLimit = description.length > DESCRIPTION_LIMIT;
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
              {description.length}/{DESCRIPTION_LIMIT}
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
          {/* Alarms, never blocks. The server gates own validity; this only
              makes the author aware before they hit one. */}
          {overLimit ? (
            <p className="field-alarm" id="description-alarm">
              {description.length - DESCRIPTION_LIMIT} over. Search results
              truncate around {DESCRIPTION_LIMIT}.
            </p>
          ) : null}
        </div>

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

/**
 * The slug, read-only once the post exists.
 *
 * It is the public URL and the filename, so changing it after the first save
 * would be a rename plus a redirect, which is not what a text input implies.
 * On an existing post it renders as a URL line with a copy button; only the
 * new-post flow gets an input, and that lives in the canvas rather than here.
 */
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
    // The new-post route renders the editable slug beside the title, where the
    // author is actually looking. Nothing to show here but the rule.
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
      {/* Still submitted, because the save path reads it. Read-only rather than
          disabled: a disabled field submits nothing, and dropping the slug
          would make every save look like a new post. */}
      <input type="hidden" form={formId} name="slug" value={slug} />
      <span className="field-hint muted">
        Fixed after the first save. It is the filename and the public URL.
      </span>
    </div>
  );
}

/**
 * Tags as chips, with autocomplete over the tags already used on the site.
 *
 * The submitted field is unchanged: one `tags` input holding a comma separated
 * list, exactly what `parseTags` has always split. The chips are a view of that
 * string, so the payload cannot drift from what the checkbox era sent.
 */
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
          // Picking from the datalist fires change with the full value, and so
          // does typing a comma. Both mean "commit this one".
          if (value.endsWith(",")) add(value.slice(0, -1));
          else setEntry(value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            // Enter in a text input submits the form. Here it means "finish
            // this tag", so the submit is suppressed.
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
      {/* The field the server reads. Unchanged in name and format. */}
      <input type="hidden" form={formId} name="tags" value={tags.join(", ")} />
    </div>
  );
}

/** Cover image, picked from what is already in the bucket. */
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
  const media = useFetcher<{ objects: Array<{ key: string; url: string }>; truncated: boolean }>();
  const [picking, setPicking] = useState(false);

  // Loaded on demand, so the editor's first paint never waits on R2.
  useEffect(() => {
    if (picking && media.state === "idle" && !media.data) media.load("/admin/media");
  }, [picking, media]);

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

      {picking ? (
        <div className="cover-picker">
          {media.state === "loading" ? <p className="muted">Loading images.</p> : null}
          {media.data ? (
            media.data.objects.length === 0 ? (
              <p className="muted">Nothing in the bucket yet.</p>
            ) : (
              <>
                <ul className="cover-grid">
                  {media.data.objects.map((object) => (
                    <li key={object.key}>
                      <button
                        type="button"
                        className="cover-option"
                        aria-pressed={src === object.url}
                        onClick={() => {
                          onSrcChange(object.url);
                          setPicking(false);
                        }}
                      >
                        <img src={object.url} alt="" loading="lazy" />
                        <span className="sr-only">{object.key}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {/* Never a silent cap. A picker that quietly shows page one of
                    a longer list is the Ask-prune bug in another costume. */}
                {media.data.truncated ? (
                  <p className="muted">
                    Showing the first 200 objects. Older images are not listed.
                  </p>
                ) : null}
              </>
            )
          ) : null}
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

/**
 * Publish date and schedule.
 *
 * The raw ISO text input is gone. What replaced it writes the SAME field in the
 * SAME format: a `datetime-local` control the author touches, and a hidden
 * `publishAt` carrying the ISO string the server has always received. The
 * visible control is deliberately unnamed so it cannot join the payload.
 *
 * The cost, stated rather than hidden: with scripting off the visible control
 * cannot update the hidden one, so a schedule cannot be CHANGED without script.
 * The hidden field still renders with the committed value, so an existing
 * schedule is preserved rather than silently cleared, which is the failure that
 * would actually matter.
 */
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
      {/*
        A single UNNAMED checkbox, and both halves of that matter.
        A control with no `name` is never submitted, which keeps the schedule
        toggle out of the payload entirely: `publishAt` below is the only field
        the server sees, exactly as before. It was briefly a radio pair, and
        check:admin-ui caught that immediately, because a radio group needs a
        shared `name` to be a group and that name went straight into the
        request as `schedule-mode=on`.
      */}
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

      {/* The field the server reads, in the format it has always read. */}
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
