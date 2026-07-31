import { useCallback, useEffect, useRef, useState } from "react";
import { Form, Link } from "react-router";

import {
  bufferDiffers,
  clearAllBuffersFor,
  draftKey,
  readBuffer,
  readForm,
  writeBuffer,
  type DraftBuffer,
} from "~/lib/editor/draft-buffer";
import type { EditorFeedback } from "~/lib/editor/feedback";
import type { PostFields } from "~/lib/editor/frontmatter";
import type { PostState } from "~/lib/editor/publish-transition.mjs";
import { PublishActions } from "./publish-actions";
import { SettingsDrawer } from "./settings-drawer";

/**
 * The three-region post editor: a sticky command bar, a writing canvas, and a
 * settings drawer holding everything that is not writing.
 *
 * The body is still a textarea. CodeMirror, the exact preview and media
 * insertion are the next session; this one is the shell they land in.
 *
 * What has NOT changed is the payload. Every field the checkbox era submitted
 * is still submitted, under the same name, in the same format, to the same
 * action. That is asserted by check:admin-ui against a baseline generated from
 * the editor as it stood before this rewrite, so the claim is a gate rather
 * than a comment.
 */

const TITLE_LIMIT = 70;
const AUTOSAVE_DELAY_MS = 800;
const FORM_ID = "post-editor";

/**
 * Title to slug, matching the shape the save gate accepts and nothing more.
 *
 * Deliberately conservative: it strips rather than transliterates, because a
 * wrong guess at what a non-ASCII character should become lands in a permanent
 * URL. The field stays editable, so anything this gets wrong is one keystroke
 * from being right.
 */
function slugify(title: string) {
  return title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}

export type EditorProblem = {
  message: string;
  field?: string;
  line?: number;
  conflict?: boolean;
};

