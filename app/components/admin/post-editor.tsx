import { useEffect, useRef, useState } from "react";
import { Form, Link, useBlocker, useNavigation } from "react-router";
import { Alert, Banner } from "capsomer/react/banner";
import { Button } from "capsomer/react/button";
import { MarkdownEditor } from "capsomer/react/markdown-editor";
import { Panel } from "capsomer/react/panel";
import { Status } from "capsomer/react/status";

import { PageHead } from "~/components/admin/page-head";
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
import { SCAFFOLDS } from "./md-editor-commands";
import { PostMetadata } from "./post-metadata";
import { RevisionList, type Revision } from "./revision-list";
import { SettingsDrawer } from "./settings-drawer";
import { TitleSlugRow } from "./title-slug-row";
import { useDraftBuffer } from "./use-draft-buffer";
import { useLivePreview } from "./use-live-preview";

// There is no `draft` field: the transition rides in the submitter's `intent`, which a scriptless browser still sends.

/** A post the link palette can offer; `state` flags one that is not live, since linking a draft would 404. */
type LinkTarget = { slug: string; title: string; state: "published" | "scheduled" | "draft" };

// Read off the document, not loader data: the root loader re-runs on client navigation and mints a different nonce.
// The IDL property, not getAttribute: browsers hide the attribute after parsing so injected script cannot read it.
function documentCspNonce(): string {
  if (typeof document === "undefined") return "";
  return document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ?? "";
}

/** The site's own blocks for the editor's slash menu and toolbar; the editor's behaviour is Capsomer's. */
const SCAFFOLD_LIST = Object.entries(SCAFFOLDS).map(([id, scaffold]) => ({
  id,
  label: scaffold.label,
  hint: scaffold.hint,
  text: scaffold.text,
  cursor: scaffold.cursor,
}));

/** A dropped or pasted image: the upload, whose failure the editor says in its alert, then the figure. */
async function uploadImage(file: File): Promise<{ url: string }> {
  const result = await uploadMedia(file);
  if ("error" in result) throw new Error(result.error);
  return { url: result.url };
}

