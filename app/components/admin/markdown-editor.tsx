import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef, useState } from "react";

// Split out of pipeline.mjs so this browser chunk can reach it without pulling shiki in.
import { countWords, minutesForWords } from "~/lib/content/reading-time.mjs";

// CodeMirror must never reach a public bundle; it stays its own chunk because it is dynamically imported.

const houseTheme = EditorView.theme({
  "&": {
    color: "var(--text)",
    backgroundColor: "var(--paper)",
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
    backgroundColor: "var(--paper)",
    color: "var(--text-disabled)",
    border: "none",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-activeLine": { backgroundColor: "var(--paper)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--paper)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--selection-bg)",
  },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--brand)" },
  ".cm-placeholder": { color: "var(--text-disabled)" },
});

const houseHighlight = HighlightStyle.define([
  { tag: tags.heading, color: "var(--text-heading)", fontWeight: "650" },
  { tag: tags.strong, color: "var(--text-heading)", fontWeight: "650" },
  { tag: tags.emphasis, color: "var(--text)", fontStyle: "italic" },
  { tag: tags.link, color: "var(--brand)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--brand)" },
  { tag: tags.monospace, color: "var(--text-accent)" },
  { tag: tags.quote, color: "var(--text-secondary)", fontStyle: "italic" },
  { tag: tags.list, color: "var(--text-secondary)" },
  { tag: tags.meta, color: "var(--text-secondary)" },
  { tag: tags.processingInstruction, color: "var(--text-secondary)" },
  { tag: tags.contentSeparator, color: "var(--text-secondary)" },
  { tag: tags.strikethrough, color: "var(--text-secondary)", textDecoration: "line-through" },
]);

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

function cycleHeading(view: EditorView) {
  const line = view.state.doc.lineAt(view.state.selection.main.head);
  const match = /^(#{2,4})\s+/.exec(line.text);
  const hashes = match?.[1] ?? "";
  const next = !hashes ? "## " : hashes.length >= 4 ? "" : `${"#".repeat(hashes.length + 1)} `;
  const strippedFrom = match ? match[0].length : 0;
  view.dispatch({
    changes: { from: line.from, to: line.from + strippedFrom, insert: next },
    scrollIntoView: true,
  });
  view.focus();
}

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
    // Land in the definition, the part that still needs writing.
    selection: { anchor: tail + `[^${n}]`.length + `\n\n[^${n}]: `.length },
    scrollIntoView: true,
  });
  view.focus();
}

// Alt is mandatory on :::chart and :::diagram and the build fails without it, so the cursor lands inside alt="".
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

// `state` lets the palette flag a target that is not live: linking a draft would 404 on the published page.
export type LinkTarget = {
  slug: string;
  title: string;
  state: "published" | "scheduled" | "draft";
};

const LINK_RESULT_LIMIT = 8;