export function PostEditor({
  fields,
  isNew,
  headSha,
  previewHtml,
  feedback,
  busy,
  state,
  everPublished,
  tagOptions,
  existingSlugs = [],
  historySlot,
  dangerSlot,
}: {
  fields: PostFields;
  isNew: boolean;
  headSha: string;
  previewHtml?: string | null;
  feedback?: EditorFeedback | null;
  busy?: boolean;
  state: PostState;
  everPublished: boolean;
  tagOptions: string[];
  /** Slugs already taken, so the new-post flow can say so before the save does. */
  existingSlugs?: string[];
  historySlot?: React.ReactNode;
  dangerSlot?: React.ReactNode;
}) {
  const [title, setTitle] = useState(fields.title);
  const [slug, setSlug] = useState(fields.slug);
  /**
   * Whether the author has taken the slug over.
   *
   * Until they do, it tracks the title, which is what makes the new-post flow
   * one field instead of two. The moment they type in it, it stops moving:
   * silently rewriting a slug somebody chose, because the title was edited
   * afterwards, would change a URL they had already decided on.
   */
  const [slugPinned, setSlugPinned] = useState(fields.slug !== "");
  const [description, setDescription] = useState(fields.description);
  const [tags, setTags] = useState(fields.tags);
  const [coverSrc, setCoverSrc] = useState(fields.coverSrc);
  const [coverAlt, setCoverAlt] = useState(fields.coverAlt);
  const [publishAt, setPublishAt] = useState(fields.publishAt);
  const [body, setBody] = useState(fields.body);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [offer, setOffer] = useState<DraftBuffer | null>(null);

  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const draftFieldRef = useRef<HTMLInputElement>(null);
  const primaryRef = useRef<HTMLDivElement>(null);
  const autosaveTimer = useRef<number>(0);
  const storageKey = draftKey(fields.slug, headSha);

  /**
   * The crash net. This NEVER commits: the save path is the only writer, and
   * this is a browser-local copy so a closed tab does not cost an afternoon.
   */
  const persist = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    setSavedAt(writeBuffer(storageKey, readForm(form)));
  }, [storageKey]);

  // Offer a recovery only when the buffer says something different from what
  // the server just handed back. Restoring is never automatic: silently
  // replacing committed content with older local text is exactly the surprise
  // this is supposed to prevent.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const stored = readBuffer(storageKey);
    if (!stored) return;
    if (!bufferDiffers(stored, readForm(form))) {
      clearAllBuffersFor(fields.slug);
      return;
    }
    setOffer(stored);
  }, [storageKey, fields.slug]);

  // A save that landed makes every buffer for this post obsolete, including
  // ones written against earlier heads that would otherwise sit there forever.
  useEffect(() => {
    if (!feedback || feedback.state === "failed") return;
    clearAllBuffersFor(fields.slug);
    if (isNew) clearAllBuffersFor("");
    setOffer(null);
    setDirty(false);
  }, [feedback, fields.slug, isNew]);

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  // Cmd+S / Ctrl+S. It clicks the primary button rather than submitting the
  // form directly, because the button's own click handler is what arms the
  // `draft` field for the transition it names. Submitting around it would send
  // whatever the last press happened to leave behind.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      primaryRef.current?.querySelector<HTMLButtonElement>("button.btn")?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const touched = () => {
    setDirty(true);
    window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(persist, AUTOSAVE_DELAY_MS);
  };

  const restore = () => {
    const form = formRef.current;
    if (!form || !offer) return;
    const f = offer.fields;
    if (f.title !== undefined) setTitle(f.title);
    if (f.slug !== undefined) setSlug(f.slug);
    if (f.description !== undefined) setDescription(f.description);
    if (f.tags !== undefined) setTags(f.tags.split(",").map((t) => t.trim()).filter(Boolean));
    if (f.coverSrc !== undefined) setCoverSrc(f.coverSrc);
    if (f.coverAlt !== undefined) setCoverAlt(f.coverAlt);
    if (f.publishAt !== undefined) setPublishAt(f.publishAt);
    if (f.body !== undefined) setBody(f.body);
    const date = form.elements.namedItem("date");
    if (f.date !== undefined && date instanceof HTMLInputElement) date.value = f.date;
    setOffer(null);
    setDirty(true);
  };

  const slugValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
  const slugTaken = isNew && slug !== "" && existingSlugs.includes(slug);
  const slugProblem = slug === "" ? null : !slugValid ? "lowercase kebab-case only" : slugTaken ? "already taken" : null;
  const shortHead = headSha ? headSha.slice(0, 7) : "";

  return (
    <div className="editor-shell">
      <Form
        id={FORM_ID}
        method="post"
        className="editor-form"
        ref={formRef}
        onChange={touched}
        onSubmit={() => setDirty(false)}
      >
        <input type="hidden" name="headSha" value={headSha} />
        <input type="hidden" name="isNew" value={isNew ? "1" : "0"} />
        {/*
          Server-owned, carried through only so a browser save PRESERVES it.
          serializePost writes exactly the keys it is handed, so a value this
          form did not carry would be dropped on the next edit and a published
          post would read as never published. Forging it achieves nothing: the
          save path overwrites it from the committed file.
        */}
        <input type="hidden" name="firstPublished" value={fields.firstPublished} />
        {/*
          The draft flag, and the whole of what replaced the checkbox.

          Rendered ENABLED when the post is currently a draft and DISABLED when
          it is not, which reproduces a checkbox exactly: `draft=on` present, or
          the key absent altogether. Each transition button flips
          `.disabled` in its own onClick, before the submit, through a ref. It
          is deliberately not driven by React state, because a state update
          would not have applied by the time the form serialises.
        */}
        <input
          ref={draftFieldRef}
          type="hidden"
          name="draft"
          value="on"
          // `disabled` has to be a real prop, not something set in an effect,
          // or the server-rendered markup would claim a draft flag the post
          // does not have. React only writes a DOM attribute when the prop
          // CHANGES between renders, and this one is derived from server state,
          // so the imperative flips in PublishActions survive every re-render
          // that typing causes. If it ever does change, that is the server
          // saying so, and being overwritten is correct.
          disabled={!fields.draft}
        />

        {/* ---- Region 1: the command bar ---------------------------------- */}
        <header className="editor-bar">
          <div className="editor-bar-left">
            <Link to="/admin/posts" className="editor-back">
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              Posts
            </Link>
            <span className="editor-identity">
              <span className="editor-identity-title">{title || "Untitled"}</span>
              <span className="status-pill" data-state={state}>
                {state}
              </span>
            </span>
          </div>

          <div className="editor-bar-right">
            {/*
              Dirty state as a first-class element rather than a line of prose
              at the bottom of a form. It is the one thing the author checks
              before closing the tab.
            */}
            <span className={dirty ? "editor-dirty is-dirty" : "editor-dirty"}>
              <span className="editor-dirty-dot" aria-hidden="true" />
              {dirty
                ? savedAt
                  ? "Unsaved changes, kept locally"
                  : "Unsaved changes"
                : feedback && feedback.state !== "failed"
                  ? `Saved ${feedback.sha}`
                  : shortHead
                    ? `Up to date at ${shortHead}`
                    : "Saving unavailable"}
            </span>

            <button
              type="button"
              className="btn-ghost"
              aria-expanded={drawerOpen}
              aria-haspopup="dialog"
              onClick={() => setDrawerOpen(true)}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.3.38.55.67.7H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Settings
            </button>

            {/* Preview stays exactly as it was. The exact-render preview route
                is the next session's work; removing the control now would drop
                an intent the server still serves. */}
            <button
              type="submit"
              name="intent"
              value="preview"
              className="btn-ghost"
              disabled={busy}
            >
              Preview
            </button>

            <div ref={primaryRef} className="editor-primary">
              <PublishActions
                state={state}
                everPublished={everPublished}
                draftFieldRef={draftFieldRef}
                publishAt={publishAt}
                onPublishAtChange={(value) => {
                  setPublishAt(value);
                  setDirty(true);
                }}
                busy={busy}
                disabled={!headSha}
              />
            </div>
          </div>
        </header>

        {/* ---- Region 2: the canvas --------------------------------------- */}
        <div className="editor-canvas">
          <div className="editor-page">
            {!headSha ? (
              <div className="editor-notice" role="alert">
                <strong>Saving unavailable</strong>
                <p>
                  GITHUB_TOKEN is not configured on this Worker, so a save cannot
                  commit. Preview still works.
                </p>
              </div>
            ) : null}

            {/*
              THE FEEDBACK SLOT, unchanged in every guarantee it carried: always
              in the DOM so the live region exists before its content does,
              polite because every message follows a submit the author just
              made, and persistent until the next action.
            */}
            <div className="editor-feedback-slot" role="status" aria-live="polite">
              {feedback ? <FeedbackMessage feedback={feedback} /> : null}
            </div>

            {offer ? (
              <RestoreOffer
                buffer={offer}
                onRestore={restore}
                onDiscard={() => {
                  clearAllBuffersFor(fields.slug);
                  setOffer(null);
                }}
              />
            ) : null}

            <div className="editor-title-row">
              <label className="sr-only" htmlFor="field-title">
                Title
              </label>
              <input
                id="field-title"
                name="title"
                className="editor-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  if (isNew && !slugPinned) setSlug(slugify(event.target.value));
                }}
                placeholder="Untitled"
                required
                autoComplete="off"
              />
              <span className={title.length > TITLE_LIMIT ? "count over" : "count"}>
                {title.length}/{TITLE_LIMIT}
              </span>
            </div>

            {isNew ? (
              <div className="editor-slug-row">
                <label className="field-label" htmlFor="field-slug">
                  Slug
                  {slugProblem ? <span className="count over">{slugProblem}</span> : null}
                </label>
                <div className="editor-slug-input">
                  <span className="muted">/blog/</span>
                  <input
                    id="field-slug"
                    name="slug"
                    value={slug}
                    onChange={(event) => {
                      setSlugPinned(true);
                      setSlug(event.target.value);
                    }}
                    required
                    aria-invalid={slugProblem !== null}
                    aria-describedby={slugProblem ? "slug-problem" : undefined}
                    autoComplete="off"
                  />
                </div>
                {slugProblem ? (
                  <p className="field-alarm" id="slug-problem">
                    {slugTaken
                      ? `A post already lives at /blog/${slug}. Saving would be refused.`
                      : "Lowercase letters, digits and single hyphens."}
                  </p>
                ) : null}
                <span className="field-hint muted">
                  Derived from the title until you change it. Fixed after the
                  first save, because it is the filename and the public URL.
                </span>
              </div>
            ) : null}

            <label className="sr-only" htmlFor="field-body">
              Body, markdown
            </label>
            <textarea
              id="field-body"
              ref={bodyRef}
              name="body"
              className="editor-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              spellCheck
              required
            />
          </div>
        </div>

        {/* ---- Region 3: the settings drawer ------------------------------ */}
        <SettingsDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          formId={FORM_ID}
          slug={slug}
          isNew={isNew}
          description={description}
          onDescriptionChange={(value) => {
            setDescription(value);
            setDirty(true);
          }}
          tags={tags}
          onTagsChange={(value) => {
            setTags(value);
            setDirty(true);
          }}
          tagOptions={tagOptions}
          coverSrc={coverSrc}
          onCoverSrcChange={(value) => {
            setCoverSrc(value);
            setDirty(true);
          }}
          coverAlt={coverAlt}
          onCoverAltChange={(value) => {
            setCoverAlt(value);
            setDirty(true);
          }}
          date={fields.date}
          publishAt={publishAt}
          onPublishAtChange={(value) => {
            setPublishAt(value);
            setDirty(true);
          }}
          historySlot={historySlot}
          dangerSlot={dangerSlot}
        />
      </Form>

      {/*
        Kept as it was, deliberately. Drag-drop, paste-from-clipboard and the
        :::figure scaffold are the next session's work, and dropping the one
        working image path in the meantime would leave the editor unable to
        insert a picture at all for a session. It sits OUTSIDE the editing form
        and contributes nothing to the payload: the file input and the alt input
        carry no `name`, and the button is type="button". It uploads through its
        own fetch to /admin/media, which is unchanged.
      */}
      <ImageUploader
        onInsert={(snippet) => {
          const el = bodyRef.current;
          if (!el) return;
          const at = el.selectionStart ?? body.length;
          setBody(body.slice(0, at) + snippet + body.slice(at));
          setDirty(true);
        }}
      />

      {previewHtml !== undefined && previewHtml !== null ? (
        <section className="editor-preview" aria-label="Preview">
          <h2>Preview</h2>
          <div className="prose" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </section>
      ) : null}
    </div>
  );
}

