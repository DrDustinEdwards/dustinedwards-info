import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef, useState } from "react";

/**
 * The markdown body, in CodeMirror 6.
 *
 * Ruling 2: the text edited IS the file. There is no document model, no
 * serializer and no round trip, so the fidelity risk that ruled out a rich-node
 * editor does not exist here by construction. `view.state.doc.toString()` is
 * the bytes that get committed.
 *
 * This module is imported lazily and only ever from the post editor, which is
 * only ever imported by admin routes. Ruling 6 requires that CodeMirror never
 * reaches a public-plane bundle; the dynamic import is what makes it its own
 * chunk, and the build output is what proves it.
 */

/* -------------------------------------------------------------------------
 * Theme, entirely from tokens.
 *
 * Not one hex in here. Every colour is a `var(--token)` that resolves through
 * the same three theme selectors as the rest of the site, so light, dark and
 * system all land correctly with nothing to flash and no second theme to keep
 * in step. That is also why there is no `dark` variant of this object: there is
 * only one theme, and the tokens under it change.
 * ---------------------------------------------------------------------- */

const houseTheme = EditorView.theme({
  "&": {
    color: "var(--text)",
    backgroundColor: "var(--bg)",
    fontSize: "0.875rem",
    height: "100%",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono)",
    lineHeight: "1.6",
  },
  ".cm-content": {
    caretColor: "var(--brand)",
    padding: "0.75rem 0",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg)",
    color: "var(--text-disabled)",
    border: "none",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-activeLine": { backgroundColor: "var(--surface)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--surface)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--selection-bg)",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--brand)" },
  ".cm-placeholder": { color: "var(--text-disabled)" },
});

/**
 * Syntax colours, drawn from the ratified chart ladder and the semantic text
 * tokens rather than from a syntax theme of their own.
 *
 * check:contrast measures the shiki tokens against the code surfaces because
 * those ship to readers. These are admin-only and sit on `--bg`, so they reuse
 * tokens the matrix already covers against `--bg` instead of introducing a
 * seventh palette nobody would remember to check.
 */
const houseHighlight = HighlightStyle.define([
  { tag: tags.heading, color: "var(--text-heading)", fontWeight: "650" },
  { tag: tags.strong, color: "var(--text-heading)", fontWeight: "650" },
  { tag: tags.emphasis, color: "var(--text)", fontStyle: "italic" },
  { tag: tags.link, color: "var(--brand)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--brand)" },
  { tag: tags.monospace, color: "var(--text-accent)" },
  { tag: tags.quote, color: "var(--text-muted)", fontStyle: "italic" },
  { tag: tags.list, color: "var(--text-muted)" },
  { tag: tags.meta, color: "var(--text-muted)" },
  { tag: tags.processingInstruction, color: "var(--text-muted)" },
  { tag: tags.contentSeparator, color: "var(--text-muted)" },
  { tag: tags.strikethrough, color: "var(--text-muted)", textDecoration: "line-through" },
]);

/* -------------------------------------------------------------------------
 * Syntax insertion. Every toolbar action and every shortcut goes through one
 * of these, so a keyboard user and a mouse user run identical code.
 * ---------------------------------------------------------------------- */

/** Wraps the selection, or drops the markers at the cursor and lands inside. */
function wrap(view: EditorView, before: string, after = before) {
  const { from, to } = view.state.selection.main;
  const selected = view.state.sliceDoc(from, to);
  view.dispatch({
    changes: { from, to, insert: `${before}${selected}${after}` },
    selection: selected
      ? { anchor: from + before.length, head: from + before.length + selected.length }
      : { anchor: from + before.length },
    scrollIntoView: true,
  });
  view.focus();
}

/** Inserts a block at the start of the line, on its own blank line if needed. */
function insertBlock(view: EditorView, text: string, cursorOffset?: number) {
  const { from } = view.state.selection.main;
  const line = view.state.doc.lineAt(from);
  const atLineStart = line.from === from && line.text.trim() === "";
  const prefix = atLineStart ? "" : "\n\n";
  const insert = `${prefix}${text}`;
  view.dispatch({
    changes: { from, to: view.state.selection.main.to, insert },
    selection: {
      anchor: from + prefix.length + (cursorOffset ?? text.length),
    },
    scrollIntoView: true,
  });
  view.focus();
}

