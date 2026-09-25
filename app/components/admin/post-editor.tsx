import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { Form, Link, useBlocker, useNavigation } from "react-router";

import { ACCEPT_ATTRIBUTE, uploadMedia } from "~/lib/media/upload-contract.mjs";

import { clearAllBuffersFor, type DraftBuffer } from "~/lib/editor/draft-buffer";
import type { EditorFeedback } from "~/lib/editor/feedback";
import type { PostFields } from "~/lib/editor/frontmatter";
import {
  FIRST_PUBLICATION_NOTE,
  PUBLISH_CONFIRMED_INTENT,
  saveInPlaceIntent,
  type PostState,
} from "~/lib/editor/publish-transition.mjs";
import { EditorBar } from "./editor-bar";
import { PostMetadata } from "./post-metadata";
import { RevisionList, type Revision } from "./revision-list";
import { SettingsDrawer } from "./settings-drawer";
import { TitleSlugRow } from "./title-slug-row";
import { useDraftBuffer } from "./use-draft-buffer";
import { useLivePreview } from "./use-live-preview";

// There is no `draft` field: the transition rides in the submitter's `intent`, which a scriptless browser still sends.

// The dynamic import keeps editor machinery out of public bundles; first paint is the textarea, which no-script readers keep.
const MarkdownEditor = lazy(() => import("./markdown-editor"));

/** Type-only, so importing it does not pull the CodeMirror chunk in eagerly. */
type LinkTarget = import("./markdown-editor").LinkTarget;

const AUTOSAVE_DELAY_MS = 800;
const FORM_ID = "post-editor";

