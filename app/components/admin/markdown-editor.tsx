import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { useEffect, useRef, useState } from "react";

// The site's ONE reading-time derivation. Split out of pipeline.mjs precisely
// so this browser chunk can reach it without pulling shiki in behind it.
import { countWords, minutesForWords } from "~/lib/content/reading-time.mjs";

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

/**
 * One post the link palette can point at.
 *
 * `state` rides along so the palette can mark a target that is not live. A
 * palette that silently inserted a link to a draft would produce a 404 on the
 * published page, which is the silent-wrong-output class this repo forbids
 * everywhere else.
 */
export type LinkTarget = {
  slug: string;
  title: string;
  state: "published" | "scheduled" | "draft";
};

/** How many matches the link palette shows at once. */
const LINK_RESULT_LIMIT = 8;

/**
 * Whether what the author typed is already a destination.
 *
 * The palette searches the site's own posts, but an author linking OUT has
 * nothing to search for, so a string that already names a destination is taken
 * literally. Covers absolute URLs, mail, site-root paths and bare fragments,
 * which is every href this blog's prose actually uses.
 */
function looksLikeUrl(text: string) {
  return /^(https?:\/\/|mailto:|\/|#)/i.test(text.trim());
}

/**
 * THE NONCE THIS DOCUMENT'S CSP WILL ACTUALLY ACCEPT.
 *
 * CodeMirror injects its StyleModule as an inline `<style>` element on mount.
 * Under an enforced `style-src` that element is refused unless it carries a
 * nonce the DOCUMENT'S OWN header names, and `EditorView.cspNonce` is the
 * facet `@codemirror/view` exposes for putting one on it.
 *
 * **READ OFF THE DOCUMENT, DELIBERATELY NOT OFF LOADER DATA, and the
 * distinction is the whole correctness argument.** The root loader does carry
 * a `nonce`, and the admin layout already uses it for the no-flash script. But
 * the root loader RE-RUNS on client-side navigation, so after a transition from
 * /admin/posts to /admin/posts/new its `nonce` is the one minted for that
 * `.data` request, which is a different value from the one in the enforced
 * header of the document still on screen. Nonces are per-request here, measured
 * (four cookie-bearing requests, four distinct nonces), so that mismatch is
 * certain rather than possible, and the editor mounts after exactly that kind
 * of navigation. The document's own nonce is the only value the document's own
 * policy accepts, and it does not change when the route does.
 *
 * The `nonce` IDL PROPERTY, not `getAttribute`. Browsers hide the content
 * attribute after parsing precisely so an injected script cannot read a nonce
 * back out of the DOM; the property is the supported way in, and it returns the
 * empty string rather than the value on elements that never had one.
 *
 * FAILS CLOSED. No carrier means no nonce means the style element is refused,
 * which is exactly today's behaviour and not worse. Fabricating a value would
 * satisfy the facet while matching no policy, which is hard rule 13's
 * substituted fallback wearing a different hat.
 */
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
  /** The site's own posts, from the route loader. Empty is a working state. */
  linkTargets?: LinkTarget[];
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

  /**
   * Words and minutes, from the CodeMirror document itself.
   *
   * Seeded from the initial value so the numbers are right before the first
   * keystroke rather than reading zero on a post that already has 2000 words.
   */
  const [stats, setStats] = useState(() => {
    const words = countWords(value);
    return { words, minutes: minutesForWords(words) };
  });

  /**
   * The link palette: where it was opened from, and what is typed into it.
   *
   * `from`/`to` are the selection AT THE MOMENT Cmd+K was pressed, captured
   * because focus is about to leave the editor for the input. Without them the
   * insertion would land wherever CodeMirror's selection happened to be after
   * the blur, which is not where the author was.
   */
  const [linkAt, setLinkAt] = useState<{
    from: number;
    to: number;
    top: number;
    left: number;
  } | null>(null);
  const [linkQuery, setLinkQuery] = useState("");
  const [linkIndex, setLinkIndex] = useState(0);
  const linkInputRef = useRef<HTMLInputElement>(null);

  /** Matches for the current query, title or slug, capped. */
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

  /** Uploads through the existing admin action, then asks for alt text. */
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

  /**
   * Opens the link palette at the cursor, seeded with any selected text.
   *
   * Seeding the QUERY with the selection is deliberate: linking the words
   * "Observable Plot" almost always means linking to the post about Observable
   * Plot, so the search has already been performed by the time the palette
   * appears. The selection is still used as the link TEXT on insert, so seeding
   * the query costs nothing if the author wanted something else.
   */
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

  /** Closes the palette and hands the editor back its selection and its focus. */
  const closeLinkPalette = () => {
    const view = viewRef.current;
    const at = linkAt;
    setLinkAt(null);
    setLinkQuery("");
    setLinkIndex(0);
    if (!view || !at) return;
    // Restore the exact range Cmd+K was pressed on, so escaping out of the
    // palette leaves the document and the cursor as they were found.
    view.dispatch({ selection: { anchor: at.from, head: at.to } });
    view.focus();
  };

  /**
   * Writes the link and puts the cursor AFTER it.
   *
   * After it rather than inside it, because the author's next keystroke is
   * almost always the sentence continuing; landing inside the label would make
   * them arrow out of their own link.
   */
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

  /** Enter, from either the input or an option. */
  const commitLink = () => {
    const typed = linkQuery.trim();
    if (looksLikeUrl(typed)) {
      insertLink(typed, typed);
      return;
    }
    const chosen = linkMatches[linkIndex];
    // Neither a URL nor a match is not an error state to report; it is simply
    // nothing to do, and the palette says so in its own empty row.
    if (chosen) insertLink(`/blog/${chosen.slug}`, chosen.title);
  };

  useEffect(() => {
    const parent = host.current;
    if (!parent || viewRef.current) return;

    const extensions: Extension[] = [
      /*
       * FIRST, because everything below this line that styles anything reaches
       * the DOM through the same injected element. `houseTheme` and
       * `syntaxHighlighting` are StyleModules too, so without this the house
       * appearance was being dropped alongside CodeMirror's base theme and only
       * `admin-editor.css` was holding the editor together.
       */
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
          // Counted from the DOCUMENT, not from the parent's copy of it, so the
          // number cannot lag a keystroke behind what is on screen. The state
          // update bails out by identity when the count has not changed, so
          // typing within a word does not re-render the component.
          const words = countWords(text);
          setStats((prev) =>
            prev.words === words ? prev : { words, minutes: minutesForWords(words) },
          );
        }
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
        // Cmd+K SEARCHES the site's own posts now, rather than inserting a
        // `](url)` stub the author then had to go and fill in from memory. A
        // typed URL still works, so nothing that used to be possible stopped
        // being possible; the stub is what went away.
        { key: "Mod-k", run: (v) => (openLinkPalette(v), true) },
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

          {/*
            WORD COUNT AND READING TIME.

            At the foot of the WRITING PANE, not in the command bar, and that is
            a placement decision rather than a convenience. The command bar
            carries the save state, which is the one thing in this view that is
            ever urgent; a number that changes on every keystroke sitting beside
            it would pull the eye away from the dirty dot forever after.

            It is not a live region. It changes constantly and announcing every
            change would make the editor unusable with a screen reader; the
            numbers are reference the author looks at when they want them, which
            is what `aria-live` is explicitly not for.
          */}
          <p className="md-stats">
            {stats.words.toLocaleString()} word{stats.words === 1 ? "" : "s"}
            {/* Nothing on an empty document: "1 min read" over a blank page is
                a number about nothing. */}
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

      {/*
        THE LINK PALETTE. Cmd+K, or the toolbar's link button.

        A search over the site's own posts, because the overwhelmingly common
        link in this corpus is to another post on it, and the author knows the
        title rather than the slug. Typing a destination still works, so the
        capability this replaced is intact.
      */}
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
              // Any keystroke invalidates the highlight: the list under it has
              // changed, so keeping the index would leave it pointing at a row
              // the author never looked at.
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
                // Stopped as well as prevented: this input sits inside the
                // editor's DOM, and an Escape that kept bubbling would reach
                // the shell and close things the author did not mean to close.
                event.preventDefault();
                event.stopPropagation();
                closeLinkPalette();
              }
            }}
            /* Clicking away is a dismissal, and it owes the editor its focus
               back exactly as Escape does. */
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
                    /* Mouse and keyboard drive the SAME highlight, so a pointer
                       moving across the list does not leave Enter pointing at a
                       different row than the one under the cursor. */
                    onMouseEnter={() => setLinkIndex(index)}
                    onClick={() => insertLink(`/blog/${target.slug}`, target.title)}
                  >
                    <strong>{target.title}</strong>
                    <span className="muted">
                      /blog/{target.slug}
                      {/* Said in WORDS, inside the option's own text, so it is
                          part of what a screen reader announces for the row
                          rather than a colour or a shape beside it. */}
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