const TONE_OF_STATE = { published: "ok", draft: "nodata", scheduled: "info" } as const;

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
    <div className="app-page">
      <PageHead
        crumbs={[{ label: "Posts", href: "/admin/posts" }, { label: isNew ? "New post" : title || "Untitled" }]}
        title={isNew ? "New post" : `Edit ${title || "Untitled"}`}
        lead={<Status tone={TONE_OF_STATE[state]}>{state}</Status>}
        actions={
          <EditorBar
            formId={FORM_ID}
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
        }
      />

      {/* `role="alert"`, not a modal: the router already stopped the navigation, and a modal would
          trap focus around a question the author can answer by typing on. */}
      {blocker.state === "blocked" ? (
        <Alert
          tone="warn"
          title="This post has unsaved changes."
          action={
            <>
              <Button onClick={() => blocker.reset()}>Stay here</Button>
              <Button variant="quiet" onClick={() => blocker.proceed()}>
                Leave without saving
              </Button>
            </>
          }
        >
          Leaving now keeps them in this browser's crash net, and they are not committed.
        </Alert>
      ) : null}

      <Form
        id={FORM_ID}
        method="post"
        className="app-editor"
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

        {!headSha ? (
          <Alert tone="crit" title="Saving unavailable">
            {headError
              ? `The repository could not be read, so a save cannot commit: ${headError}`
              : "GITHUB_TOKEN is not configured on this Worker, so a save cannot commit."}{" "}
            Preview still works.
          </Alert>
        ) : null}

        {loadProblems.length > 0 ? (
          <Banner tone="warn" title="Some editor data did not load">
            {loadProblems.join(" ")}
          </Banner>
        ) : null}

        {/* Always in the DOM so the live region exists before its content does. */}
        <div role="status" aria-live="polite">
          {feedback ? <FeedbackMessage feedback={feedback} /> : null}
        </div>

        {/* Inside the editing form: a publish re-sends the whole post. Scheduling is script-only
            because datetime-local reads as local time in the browser and UTC on the server. */}
        {awaitingPublishConfirmation ? (
          <Panel
            title="Publish this post"
            footer={
              <>
                <Link to="/admin/posts" className="cap-btn">
                  Cancel
                </Link>
                <Button type="submit" name="intent" value={PUBLISH_CONFIRMED_INTENT} variant="primary">
                  Publish now
                </Button>
              </>
            }
          >
            <p>{FIRST_PUBLICATION_NOTE}</p>
            <p className="cap-muted">
              To hold it until a set time instead, set the schedule in Post settings, which needs
              scripting.
            </p>
          </Panel>
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
          <Banner tone="info">
            Loaded revision <code className="cap-mono">{restoredFrom.slice(0, 7)}</code> into the
            editor. Nothing has been written yet. Save to commit it on top, or leave without saving to
            discard it.
          </Banner>
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

        <div className="app-editor-canvas" data-layout={layout}>
          <div className="app-editor-write">
            {/* The editor's own textarea is the no-script editor and is always submitted: it holds the
                markdown, and the editor takes over in place once it has loaded. `required` drops once it
                mounts, since a hidden required control blocks submission unreachably. */}
            <MarkdownEditor
              label="Body"
              ariaLabel="Body, markdown"
              id="field-body"
              name="body"
              value={body}
              onChange={(next) => {
                setBody(next);
                touched();
              }}
              onReady={() => setRichBody(true)}
              required={!richBody}
              nonce={documentCspNonce()}
              accept={ACCEPT_ATTRIBUTE}
              scaffolds={SCAFFOLD_LIST}
              linkTargets={linkTargets.map((target) => ({
                href: `/writing/${target.slug}`,
                title: target.title,
                note: target.state === "published" ? undefined : `not live yet (${target.state})`,
              }))}
              onUpload={uploadImage}
              imageMarkdown={({ url, alt }) =>
                `:::figure{src="${url}" alt="${alt.trim().replace(/"/g, "&quot;")}"}\n:::`
              }
              help="Markdown. Ctrl or Cmd + K links to a post. A lone / on a line opens the block menu. An image needs alt text."
            />
          </div>

          {layout !== "write" ? <PreviewPane result={preview} busy={previewing} /> : null}
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
        <Panel title="Preview">
          <article data-context="prose" dangerouslySetInnerHTML={{ __html: previewHtml }} />
        </Panel>
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
    // A style attribute, which the policy allows, rather than a style element, which it does not.
    setDoc(
      `<!doctype html><html lang="en"${theme ? ` data-theme="${theme}"` : ""}>` +
        `<head><meta charset="utf-8">${styles}</head>` +
        `<body style="margin:0;padding:2rem 1.5rem">` +
        `<article data-context="prose">${result.html}</article></body></html>`,
    );
  }, [result]);

  return (
    <Panel
      title="Preview"
      src={busy ? "Rendering" : result && "error" in result ? "Not renderable" : undefined}
    >
      {result && "error" in result ? (
        <Alert tone="crit" title="The renderer refused this body.">
          {result.error}
        </Alert>
      ) : (
        <iframe className="app-editor-frame" title="Rendered preview" sandbox="" srcDoc={doc} />
      )}
    </Panel>
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
    <Banner
      tone="warn"
      title="Unsaved local changes from an earlier session."
      actions={
        <>
          <Button size="sm" onClick={onRestore}>
            Restore them
          </Button>
          <Button size="sm" variant="quiet" onClick={onDiscard}>
            Discard them
          </Button>
        </>
      }
    >
      Kept in this browser at {new Date(buffer.at).toLocaleString()}. They were never committed.
    </Banner>
  );
}

function FeedbackMessage({ feedback }: { feedback: EditorFeedback }) {
  if (feedback.state === "failed") {
    return (
      <Alert tone="crit" title={feedback.conflict ? "Conflict. Not saved." : "Not saved."}>
        {feedback.message}
        {/* Shown only when present: an invented location would be worse than none. */}
        {feedback.field || feedback.line !== undefined ? (
          <>
            {" "}
            {feedback.field ? <>Field <code className="cap-mono">{feedback.field}</code></> : null}
            {feedback.field && feedback.line !== undefined ? ", " : null}
            {feedback.line !== undefined ? <>line {feedback.line}</> : null}
          </>
        ) : null}
      </Alert>
    );
  }

  if (feedback.state === "published-first") {
    return (
      <Banner tone="ok" title="Published for the first time.">
        Stamped {feedback.at}. Commit {feedback.sha}. Live at{" "}
        <a href={`/writing/${feedback.slug}`} target="_blank" rel="noreferrer">
          /writing/{feedback.slug}
        </a>
      </Banner>
    );
  }

  if (feedback.state === "republished") {
    return (
      <Banner tone="ok" title="Republished.">
        Public again at{" "}
        <a href={`/writing/${feedback.slug}`} target="_blank" rel="noreferrer">
          /writing/{feedback.slug}
        </a>
        . Commit {feedback.sha}.
      </Banner>
    );
  }

  if (feedback.state === "unpublished") {
    return (
      <Banner tone="warn" title="Unpublished.">
        /writing/{feedback.slug} now returns 404, and the post is out of the feed, the sitemap, search
        and the Ask index. Commit {feedback.sha}.
      </Banner>
    );
  }

  return (
    <Banner tone="ok" title="Saved.">
      Commit {feedback.sha}.
    </Banner>
  );
}
