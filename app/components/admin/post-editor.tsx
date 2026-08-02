import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { Form, Link } from "react-router";

import {
  bufferDiffers,
  clearAllBuffersFor,
  draftKey,
  purgeLegacyBuffers,
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

/**
 * CodeMirror, in its own chunk.
 *
 * Ruling 6: editor machinery never reaches a public-plane bundle. This dynamic
 * import is the chunk boundary that makes that true, and the build output is
 * what proves it rather than this comment. It also means the editor's first
 * paint is the textarea below, which is what a reader with no script keeps.
 */
const MarkdownEditor = lazy(() => import("./markdown-editor"));

/** Type-only, so importing it does not pull the CodeMirror chunk in eagerly. */
type LinkTarget = import("./markdown-editor").LinkTarget;

const TITLE_LIMIT = 70;
const AUTOSAVE_DELAY_MS = 800;
const PREVIEW_DELAY_MS = 600;
const FORM_ID = "post-editor";
const LAYOUT_KEY = "post-editor:layout";

/** @see LAYOUT_KEY. Remembered per browser, never on the server. */
type Layout = "write" | "split" | "preview";

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
  linkTargets = [],
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
  /** The site's own posts, for the body editor's Cmd+K link search. */
  linkTargets?: LinkTarget[];
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
  /** True once CodeMirror has mounted and taken over from the textarea. */
  const [richBody, setRichBody] = useState(false);
  const [layout, setLayout] = useState<Layout>("write");
  const [preview, setPreview] = useState<{ html: string } | { error: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const draftFieldRef = useRef<HTMLInputElement>(null);
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

  // Housekeeping. Buffers written under the pre-Session-2 key scheme can never
  // be matched by a lookup, so without this they sit in storage forever.
  useEffect(() => {
    purgeLegacyBuffers();
  }, []);

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

  // The layout choice is a browser preference, not a fact about the post, so it
  // lives in localStorage and never reaches the server. Read after mount rather
  // than during render, so the server and the first client paint agree.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LAYOUT_KEY);
      if (stored === "write" || stored === "split" || stored === "preview") setLayout(stored);
    } catch {
      // Storage disabled. The editor opens in Write, which is the default anyway.
    }
  }, []);

  const chooseLayout = (next: Layout) => {
    setLayout(next);
    try {
      window.localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // As above. The choice still applies to this session.
    }
  };

  /**
   * The exact preview, debounced.
   *
   * It posts the body to an admin-only route that renders it through
   * `pipeline.mjs`, the module the build and the Worker import, and returns the
   * fragment unmodified. So this is not an approximation of the published page;
   * it is the published markup, produced by the one renderer.
   *
   * A sequence number guards the response, because a fast typist can have two
   * renders in flight and the slower one can land last. Same trap the command
   * palette recorded: a fetch that resolves after its context has moved on will
   * happily paint a stale answer.
   */
  const previewSeq = useRef(0);
  useEffect(() => {
    if (layout === "write") return;
    const seq = (previewSeq.current += 1);
    setPreviewing(true);
    const timer = window.setTimeout(async () => {
      const form = new FormData();
      form.set("body", body);
      form.set("slug", fields.slug || slug);
      try {
        const response = await fetch("/admin/preview", { method: "POST", body: form });
        const result = (await response.json()) as { html?: string; error?: string };
        if (seq !== previewSeq.current) return;
        setPreview(result.error ? { error: result.error } : { html: result.html ?? "" });
      } catch (error) {
        if (seq !== previewSeq.current) return;
        setPreview({ error: error instanceof Error ? error.message : String(error) });
      } finally {
        if (seq === previewSeq.current) setPreviewing(false);
      }
    }, PREVIEW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [body, layout, fields.slug, slug]);

  /**
   * Cmd+S / Ctrl+S. It SAVES, and it can never do anything else.
   *
   * It used to click the primary button, on the reasoning that the button's own
   * handler arms the `draft` field for the transition it names. That was wrong
   * in the one case that mattered: on a post that has never been published the
   * primary button is the publish CEREMONY trigger, so the universal save
   * shortcut opened the publish dialog, one Return away from making a draft
   * public. Found on the live deploy 2026-08-01.
   *
   * Now it submits the form directly and arms `draft` to the post's CURRENT
   * committed state, so a save preserves publication status rather than
   * changing it. `requestSubmit()` with no submitter sends no `intent` at all,
   * and `handleEditorAction` already defaults a missing intent to "save", so
   * the payload is the same one the Save control sends.
   *
   * The ceremony is now reachable only by pointer or by focusing its trigger
   * and activating it deliberately. No keyboard shortcut opens it.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      const form = formRef.current;
      if (!form) return;
      const draftField = draftFieldRef.current;
      if (draftField) draftField.disabled = !fields.draft;
      form.requestSubmit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fields.draft]);

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
          <div className="editor-bar-group editor-bar-left">
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

          {/*
            CENTRE: the layout toggle, and nothing else.

            Gated on CodeMirror having mounted, and not only for tidiness. In
            the preview layout the write pane is display:none, and a REQUIRED
            control that is not displayed blocks submission with a validation
            message the author can neither see nor reach. The textarea drops
            `required` exactly when CodeMirror takes over, so the two conditions
            have to be the same one.

            The wrapper renders either way so the three groups keep their
            positions whether or not script ran.
          */}
          <div className="editor-bar-group editor-bar-center">
            {richBody ? (
              <div className="editor-layout-toggle" role="group" aria-label="Editor layout">
                {(["write", "split", "preview"] as Layout[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="editor-layout-option"
                    aria-pressed={layout === option}
                    onClick={() => chooseLayout(option)}
                  >
                    {option === "write" ? "Write" : option === "split" ? "Split" : "Preview"}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="editor-bar-group editor-bar-right">
            {/*
              Dirty state as a first-class element rather than a line of prose
              at the bottom of a form. It is the one thing the author checks
              before closing the tab. Short enough to sit on one line at 32px,
              because the bar is a single row now: the longer phrasing wrapped
              it to three rows at 1280px.
            */}
            <span className={dirty ? "editor-dirty is-dirty" : "editor-dirty"}>
              <span className="editor-dirty-dot" aria-hidden="true" />
              {!headSha
                ? "Saving unavailable"
                : dirty
                  ? "Unsaved changes"
                  : feedback && feedback.state !== "failed"
                    ? `Saved ${feedback.sha}`
                    : `Saved ${shortHead}`}
            </span>

            {/*
              The zero-JS render, removed the moment CodeMirror takes over, on
              the same principle as the textarea it sits beside: with no script
              the layout toggle cannot render and this form submit is the ONLY
              way to see rendered output, so it stays for that reader and goes
              for everyone else.

              It is REMOVED rather than hidden because, unlike the textarea, it
              carries no value the save path needs. check:admin-ui renders
              server-side, where `richBody` is false, so `intent=preview` is
              still in the submission set and the fixture does not move.
            */}
            {!richBody ? (
              <button
                type="submit"
                name="intent"
                value="preview"
                className="btn-ghost editor-preview-submit"
                disabled={busy}
              >
                Render
              </button>
            ) : null}

            {/* A 32 by 32 icon button. The gear is decorative; the accessible
                name is a real word, and the expanded state is on the control
                that owns the drawer. */}
            <button
              type="button"
              className="editor-icon-button"
              aria-expanded={drawerOpen}
              aria-haspopup="dialog"
              aria-label="Post settings"
              title="Post settings"
              onClick={() => setDrawerOpen(true)}
            >
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
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.3.38.55.67.7H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>

            <div className="editor-primary">
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
        <div className="editor-canvas" data-layout={layout}>
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

            <div className="editor-panes">
              <div className="editor-pane editor-pane-write">
                <label className="sr-only" htmlFor="field-body">
                  Body, markdown
                </label>
                {/*
                  THE SUBMITTED FIELD, always. CodeMirror does not replace it,
                  it drives it: the editor pushes every change into `body`
                  state, which is this textarea's value, which is what the form
                  serialises. So the payload is the same field carrying the same
                  bytes it carried when this was the only control, and
                  check:admin-ui's fixture does not move.

                  It stays in the DOM rather than being swapped out, because it
                  is also the no-script path: with nothing loaded, this IS the
                  editor. `required` is dropped once CodeMirror mounts, since a
                  hidden required control blocks submission with a validation
                  message the author cannot see or reach. The server gate is the
                  authority on an empty body either way.
                */}
                <textarea
                  id="field-body"
                  ref={bodyRef}
                  name="body"
                  className={richBody ? "editor-body is-replaced" : "editor-body"}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  spellCheck
                  required={!richBody}
                  aria-hidden={richBody}
                  tabIndex={richBody ? -1 : undefined}
                />
                <Suspense fallback={null}>
                  <MarkdownEditor
                    value={body}
                    onChange={(next) => {
                      setBody(next);
                      touched();
                    }}
                    onReady={() => setRichBody(true)}
                    slug={fields.slug}
                    linkTargets={linkTargets}
                  />
                </Suspense>
              </div>

              {layout !== "write" ? (
                <PreviewPane result={preview} busy={previewing} />
              ) : null}
            </div>

            {/*
              The zero-JS image path, and ONLY that. Once CodeMirror is mounted
              the same job is done by drag-drop, paste, the toolbar and the
              slash commands, and leaving a native file input plus a second alt
              field under the canvas made the editor look like two editors
              stacked. Removed on mount, exactly as the Render button and the
              textarea are.

              It contributes nothing to the payload in either state: the file
              input and the alt input carry no `name`, and the button is
              type="button". check:admin-ui renders server-side where richBody
              is false, so it is still in that render and the fixture holds.
            */}
            {!richBody ? (
              <ImageUploader
                onInsert={(snippet) => {
                  const el = bodyRef.current;
                  if (!el) return;
                  const at = el.selectionStart ?? body.length;
                  setBody(body.slice(0, at) + snippet + body.slice(at));
                  setDirty(true);
                }}
              />
            ) : null}
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

      {!richBody && previewHtml !== undefined && previewHtml !== null ? (
        <section className="editor-preview" aria-label="Preview">
          <h2>Preview</h2>
          <div className="prose" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </section>
      ) : null}
    </div>
  );
}

/**
 * The live preview, in a sandboxed frame.
 *
 * The HTML is passed through UNTOUCHED, because the whole claim of ruling 3 is
 * that what you see is what publishes. Sanitising it here would make the
 * preview differ from the stored output and quietly void that claim.
 *
 * So the isolation is the frame, not the markup. `sandbox` with no
 * `allow-scripts` and no `allow-same-origin` means nothing inside can execute,
 * reach this document, or navigate the parent. That is not belt and braces:
 * measured 2026-08-01, the pipeline strips raw `<script>`, `<iframe>` and
 * `onerror=` (remark-rehype drops raw HTML) but PASSES `javascript:` URLs
 * through from ordinary markdown links, so a body can contain one and the
 * author would otherwise be one click from running it inside the admin origin.
 *
 * The site stylesheets are copied in by href so the preview is styled the way
 * the published page is, and the theme attribute is mirrored so tokens resolve
 * to the mode the author is actually working in.
 */
function PreviewPane({
  result,
  busy,
}: {
  result: { html: string } | { error: string } | null;
  busy: boolean;
}) {
  const [doc, setDoc] = useState("");

  useEffect(() => {
    if (!result || "error" in result) return;
    const styles = [...document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')]
      .map((link) => `<link rel="stylesheet" href="${link.href}">`)
      .join("");
    const theme = document.documentElement.getAttribute("data-theme");
    // `.post` is the blog's own article wrapper and carries the 44rem measure;
    // `.prose` is the blog's own body typography. Both come from the site
    // stylesheet linked above, so the preview cannot drift from the published
    // page: there is no second copy of either rule to keep in step. The only
    // thing declared here is the frame's own padding.
    setDoc(
      `<!doctype html><html lang="en"${theme ? ` data-theme="${theme}"` : ""}>` +
        `<head><meta charset="utf-8">${styles}` +
        `<style>body{margin:0;padding:2rem 1.5rem;background:var(--bg)}` +
        `.post{margin:0 auto}</style></head>` +
        `<body><div class="post"><article class="prose">${result.html}</article></div></body></html>`,
    );
  }, [result]);

  return (
    <section className="editor-pane editor-pane-preview" aria-label="Preview">
      {/*
        The pane says only what the command bar cannot.

        It used to read "Up to date" beside a bar that already said
        "Saved <sha>", so two indicators described overlapping freshness at one
        glance and the reader had to work out which was about the file and which
        was about the render. The save state lives in the bar; this reports only
        the two TRANSIENT conditions the bar has no way to know about, and says
        nothing at rest.
      */}
      <div className="editor-pane-head">
        <span className="field-label">Preview</span>
        <span className="muted" aria-live="polite">
          {busy ? "Rendering" : result && "error" in result ? "Not renderable" : ""}
        </span>
      </div>
      {result && "error" in result ? (
        <div className="editor-feedback" data-tone="danger">
          <Glyph tone="danger" />
          <div>
            <strong>The renderer refused this body.</strong>
            <p>{result.error}</p>
          </div>
        </div>
      ) : (
        <iframe
          className="editor-preview-frame"
          title="Rendered preview"
          sandbox=""
          srcDoc={doc}
        />
      )}
    </section>
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