export function PostEditor({
  fields,
  isNew,
  headSha,
  headError = null,
  loadProblems = [],
  previewHtml,
  feedback,
  state,
  everPublished,
  tagOptions,
  linkTargets = [],
  revisions = [],
  existingSlugs = [],
  previewLinkSlot,
  historySlot,
  dangerSlot,
  awaitingPublishConfirmation = false,
}: {
  fields: PostFields;
  isNew: boolean;
  headSha: string;
  /** Why `headSha` is empty, when the read failed; null means no reason is known. */
  headError?: string | null;
  /** Sentences for editor data that failed to load, so a failed read never looks like an empty one. */
  loadProblems?: string[];
  previewHtml?: string | null;
  feedback?: EditorFeedback | null;
  state: PostState;
  everPublished: boolean;
  tagOptions: string[];
  linkTargets?: LinkTarget[];
  revisions?: Revision[];
  existingSlugs?: string[];
  previewLinkSlot?: React.ReactNode;
  historySlot?: React.ReactNode;
  dangerSlot?: React.ReactNode;
  awaitingPublishConfirmation?: boolean;
}) {
  const [title, setTitle] = useState(fields.title);
  const [slug, setSlug] = useState(fields.slug);
  // Once the author types a slug it stops tracking the title, so a chosen URL is never silently rewritten.
  const [slugPinned, setSlugPinned] = useState(fields.slug !== "");
  const [description, setDescription] = useState(fields.description);
  const [tags, setTags] = useState(fields.tags);
  const [coverSrc, setCoverSrc] = useState(fields.coverSrc);
  const [coverAlt, setCoverAlt] = useState(fields.coverAlt);
  const [publishAt, setPublishAt] = useState(fields.publishAt);
  const [body, setBody] = useState(fields.body);
  const [dirty, setDirty] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [restoredFrom, setRestoredFrom] = useState<string | null>(null);
  const [richBody, setRichBody] = useState(false);

  /* While a submit is in flight a second one would carry the same head and read as a false conflict. */
  const busy = useNavigation().state === "submitting";
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const formRef = useRef<HTMLFormElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const keyboardIntentRef = useRef<HTMLInputElement>(null);

  const { offer, setOffer, savedAt, ageNow, bufferTried, persist, autosaveTimer } = useDraftBuffer({
    formRef,
    slug: fields.slug,
    headSha,
    isNew,
    feedback,
    dirty,
    setDirty,
    setRestoredFrom,
  });

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  // The pathname check lets a save's own redirect through. A new post redirects to a different path,
  // which onSubmit clearing `dirty` before the request leaves handles.
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state === "blocked" && !dirty) blocker.reset();
  }, [blocker, dirty]);

  const { layout, chooseLayout, preview, previewing } = useLivePreview({
    body,
    fieldsSlug: fields.slug,
    slug,
  });

  // Sends the in-place intent explicitly by enabling a disabled hidden field: an absent intent on a write path is refused.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
      const form = formRef.current;
      if (!form || busyRef.current) return;
      const intentField = keyboardIntentRef.current;
      if (intentField) intentField.disabled = false;
      form.requestSubmit();
      if (intentField) intentField.disabled = true;
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

  // The buffer is rewritten at once, so a tab closed after a restore cannot offer to recover out of it.
  const applyRevision = (revision: PostFields, sha: string) => {
    setTitle(revision.title);
    // Pinned, so the revision's title does not rewrite its slug.
    setSlugPinned(true);
    setSlug(revision.slug);
    setDescription(revision.description);
    setTags(revision.tags);
    setCoverSrc(revision.coverSrc);
    setCoverAlt(revision.coverAlt);
    setPublishAt(revision.publishAt);
    setBody(revision.body);
    const form = formRef.current;
    const date = form?.elements.namedItem("date");
    if (date instanceof HTMLInputElement) date.value = revision.date;

    setOffer(null);
    setDirty(true);
    setRestoredFrom(sha);
    window.clearTimeout(autosaveTimer.current);
    window.setTimeout(persist, 0);
  };

  return (
    <div className="editor-shell">
      {/* The bar shows the title in a span; the page still needs a heading to be found by. */}
      <h1 className="sr-only">{isNew ? "New post" : `Edit ${title || "Untitled"}`}</h1>
      {/* `role="alert"`, not a modal: the router already stopped the navigation, and a modal would
          trap focus around a question the author can answer by typing on. */}
      {blocker.state === "blocked" ? (
        <div className="editor-leave-guard" role="alert">
          <p>
            <strong>This post has unsaved changes.</strong> Leaving now keeps
            them in this browser's crash net, and they are not committed.
          </p>
          <div className="editor-leave-actions">
            <button type="button" className="btn" onClick={() => blocker.reset()}>
              Stay here
            </button>
            <button type="button" className="btn-ghost" onClick={() => blocker.proceed()}>
              Leave without saving
            </button>
          </div>
        </div>
      ) : null}
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
        {/* Cmd+S submits with no submitter, and an absent intent is refused, so the shortcut enables
            this for one submit. Disabled at rest so a button's own intent is the only one sent. The
            value follows the post's state: a literal "save" would publish a draft on Cmd+S. */}
        <input
          ref={keyboardIntentRef}
          type="hidden"
          name="intent"
          value={saveInPlaceIntent(state)}
          disabled
        />
        {/* Carried so a browser save preserves it: `serializePost` writes exactly the keys it is
            handed, so a dropped value would make a published post read as never published. */}
        <input type="hidden" name="firstPublished" value={fields.firstPublished} />
        {/* The build derives `updated` from the last commit and the editor stamps it on save. */}
        <input type="hidden" name="updated" value={fields.updated} />
        {/* No `draft` field on purpose: the intent carries the transition, so a scriptless request
            cannot send the post's current state instead of the one the author pressed. */}

        <EditorBar
          title={title}
          state={state}
          richBody={richBody}
          layout={layout}
          chooseLayout={chooseLayout}
          dirty={dirty}
          headSha={headSha}
          feedback={feedback}
          savedAt={savedAt}
          ageNow={ageNow}
          bufferTried={bufferTried}
          busy={busy}
          drawerOpen={drawerOpen}
          openDrawer={() => setDrawerOpen(true)}
          everPublished={everPublished}
          publishAt={publishAt}
          onPublishAtChange={(value) => {
            setPublishAt(value);
            setDirty(true);
          }}
        />

        <div className="editor-canvas" data-layout={layout}>
          <div className="editor-page">
            {!headSha ? (
              <div className="editor-notice" role="alert">
                <strong>Saving unavailable</strong>
                <p>
                  {headError
                    ? `The repository could not be read, so a save cannot commit: ${headError}`
                    : "GITHUB_TOKEN is not configured on this Worker, so a save cannot commit."}{" "}
                  Preview still works.
                </p>
              </div>
            ) : null}

            {loadProblems.length > 0 ? (
              <div className="editor-notice">
                <strong>Some editor data did not load</strong>
                {loadProblems.map((problem) => (
                  <p key={problem}>{problem}</p>
                ))}
              </div>
            ) : null}

            {/* Always in the DOM so the live region exists before its content does. */}
            <div className="editor-feedback-slot" role="status" aria-live="polite">
              {feedback ? <FeedbackMessage feedback={feedback} /> : null}
            </div>

            {/* Inside the editing form: a publish re-sends the whole post. Scheduling is script-only
                because datetime-local reads as local time in the browser and UTC on the server. */}
            {awaitingPublishConfirmation ? (
              <div className="editor-confirm-publish">
                <h2>Publish this post</h2>
                <p>{FIRST_PUBLICATION_NOTE}</p>
                <div className="editor-confirm-actions">
                  <Link to="/admin/posts" className="btn-ghost">
                    Cancel
                  </Link>
                  <button
                    type="submit"
                    name="intent"
                    value={PUBLISH_CONFIRMED_INTENT}
                    className="btn"
                  >
                    Publish now
                  </button>
                </div>
                <p className="muted">
                  To hold it until a set time instead, set the schedule in Post
                  settings, which needs scripting.
                </p>
              </div>
            ) : null}

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

            {/* An author returning to this tab must not mistake a loaded revision for the live post. */}
            {restoredFrom ? (
              <p className="editor-notice">
                Loaded revision <code>{restoredFrom.slice(0, 7)}</code> into the
                editor. Nothing has been written yet. Save to commit it on top,
                or leave without saving to discard it.
              </p>
            ) : null}

            <TitleSlugRow
              title={title}
              setTitle={setTitle}
              slug={slug}
              setSlug={setSlug}
              slugPinned={slugPinned}
              setSlugPinned={setSlugPinned}
              isNew={isNew}
              existingSlugs={existingSlugs}
            />

            <div className="editor-panes">
              <div className="editor-pane editor-pane-write">
                <label className="sr-only" htmlFor="field-body">
                  Body, markdown
                </label>
                {/* Always submitted, and the no-script editor. `required` drops once CodeMirror mounts,
                    since a hidden required control blocks submission unreachably. */}
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

            {/* The image path until CodeMirror mounts, then drag-drop, paste and the toolbar take over. It needs script too: without script the editor has no image upload. */}
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

          {/* In the page, not the drawer: the drawer is a `<dialog>` that only opens with script. */}
          <PostMetadata
            formId={FORM_ID}
            featured={fields.featured}
            series={fields.series}
            part={fields.part}
            furtherReading={fields.furtherReading}
            ogTitle={fields.ogTitle}
            ogDescription={fields.ogDescription}
            title={title}
            description={description}
            linkTargets={linkTargets}
            currentSlug={slug}
          />
        </div>

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
          previewPost={{ slug, title, description, coverSrc, coverAlt }}
          previewLinkSlot={previewLinkSlot}
          historySlot={
            revisions.length > 0 ? (
              <RevisionList slug={fields.slug} revisions={revisions} onRestore={applyRevision} />
            ) : (
              historySlot
            )
          }
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

// The HTML is passed through unsanitized, so the preview is what publishes. The sandbox is the isolation,
// and it matters: the pipeline passes javascript: URLs through from ordinary markdown links.
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
    setDoc(
      `<!doctype html><html lang="en"${theme ? ` data-theme="${theme}"` : ""}>` +
        `<head><meta charset="utf-8">${styles}` +
        `<style>body{margin:0;padding:2rem 1.5rem;background:var(--paper)}` +
        `.post{margin:0 auto}</style></head>` +
        `<body><div class="post"><article class="prose">${result.html}</article></div></body></html>`,
    );
  }, [result]);

  return (
    <section className="editor-pane editor-pane-preview" aria-label="Preview">
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

function FeedbackMessage({ feedback }: { feedback: EditorFeedback }) {
  if (feedback.state === "failed") {
    return (
      <div className="editor-feedback" data-tone="danger">
        <Glyph tone="danger" />
        <div>
          <strong>{feedback.conflict ? "Conflict. Not saved." : "Not saved."}</strong>
          <p>{feedback.message}</p>
          {/* Shown only when present: an invented location would be worse than none. */}
          {feedback.field || feedback.line !== undefined ? (
            <p className="muted">
              {feedback.field ? <>Field <code>{feedback.field}</code></> : null}
              {feedback.field && feedback.line !== undefined ? ", " : null}
              {feedback.line !== undefined ? <>line {feedback.line}</> : null}
            </p>
          ) : null}
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

    const result = await uploadMedia(file);
    if ("error" in result) {
      setMessage(result.error);
      return;
    }
    onInsert(`\n![${alt.trim()}](${result.url})\n`);
    setMessage(`Inserted ${result.url}`);
    setAlt("");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <section className="editor-upload" aria-label="Insert image">
      <h2>Insert image</h2>
      <div className="editor-upload-row">
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          aria-label="Image file"
        />
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
      {/* Always in the DOM so "Uploading", the failure and the result are all announced. */}
      <p className="muted" role="status">
        {message}
      </p>
    </section>
  );
}
