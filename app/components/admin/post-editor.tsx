import { useEffect, useRef, useState } from "react";
import { Form, Link } from "react-router";

import type { PostFields } from "~/lib/editor/frontmatter";

/**
 * Textarea-first post editor. Frontmatter is form fields, the body is a plain
 * monospace textarea, and preview is a server round trip through the same
 * pipeline the build uses. No rich text editor: that is a separate decision.
 */

const TITLE_LIMIT = 70;
const DESCRIPTION_LIMIT = 160;

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
  problem,
  busy,
}: {
  fields: PostFields;
  isNew: boolean;
  headSha: string;
  previewHtml?: string | null;
  problem?: EditorProblem | null;
  busy?: boolean;
}) {
  const [title, setTitle] = useState(fields.title);
  const [slug, setSlug] = useState(fields.slug);
  const [description, setDescription] = useState(fields.description);
  const [body, setBody] = useState(fields.body);
  const [dirty, setDirty] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Unsaved-changes guard. Only armed once something actually changed, so it
  // never nags on a page the author only looked at.
  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const slugValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

  return (
    <div className="editor">
      <Form
        method="post"
        className="editor-form"
        onChange={() => setDirty(true)}
        onSubmit={() => setDirty(false)}
      >
        <input type="hidden" name="headSha" value={headSha} />
        <input type="hidden" name="isNew" value={isNew ? "1" : "0"} />

        {!headSha ? (
          <div className="editor-problem" role="alert">
            <strong>Saving unavailable</strong>
            <p>
              GITHUB_TOKEN is not configured on this Worker, so a save cannot
              commit. Preview still works.
            </p>
          </div>
        ) : null}

        {problem ? (
          <div className="editor-problem" role="alert">
            <strong>{problem.conflict ? "Conflict" : "Not saved"}</strong>
            <p>{problem.message}</p>
          </div>
        ) : null}

        <div className="editor-grid">
          <label className="field">
            <span className="field-label">
              Title
              <span className={title.length > TITLE_LIMIT ? "count over" : "count"}>
                {title.length}/{TITLE_LIMIT}
              </span>
            </span>
            <input
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span className="field-label">
              Slug
              {slug && !slugValid ? (
                <span className="count over">lowercase kebab-case only</span>
              ) : null}
            </span>
            <input
              name="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              readOnly={!isNew}
              required
              aria-invalid={slug !== "" && !slugValid}
              autoComplete="off"
            />
            {!isNew ? (
              <span className="field-hint muted">
                The slug is the public URL and the filename, so it is fixed after
                the first save.
              </span>
            ) : null}
          </label>
        </div>

        <label className="field">
          <span className="field-label">
            Description
            <span
              className={
                description.length > DESCRIPTION_LIMIT ? "count over" : "count"
              }
            >
              {description.length}/{DESCRIPTION_LIMIT}
            </span>
          </span>
          <input
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            autoComplete="off"
          />
        </label>

        <div className="editor-grid">
          <label className="field">
            <span className="field-label">Date</span>
            <input name="date" type="date" defaultValue={fields.date} required />
          </label>

          <label className="field">
            <span className="field-label">Publish at (optional)</span>
            <input
              name="publishAt"
              defaultValue={fields.publishAt}
              placeholder="2026-08-01T09:00:00Z"
              autoComplete="off"
            />
          </label>
        </div>

        <label className="field">
          <span className="field-label">Tags</span>
          <input
            name="tags"
            defaultValue={fields.tags.join(", ")}
            placeholder="cloudflare, d1"
            autoComplete="off"
          />
        </label>

        <div className="editor-grid">
          <label className="field">
            <span className="field-label">Cover image (optional)</span>
            <input
              name="coverSrc"
              defaultValue={fields.coverSrc}
              placeholder="/media/2026/cover.webp"
              autoComplete="off"
            />
          </label>
          <label className="field">
            <span className="field-label">Cover alt (required with a cover)</span>
            <input
              name="coverAlt"
              defaultValue={fields.coverAlt}
              autoComplete="off"
            />
          </label>
        </div>

        <label className="field field-draft">
          <input type="checkbox" name="draft" defaultChecked={fields.draft} />
          <span>Draft. Hidden from the blog, the feed and the sitemap.</span>
        </label>

        <label className="field">
          <span className="field-label">Body (markdown)</span>
          <textarea
            ref={bodyRef}
            name="body"
            className="editor-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={24}
            spellCheck
            required
          />
        </label>

        <div className="editor-actions">
          <button type="submit" name="intent" value="save" className="btn" disabled={busy}>
            {busy ? "Saving" : isNew ? "Create post" : "Save post"}
          </button>
          <button
            type="submit"
            name="intent"
            value="preview"
            className="btn-ghost"
            disabled={busy}
          >
            Preview
          </button>
          <Link to="/admin/posts" className="btn-ghost">
            Back to posts
          </Link>
        </div>
      </Form>

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
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </section>
      ) : null}
    </div>
  );
}

/**
 * Uploads an image to R2 and hands back a markdown snippet.
 *
 * Alt text is required at insert time rather than left for later, because an
 * image inserted without it is the one that ships without it.
 */
function ImageUploader({ onInsert }: { onInsert: (snippet: string) => void }) {
  const [alt, setAlt] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setStatus("Choose an image first.");
      return;
    }
    if (!alt.trim()) {
      setStatus("Alt text is required before an image can be inserted.");
      return;
    }
    setStatus("Uploading");

    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/admin/media", { method: "POST", body: form });
    if (!response.ok) {
      setStatus(`Upload failed (${response.status}).`);
      return;
    }
    const { url } = (await response.json()) as { url: string };
    onInsert(`\n![${alt.trim()}](${url})\n`);
    setStatus(`Inserted ${url}`);
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
          onChange={(e) => setAlt(e.target.value)}
          placeholder="Alt text (required)"
          aria-label="Alt text"
        />
        <button type="button" className="btn-ghost" onClick={upload}>
          Upload and insert
        </button>
      </div>
      {status ? <p className="muted">{status}</p> : null}
    </section>
  );
}
