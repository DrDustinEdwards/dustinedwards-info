import { useState } from "react";

import type { PostFields } from "~/lib/editor/frontmatter";

export type Revision = {
  sha: string;
  message: string;
  author: string;
  date: string;
};

/**
 * Version history, in the drawer, under ruling 1.
 *
 * **Restore LOADS. It does not write, and it cannot.** Selecting a revision
 * fetches that file's parsed fields with a GET and hands them to the editor as
 * unsaved changes; the editor goes dirty and the author saves, or does not.
 * There is no mutating request anywhere in this component: the only network
 * calls are `fetch` GETs to a route that exports no action, and the only commit
 * the editor can produce is the ordinary save on the one existing write path.
 *
 * That is a change from the standalone history page, which used to restore by
 * putting the old content straight through `savePost`. Ruling 1 retired that:
 * a second route that could commit was a second way to write, and the whole
 * point of the editor's architecture is that there is exactly one.
 *
 * Diffs load on demand rather than with the drawer, because a post with fifty
 * commits would otherwise pull fifty patches to show none of them.
 */
export function RevisionList({
  slug,
  revisions,
  onRestore,
}: {
  slug: string;
  revisions: Revision[];
  /** Hands the loaded revision to the editor. The editor decides what dirty means. */
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
    // Cached by sha: a diff of a commit cannot change, so re-expanding a
    // revision already fetched costs nothing.
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
                {/* UTC, and formatted from the ISO string the API returned.
                    Fixed zone so the server render and the hydration cannot
                    disagree about which day a commit landed on. */}
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

              {/*
                Never offered for the newest commit: that revision IS the
                editor's current content, so loading it would mark the post
                dirty while changing nothing.
              */}
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
                /* The EXISTING diff presentation: .history-diff plus the
                   add/del/hunk data attributes the standalone page already
                   uses. One diff convention on this site, not two. */
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

/** Same classification the standalone history page uses. */
function diffKind(line: string) {
  if (line.startsWith("+") && !line.startsWith("+++")) return "add";
  if (line.startsWith("-") && !line.startsWith("---")) return "del";
  if (line.startsWith("@@")) return "hunk";
  return undefined;
}