/** h2 to h3 to plain and back, on the current line. */
function cycleHeading(view: EditorView) {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const match = /^(#{2,4})\s+/.exec(line.text);
  const next = !match ? "## " : match[1].length >= 4 ? "" : `${"#".repeat(match[1].length + 1)} `;
  const strippedFrom = match ? match[0].length : 0;
  view.dispatch({
    changes: { from: line.from, to: line.from + strippedFrom, insert: next },
    scrollIntoView: true,
  });
  view.focus();
}

/** A footnote reference plus its definition at the foot of the document. */
function insertFootnote(view: EditorView) {
  const doc = view.state.doc;
  const existing = doc.toString().match(/\[\^(\d+)\]/g) ?? [];
  const n = existing.length + 1;
  const { from } = view.state.selection.main;
  const tail = doc.length;
  view.dispatch({
    changes: [
      { from, to: view.state.selection.main.to, insert: `[^${n}]` },
      { from: tail, insert: `\n\n[^${n}]: ` },
    ],
    // Land in the DEFINITION, because that is the part that still needs
    // writing. The reference is complete the moment it is inserted.
    selection: { anchor: tail + `[^${n}]`.length + `\n\n[^${n}]: `.length },
    scrollIntoView: true,
  });
  view.focus();
}

/**
 * The house directive scaffolds.
 *
 * Every one carries `alt=""` with the cursor inside it, because alt is
 * mandatory on both `:::chart` and `:::diagram` and the build FAILS without it.
 * Scaffolding the failure and putting the cursor in the hole is the difference
 * between a template and a trap.
 */
const SCAFFOLDS = {
  chart: {
    label: "Chart",
    hint: "Bar, line, dot or area from inline CSV",
    text: [
      ':::chart{type=bar x=name y=value title="" alt=""}',
      "```csv",
      "name,value",
      "first,1",
      "```",
      "An optional caption.",
      ":::",
    ].join("\n"),
    cursor: ':::chart{type=bar x=name y=value title="" alt="'.length,
  },
  diagram: {
    label: "Diagram",
    hint: "Mermaid, rendered by build:diagrams",
    text: [
      ':::diagram{title="" alt=""}',
      "```mermaid",
      "flowchart LR",
      "  A[Start] --> B[End]",
      "```",
      "An optional caption.",
      ":::",
    ].join("\n"),
    cursor: ':::diagram{title="" alt="'.length,
  },
  figure: {
    label: "Figure",
    hint: "An image with a caption",
    text: [':::figure{src="" alt=""}', "A caption.", ":::"].join("\n"),
    cursor: ':::figure{src="'.length,
  },
} as const;

type ScaffoldName = keyof typeof SCAFFOLDS;

/**
 * A glyph per directive, in the house inline-SVG idiom (ruling 7).
 *
 * Each one draws what the directive PRODUCES rather than an abstract symbol:
 * bars for a chart, connected nodes for a diagram, a framed picture for a
 * figure. The accessible name is still the word, so the drawing is the second
 * channel and never the only one.
 */
const SCAFFOLD_GLYPHS: Record<ScaffoldName, React.ReactNode> = {
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  diagram: (
    <>
      <rect x="3" y="4" width="7" height="5" rx="1" />
      <rect x="14" y="15" width="7" height="5" rx="1" />
      <path d="M10 6.5h4a3 3 0 0 1 3 3V15" />
    </>
  ),
  figure: (
    <>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="m3 14 4-4 5 5" />
      <circle cx="15.5" cy="8.5" r="1.5" />
      <path d="M6 21h12" />
    </>
  ),
};

export type MarkdownEditorHandle = {
  focus: () => void;
};

export default function MarkdownEditor({
  value,
  onChange,
  onReady,
  slug,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  onReady: () => void;
  slug: string;
  placeholder?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  /**
   * Whether CodeMirror actually exists yet.
   *
   * React 19 resolves a lazy component during SSR, so this module's markup IS
   * in the server-rendered document even though the editor itself only mounts
   * in an effect. Without this the no-script reader was handed a dead toolbar,
   * an empty box, and a strip telling them to drag and drop an image, which is
   * the one thing that cannot work for them. The host div below always renders,
   * because CodeMirror needs a node to attach to; the chrome waits.
   */
  const [ready, setReady] = useState(false);
  const [slashAt, setSlashAt] = useState<{ from: number; top: number; left: number } | null>(null);
  const [upload, setUpload] = useState<{ url: string; name: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [alt, setAlt] = useState("");

  /** Uploads through the existing admin action, then asks for alt text. */
  const uploadFile = async (file: File) => {
    setUploadError(null);
    setUpload({ url: "", name: file.name });
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/admin/media", { method: "POST", body: form });
    if (!response.ok) {
      const detail = await response
        .json<{ error?: string }>()
        .catch(() => ({}) as { error?: string });
      setUpload(null);
      // The route names the real reason (wrong type, over 10 MB), so it is
      // reported rather than replaced with a status code the author cannot act
      // on. The code is the fallback, not the message.
      setUploadError(detail.error ?? `Upload failed (${response.status}).`);
      return;
    }
    const { url } = await response.json<{ url: string }>();
    setUpload({ url, name: file.name });
    setAlt("");
  };

  useEffect(() => {
    const parent = host.current;
    if (!parent || viewRef.current) return;

    const extensions: Extension[] = [
      history(),
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(houseHighlight),
      houseTheme,
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        if (update.docChanged || update.selectionSet) {
          // The slash menu opens on a lone "/" at the start of an empty line,
          // deliberately narrow: markdown is full of slashes, and a menu that
          // opened inside a URL would be unusable.
          const { head } = update.state.selection.main;
          const line = update.state.doc.lineAt(head);
          if (line.text === "/" && head === line.to) {
            const coords = update.view.coordsAtPos(line.from);
            const box = parent.getBoundingClientRect();
            setSlashAt(
              coords
                ? { from: line.from, top: coords.bottom - box.top, left: coords.left - box.left }
                : null,
            );
          } else {
            setSlashAt(null);
          }
        }
      }),
      EditorView.domEventHandlers({
        paste(event, view) {
          const item = [...(event.clipboardData?.items ?? [])].find((i) =>
            i.type.startsWith("image/"),
          );
          const file = item?.getAsFile();
          if (!file) return false;
          event.preventDefault();
          viewRef.current = view;
          void uploadFile(file);
          return true;
        },
        drop(event, view) {
          const file = [...(event.dataTransfer?.files ?? [])].find((f) =>
            f.type.startsWith("image/"),
          );
          if (!file) return false;
          event.preventDefault();
          viewRef.current = view;
          void uploadFile(file);
          return true;
        },
      }),
      keymap.of([
        { key: "Mod-b", run: (v) => (wrap(v, "**"), true) },
        { key: "Mod-i", run: (v) => (wrap(v, "_"), true) },
        { key: "Mod-k", run: (v) => (wrap(v, "[", "](url)"), true) },
        { key: "Mod-e", run: (v) => (wrap(v, "`"), true) },
        // Cmd+S is handled by the editor shell, which knows which transition
        // the primary button is armed for. Swallowing it here would save with
        // whatever draft flag the last press happened to leave behind.
        { key: "Escape", run: () => (setSlashAt(null), false) },
        ...historyKeymap,
        ...defaultKeymap,
      ]),
      cmPlaceholder(placeholder ?? "Write in markdown."),
    ];

    const view = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent,
    });
    viewRef.current = view;
    // The chrome waits for this, not for the module having loaded. React 19
    // resolves a lazy component during SSR, so the markup exists well before
    // the editor it decorates does.
    setReady(true);
    onReady();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mounted once. `value` is the INITIAL document only; after that the
    // editor owns it and pushes changes outward. Re-running this on every
    // keystroke would rebuild the editor and lose the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Accepts a document set from OUTSIDE, which is the draft-buffer restore.
   *
   * Guarded on the text actually differing, or every keystroke would round trip
   * through the parent and dispatch a redundant transaction that resets the
   * selection. A restore is the only thing that legitimately replaces the whole
   * document while mounted.
   */
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current === value) return;
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }, [value]);

  const run = (fn: (view: EditorView) => void) => () => {
    const view = viewRef.current;
    if (view) fn(view);
  };

  const scaffold = (name: ScaffoldName, replaceSlash?: number) => {
    const view = viewRef.current;
    if (!view) return;
    const s = SCAFFOLDS[name];
    if (replaceSlash !== undefined) {
      const line = view.state.doc.lineAt(replaceSlash);
      view.dispatch({ changes: { from: line.from, to: line.to, insert: "" } });
    }
    setSlashAt(null);
    insertBlock(view, s.text, s.cursor);
  };

  const insertFigure = () => {
    const view = viewRef.current;
    if (!view || !upload?.url || !alt.trim()) return;
    insertBlock(
      view,
      [`:::figure{src="${upload.url}" alt="${alt.trim().replace(/"/g, "&quot;")}"}`, ":::"].join(
        "\n",
      ),
    );
    setUpload(null);
    setAlt("");
  };

  return (
    <div className="md-editor">
      {ready ? (
      <div className="md-toolbar" role="toolbar" aria-label="Markdown formatting">
        <ToolButton label="Bold" hint="Ctrl or Cmd + B" onClick={run((v) => wrap(v, "**"))}>
          <path d="M6 4h7a4 4 0 0 1 0 8H6zM6 12h8a4 4 0 0 1 0 8H6z" />
        </ToolButton>
        <ToolButton label="Italic" hint="Ctrl or Cmd + I" onClick={run((v) => wrap(v, "_"))}>
          <path d="M15 4h-5M14 20H9M14 4 10 20" />
        </ToolButton>
        <ToolButton label="Link" hint="Ctrl or Cmd + K" onClick={run((v) => wrap(v, "[", "](url)"))}>
          <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
          <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
        </ToolButton>
        <ToolButton label="Heading level" hint="Cycles h2, h3, h4, none" onClick={run(cycleHeading)}>
          <path d="M6 4v16M18 4v16M6 12h12" />
        </ToolButton>
        <ToolButton label="Code" hint="Ctrl or Cmd + E" onClick={run((v) => wrap(v, "`"))}>
          <path d="m8 6-6 6 6 6M16 6l6 6-6 6" />
        </ToolButton>
        <ToolButton label="Footnote" hint="Reference plus definition" onClick={run(insertFootnote)}>
          <path d="M4 6h10M4 12h10M4 18h7" />
          <path d="M18 5v6M21 8h-6" />
        </ToolButton>
        <span className="md-toolbar-sep" aria-hidden="true" />
        {/* The three house directives, as icons in the same row. They were
            text buttons, which made the toolbar wrap to two lines at the
            editor's real width and read as a second, different toolbar. */}
        {(Object.keys(SCAFFOLDS) as ScaffoldName[]).map((name) => (
          <ToolButton
            key={name}
            label={SCAFFOLDS[name].label}
            hint={SCAFFOLDS[name].hint}
            onClick={() => scaffold(name)}
          >
            {SCAFFOLD_GLYPHS[name]}
          </ToolButton>
        ))}
          <span className="md-toolbar-hint muted">Type / on an empty line</span>
        </div>
      ) : null}

      <div className="md-surface" ref={host} />

      {/*
        The replacement affordance for the Insert image section this pass
        removes. Drag-drop and paste are invisible until someone tells you they
        exist, and the native file input that used to say so is gone, so the
        capability now announces itself here instead of being folklore.

        A hint, not a control: nothing to focus, nothing to activate, and it is
        `aria-hidden` because the same information reaches assistive tech
        through the toolbar's named buttons and the alt prompt that follows an
        upload. Announcing it here as well would be a third telling of one fact.
      */}
      {ready ? (
        <p className="md-hint" aria-hidden="true">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="m3 14 4-4 5 5" />
            <circle cx="15.5" cy="8.5" r="1.5" />
          </svg>
          Drop or paste an image to upload it
        </p>
      ) : null}

      {slashAt ? (
        <ul
          className="md-slash"
          style={{ top: `${slashAt.top}px`, left: `${slashAt.left}px` }}
          role="listbox"
          aria-label="Insert a block"
        >
          {(Object.keys(SCAFFOLDS) as ScaffoldName[]).map((name) => (
            <li key={name}>
              <button
                type="button"
                role="option"
                aria-selected="false"
                className="md-slash-item"
                onClick={() => scaffold(name, slashAt.from)}
              >
                <strong>{SCAFFOLDS[name].label}</strong>
                <span className="muted">{SCAFFOLDS[name].hint}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {uploadError ? (
        <p className="field-alarm" role="status">
          {uploadError}
        </p>
      ) : null}

      {upload ? (
        <div className="md-upload" role="group" aria-label="Describe the image">
          {upload.url ? (
            <img src={upload.url} alt="" className="md-upload-thumb" />
          ) : (
            <span className="muted">Uploading {upload.name}</span>
          )}
          <div className="md-upload-fields">
            <label className="field-label" htmlFor="md-upload-alt">
              Alt text, required
            </label>
            <input
              id="md-upload-alt"
              value={alt}
              onChange={(event) => setAlt(event.target.value)}
              placeholder="What the image shows"
              autoComplete="off"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  insertFigure();
                }
              }}
            />
            <div className="md-upload-actions">
              {/* Blocked until alt exists. The media policy says an image
                  inserted without alt is the one that ships without it, so the
                  insert is what waits, not a reminder to fix it later. */}
              <button
                type="button"
                className="btn"
                disabled={!upload.url || alt.trim() === ""}
                onClick={insertFigure}
              >
                Insert figure
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setUpload(null);
                  setAlt("");
                }}
              >
                Cancel
              </button>
            </div>
            {upload.url && alt.trim() === "" ? (
              <p className="field-alarm">
                The image is in the bucket. It is not in the post until it has
                alt text.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="sr-only" aria-live="polite">
        {slug ? `Editing ${slug}` : "Editing a new post"}
      </p>
    </div>
  );
}

/** An icon button whose accessible name is a real word, not a glyph. */
function ToolButton({
  label,
  hint,
  onClick,
  children,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button type="button" className="md-tool" onClick={onClick} title={`${label}. ${hint}`}>
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
        {children}
      </svg>
      <span className="sr-only">{label}</span>
    </button>
  );
}