/**
 * The recovery banner.
 *
 * Both ways out are explicit and neither is the default. An automatic restore
 * would overwrite committed content with older local text; an automatic discard
 * would throw away the thing this exists to save.
 */
function RestoreOffer({
  buffer,
  onRestore,
  onDiscard,
}: {
  buffer: DraftBuffer;
  onRestore: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="editor-feedback" data-tone="warning">
      <svg
        className="editor-feedback-glyph"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
      </svg>
      <div>
        <strong>Unsaved local changes from an earlier session.</strong>
        <p>
          Kept in this browser at {new Date(buffer.at).toLocaleString()}. They
          were never committed.
        </p>
        <p className="editor-restore-actions">
          <button type="button" className="row-action" onClick={onRestore}>
            Restore them
          </button>
          <button type="button" className="row-action" onClick={onDiscard}>
            Discard them
          </button>
        </p>
      </div>
    </div>
  );
}

/**
 * The four things a save can have done, said in words.
 *
 * Every state carries the commit sha, because that is the fact that makes the
 * claim checkable: the author can look the save up in `git log` rather than
 * take the page's word for it. A published state carries the public URL as a
 * real link, so "it is live" can be confirmed in one click instead of trusted.
 */
function FeedbackMessage({ feedback }: { feedback: EditorFeedback }) {
  if (feedback.state === "failed") {
    return (
      <div className="editor-feedback" data-tone="danger">
        <Glyph tone="danger" />
        <div>
          <strong>{feedback.conflict ? "Conflict. Not saved." : "Not saved."}</strong>
          <p>{feedback.message}</p>
        </div>
      </div>
    );
  }

  if (feedback.state === "published-first") {
    return (
      <div className="editor-feedback" data-tone="success" data-ceremony="">
        <Glyph tone="published" />
        <div>
          <strong>Published for the first time.</strong>
          <p>
            Stamped {feedback.at}. Commit {feedback.sha}.
          </p>
          <p>
            Live at{" "}
            <a href={`/blog/${feedback.slug}`} target="_blank" rel="noreferrer">
              /blog/{feedback.slug}
            </a>
          </p>
        </div>
      </div>
    );
  }

  if (feedback.state === "republished") {
    return (
      <div className="editor-feedback" data-tone="success">
        <Glyph tone="published" />
        <div>
          <strong>Republished.</strong>
          <p>
            Public again at{" "}
            <a href={`/blog/${feedback.slug}`} target="_blank" rel="noreferrer">
              /blog/{feedback.slug}
            </a>
            . Commit {feedback.sha}.
          </p>
        </div>
      </div>
    );
  }

  if (feedback.state === "unpublished") {
    return (
      <div className="editor-feedback" data-tone="warning">
        <Glyph tone="warning" />
        <div>
          <strong>Unpublished.</strong>
          <p>
            /blog/{feedback.slug} now returns 404, and the post is out of the
            feed, the sitemap, search and the Ask index. Commit {feedback.sha}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-feedback" data-tone="success">
      <Glyph tone="success" />
      <div>
        <strong>Saved.</strong>
        <p>Commit {feedback.sha}.</p>
      </div>
    </div>
  );
}

/**
 * The non-colour channel. Inline because this repo prefers inline SVG to an
 * icon library, per its bundle-leanness rule.
 */
function Glyph({ tone }: { tone: "success" | "published" | "warning" | "danger" }) {
  const shape =
    tone === "published" ? (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" />
      </>
    ) : tone === "warning" ? (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M6 18 18 6" />
      </>
    ) : tone === "danger" ? (
      <>
        <path d="M12 3 2 20h20L12 3z" />
        <path d="M12 10v4M12 17.5v.01" />
      </>
    ) : (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    );

  return (
    <svg
      className="editor-feedback-glyph"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shape}
    </svg>
  );
}

