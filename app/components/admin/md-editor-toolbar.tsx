import type { EditorView } from "@codemirror/view";

import {
  SCAFFOLDS,
  cycleHeading,
  insertFootnote,
  wrap,
  type ScaffoldName,
} from "./md-editor-commands";

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

/** The formatting buttons, the scaffold buttons and the slash hint above the markdown surface. */
export function EditorToolbar({
  run,
  openLinkPalette,
  scaffold,
}: {
  /** Wraps a command so it runs against the mounted view, and does nothing before there is one. */
  run: (fn: (view: EditorView) => void) => () => void;
  openLinkPalette: (view: EditorView) => void;
  scaffold: (name: ScaffoldName) => void;
}) {
  return (
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