function looksLikeUrl(text: string) {
  return /^(https?:\/\/|mailto:|\/|#)/i.test(text.trim());
}

// Read off the document, not loader data: the root loader re-runs on client navigation and mints a different nonce.
// The IDL property, not getAttribute: browsers hide the attribute after parsing so injected script cannot read it.
function documentCspNonce(): string {
  if (typeof document === "undefined") return "";
  return document.querySelector<HTMLScriptElement>("script[nonce]")?.nonce ?? "";
}

export default function MarkdownEditor({
  value,
  onChange,
  onReady,
  slug,
  placeholder,
  linkTargets = [],
}: {
  value: string;
  onChange: (next: string) => void;
  onReady: () => void;
  slug: string;
  placeholder?: string;
  linkTargets?: LinkTarget[];
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // React 19 renders a lazy component during SSR, so the chrome waits for mount or a no-script reader gets a dead toolbar.
  const [ready, setReady] = useState(false);
  const [slashAt, setSlashAt] = useState<{ from: number; top: number; left: number } | null>(null);
  const [upload, setUpload] = useState<{ url: string; name: string } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [alt, setAlt] = useState("");

  const [stats, setStats] = useState(() => {
    const words = countWords(value);
    return { words, minutes: minutesForWords(words) };
  });

  // Captured when Cmd+K is pressed, because focus leaves the editor and the selection can move after the blur.
  const [linkAt, setLinkAt] = useState<{
    from: number;
    to: number;
    top: number;
    left: number;
  } | null>(null);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkIndex, setLinkIndex] = useState(0);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const linkMatches = (() => {
    const needle = linkQuery.trim().toLowerCase();
    if (looksLikeUrl(needle)) return [];
    const pool = needle
      ? linkTargets.filter(
          (t) =>
            t.title.toLowerCase().includes(needle) || t.slug.toLowerCase().includes(needle),
        )
      : linkTargets;
    return pool.slice(0, LINK_RESULT_LIMIT);
  })();

  const uploadFile = async (file: File) => {
    setUploadError(null);
    setUpload({ url: "", name: file.name });
    const form = new FormData();
    form.set("file", file);
    const response = await fetch("/admin/media/upload", { method: "POST", body: form });
    if (!response.ok) {
      const detail = await response
        .json<{ error?: string }>()
        .catch(() => ({}) as { error?: string });
      setUpload(null);
      setUploadError(detail.error ?? `Upload failed (${response.status}).`);
      return;
    }
    const { url } = await response.json<{ url: string }>();
    setUpload({ url, name: file.name });
    setAlt("");
  };

  const openLinkPalette = (view: EditorView) => {
    const { from, to } = view.state.selection.main;
    const parent = host.current;
    const coords = view.coordsAtPos(from);
    if (!parent || !coords) return;
    const box = parent.getBoundingClientRect();
    const selected = view.state.sliceDoc(from, to);
    setLinkQuery(selected);
    setLinkIndex(0);
    setLinkAt({ from, to, top: coords.bottom - box.top, left: coords.left - box.left });
  };

  const closeLinkPalette = () => {
    const view = viewRef.current;
    const at = linkAt;
    setLinkAt(null);
    setLinkQuery("");
    setLinkIndex(0);
    if (!view || !at) return;
    view.dispatch({ selection: { anchor: at.from, head: at.to } });
    view.focus();
  };

  // The cursor lands after the link: the next keystroke is almost always the sentence continuing.
  const insertLink = (href: string, fallbackLabel: string) => {
    const view = viewRef.current;
    const at = linkAt;
    if (!view || !at) return;
    const selected = view.state.sliceDoc(at.from, at.to);
    const label = selected || fallbackLabel || href;
    const markdown = `[${label}](${href})`;
    setLinkAt(null);
    setLinkQuery("");
    setLinkIndex(0);
    view.dispatch({
      changes: { from: at.from, to: at.to, insert: markdown },
      selection: { anchor: at.from + markdown.length },
    });
    view.focus();
  };

  const commitLink = () => {
    const typed = linkQuery.trim();
    if (looksLikeUrl(typed)) {
      insertLink(typed, typed);
      return;
    }
    const chosen = linkMatches[linkIndex];
    if (chosen) insertLink(`/blog/${chosen.slug}`, chosen.title);
  };

  useEffect(() => {
    const parent = host.current;
    if (!parent || viewRef.current) return;

    const extensions: Extension[] = [
      // Without the nonce the CSP drops every injected style, CodeMirror's base theme and the house theme included.
      EditorView.cspNonce.of(documentCspNonce()),
      history(),
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(houseHighlight),
      houseTheme,
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const text = update.state.doc.toString();
          onChangeRef.current(text);
          // Counted from the document, not the parent's copy, so the number cannot lag a keystroke.
          const words = countWords(text);
          setStats((prev) =>
            prev.words === words ? prev : { words, minutes: minutesForWords(words) },
          );
        }
        if (update.docChanged || update.selectionSet) {
          // Only a lone "/" at line end: markdown is full of slashes, and a menu opening inside a URL would be unusable.
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
        { key: "Mod-k", run: (v) => (openLinkPalette(v), true) },
        { key: "Mod-e", run: (v) => (wrap(v, "`"), true) },
        // No Mod-s here: the editor shell owns Cmd+S, since it knows which transition the primary button is armed for.
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
    setReady(true);
    onReady();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mounted once: `value` is only the initial document, and re-running would rebuild the editor and lose the cursor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guarded on the text differing, or every keystroke would round-trip through the parent and reset the selection.
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
        <ToolButton
          label="Link"
          hint="Ctrl or Cmd + K, searches your posts"
          onClick={run(openLinkPalette)}
        >
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

      {/* `aria-hidden`: the same information reaches assistive tech through the named buttons
          and the alt prompt after an upload. */}
      {ready ? (
        <div className="md-foot">
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

          {/* Not a live region: it changes constantly, and announcing each change would make the
              editor unusable with a screen reader. */}
          <p className="md-stats">
            {stats.words.toLocaleString()} word{stats.words === 1 ? "" : "s"}
            {stats.words > 0 ? (
              <>
                <span className="md-stats-sep" aria-hidden="true">
                  ·
                </span>
                {stats.minutes} min read
              </>
            ) : null}
          </p>
        </div>
      ) : null}

      {/* Searches the site's own posts: the common link is to another post, and the author knows
          its title rather than its slug. */}
      {linkAt ? (
        <div
          className="md-link-palette"
          style={{ top: `${linkAt.top}px`, left: `${linkAt.left}px` }}
        >
          <input
            ref={linkInputRef}
            autoFocus
            type="text"
            className="md-link-input"
            value={linkQuery}
            placeholder="Search posts, or type a URL"
            aria-label="Search posts to link to, or type a URL"
            role="combobox"
            aria-expanded={linkMatches.length > 0}
            aria-controls="md-link-list"
            aria-activedescendant={
              linkMatches[linkIndex] ? `md-link-opt-${linkMatches[linkIndex].slug}` : undefined
            }
            onChange={(event) => {
              setLinkQuery(event.target.value);
              setLinkIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setLinkIndex((i) => (linkMatches.length ? (i + 1) % linkMatches.length : 0));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setLinkIndex((i) =>
                  linkMatches.length ? (i - 1 + linkMatches.length) % linkMatches.length : 0,
                );
              } else if (event.key === "Enter") {
                event.preventDefault();
                commitLink();
              } else if (event.key === "Escape") {
                // Stopped as well as prevented, or the Escape bubbles to the shell and closes other things.
                event.preventDefault();
                event.stopPropagation();
                closeLinkPalette();
              }
            }}
            onBlur={(event) => {
              if (event.relatedTarget instanceof HTMLElement &&
                  event.relatedTarget.closest(".md-link-palette")) {
                return;
              }
              closeLinkPalette();
            }}
          />

          {looksLikeUrl(linkQuery) ? (
            <p className="md-link-note">Enter to link to this address</p>
          ) : linkMatches.length > 0 ? (
            <ul id="md-link-list" className="md-link-list" role="listbox" aria-label="Posts">
              {linkMatches.map((target, index) => (
                <li key={target.slug}>
                  <button
                    type="button"
                    id={`md-link-opt-${target.slug}`}
                    role="option"
                    aria-selected={index === linkIndex}
                    className="md-link-item"
                    data-active={index === linkIndex ? "" : undefined}
                    onMouseEnter={() => setLinkIndex(index)}
                    onClick={() => insertLink(`/blog/${target.slug}`, target.title)}
                  >
                    <strong>{target.title}</strong>
                    <span className="muted">
                      /blog/{target.slug}
                      {/* In words inside the option text, so a screen reader announces it, not just a color. */}
                      {target.state !== "published" ? (
                        <span className="md-link-state"> not live yet ({target.state})</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="md-link-note">No posts match. Type a URL to link out.</p>
          )}
        </div>
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
              {/* Blocked until alt exists: an image inserted without alt is the one that ships without it. */}
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
