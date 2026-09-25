import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef, useState } from "react";

// Split out of pipeline.mjs so this browser chunk can reach it without pulling shiki in.
import { countWords, minutesForWords } from "~/lib/content/reading-time.mjs";
import { SCAFFOLDS, insertBlock, wrap, type ScaffoldName } from "./md-editor-commands";
import { EditorToolbar } from "./md-editor-toolbar";
import { useImageUpload } from "./use-image-upload";
import { looksLikeUrl, useLinkPalette } from "./use-link-palette";

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
  // Inset, because the surface clips overflow: an outside ring would be cut off (2.4.7).
  "&.cm-focused": { outline: "2px solid var(--brand)", outlineOffset: "-2px" },
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

// `state` lets the palette flag a target that is not live: linking a draft would 404 on the published page.
export type LinkTarget = {
  slug: string;
  title: string;
  state: "published" | "scheduled" | "draft";
};

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
  const { upload, setUpload, uploadError, alt, setAlt, uploadFile, insertFigure } =
    useImageUpload(viewRef);

  const [stats, setStats] = useState(() => {
    const words = countWords(value);
    return { words, minutes: minutesForWords(words) };
  });

  const {
    linkAt,
    linkQuery,
    setLinkQuery,
    linkIndex,
    setLinkIndex,
    linkInputRef,
    linkMatches,
    openLinkPalette,
    closeLinkPalette,
    insertLink,
    commitLink,
  } = useLinkPalette({ viewRef, host, linkTargets });

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
      // The label on the hidden textarea does not reach this surface, which is what has focus (4.1.2).
      EditorView.contentAttributes.of({ "aria-label": "Body, markdown" }),
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


  return (
    <div className="md-editor">
      {ready ? (
        <EditorToolbar run={run} openLinkPalette={openLinkPalette} scaffold={scaffold} />
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
            // Only while the list exists: an id that resolves to nothing is a broken reference.
            aria-controls={linkMatches.length > 0 ? "md-link-list" : undefined}
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