/**
 * Uploads an image to R2 and hands back a markdown snippet.
 *
 * Unchanged from the checkbox era. Alt text is required at insert time rather
 * than left for later, because an image inserted without it is the one that
 * ships without it.
 */
function ImageUploader({ onInsert }: { onInsert: (snippet: string) => void }) {
  const [alt, setAlt] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage("Choose an image first.");
      return;
    }
    if (!alt.trim()) {
      setMessage("Alt text is required before an image can be inserted.");
      return;
    }
    setMessage("Uploading");

    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/admin/media", { method: "POST", body: form });
    if (!response.ok) {
      setMessage(`Upload failed (${response.status}).`);
      return;
    }
    const { url } = (await response.json()) as { url: string };
    onInsert(`\n![${alt.trim()}](${url})\n`);
    setMessage(`Inserted ${url}`);
    setAlt("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <section className="editor-upload" aria-label="Insert image">
      <h2>Insert image</h2>
      <div className="editor-upload-row">
        <input ref={fileRef} type="file" accept="image/*" aria-label="Image file" />
        <input
          value={alt}
          onChange={(event) => setAlt(event.target.value)}
          placeholder="Alt text (required)"
          aria-label="Alt text"
        />
        <button type="button" className="btn-ghost" onClick={upload}>
          Upload and insert
        </button>
      </div>
      {message ? <p className="muted">{message}</p> : null}
    </section>
  );
}
