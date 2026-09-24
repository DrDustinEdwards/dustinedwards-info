import { useState } from "react";

import type { PostFields } from "~/lib/editor/frontmatter";

export type Revision = {
  sha: string;
  message: string;
  author: string;
  date: string;
};

// Diffs load on demand: a post with fifty commits would otherwise pull fifty patches to show none.
export function RevisionList({
  slug,
  revisions,
  onRestore,
}: {
  slug: string;
  revisions: Revision[];
  onRestore: (fields: PostFields, sha: string) => void;
}) {
  const [openSha, setOpenSha] = useState<string | null>(null);
  const [patches, setPatches] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (sha: string) => {
    setError(null);
    if (openSha === sha) {
      setOpenSha(null);
      return;
    }
    setOpenSha(sha);
    if (sha in patches) return;
    setBusy(sha);
    try {
      const response = await fetch(
        `/admin/posts/${slug}/revisions?sha=${encodeURIComponent(sha)}`,
      );
      if (!response.ok) throw new Error(`Could not read that commit (${response.status}).`);
      const body = (await response.json()) as { patch: string | null };
      setPatches((prev) => ({ ...prev, [sha]: body.patch }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setOpenSha(null);
    } finally {
      setBusy(null);
    }
  };

  const restore = async (sha: string) => {
    setError(null);
    setBusy(sha);
    try {
      const response = await fetch(
        `/admin/posts/${slug}/revisions?sha=${encodeURIComponent(sha)}&want=content`,
      );
      if (!response.ok) {
        const detail = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(detail.error ?? `Could not read that revision (${response.status}).`);
      }
      const body = (await response.json()) as { fields: PostFields };
      onRestore(body.fields, sha);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  if (revisions.length === 0) {
    return <p className="muted">No commits found for this post.</p>;
  }

  return (
    <>
      <p className="muted">
        Restoring LOADS that version into the editor as unsaved changes. Nothing
        is written until you save, and saving lands a new commit on top; history
        is never rewritten.
      </p>

      {error ? (
        <p className="editor-problem" role="alert">
          {error}
        </p>
      ) : null}

      <ol className="history-list">
        {revisions.map((revision, index) => (
          <li key={revision.sha} className="history-entry">
            <div className="history-meta">
              <code>{revision.sha.slice(0, 7)}</code>
              <span className="history-message">{revision.message}</span>
              <span className="muted">
                {revision.author}
                {" · "}
                {/* UTC, so the server render and hydration agree on which day a commit landed. */}
                {new Date(revision.date).toLocaleString("en-US", { timeZone: "UTC" })}
                {index === 0 ? " · current" : ""}
              </span>
            </div>

            <div className="history-actions">
              <button
                type="button"
                className="row-action"
                aria-expanded={openSha === revision.sha}
                onClick={() => void toggle(revision.sha)}
              >
                {openSha === revision.sha ? "Hide diff" : "View diff"}
              </button>

              {/* Not for the newest commit: that revision is the editor's current content. */}
              {index > 0 ? (
                <button
                  type="button"
                  className="row-action"
                  disabled={busy === revision.sha}
                  onClick={() => void restore(revision.sha)}
                >
                  {busy === revision.sha ? "Loading..." : "Load into editor"}
                </button>
              ) : null}
            </div>

            {openSha === revision.sha ? (
              busy === revision.sha ? (
                <p className="muted">Loading diff...</p>
              ) : patches[revision.sha] ? (
                <pre className="history-diff">
                  {(patches[revision.sha] ?? "").split("\n").map((line, i) => (
                    <span key={i} data-diff={diffKind(line)}>
                      {line}
                      {"\n"}
                    </span>
                  ))}
                </pre>
              ) : (
                <p className="muted">No diff recorded for this commit.</p>
              )
            ) : null}
          </li>
        ))}
      </ol>
    </>
  );
}

function diffKind(line: string) {
  if (line.startsWith("+") && !line.startsWith("+++")) return "add";
  if (line.startsWith("-") && !line.startsWith("---")) return "del";
  if (line.startsWith("@@")) return "hunk";
  return undefined;
}
