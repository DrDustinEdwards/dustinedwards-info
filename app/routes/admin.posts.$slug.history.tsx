import { Link, data } from "react-router";

import { Panel } from "~/components/admin/panel";
import { getEnv } from "~/lib/context";
import {
  getCommitPatch,
  listCommitsForPath,
  readFile,
} from "~/lib/editor/github.server";
import { currentHead } from "~/lib/editor/publish.server";
import type { Route } from "./+types/admin.posts.$slug.history";

/**
 * Version history for one post. READ ONLY.
 *
 * Admin-only. Git already holds the history, so this is a window onto it: the
 * commit list and the diffs come straight from the GitHub API over the token
 * the editor already uses.
 *
 * **This route used to be able to restore, and that ability was removed on
 * 2026-08-02 by ruling 1 of the feature queue.** It restored by reading the
 * file at an old commit and putting it straight through `savePost`, which was
 * atomic and never rewrote history, but it was still a SECOND ROUTE THAT COULD
 * COMMIT. Ruling 1 says a restore loads a revision into the editor as unsaved
 * content and that every mutation stays on the one existing write path, so the
 * action is gone and restoring now happens in the editor's drawer, where the
 * author sees the change before deciding to keep it.
 *
 * This page therefore exports NO action at all. A POST here answers 405.
 */

const postPath = (slug: string) => `content/posts/${slug}.md`;

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `History: ${params.slug} · Admin` },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const path = postPath(params.slug);

  const file = await readFile(env, path);
  if (!file) throw data("Not found", { status: 404 });

  const commits = await listCommitsForPath(env, path);

  // One diff at a time, chosen by query param, so the page stays a plain
  // link-driven document with no client state.
  const selected = new URL(request.url).searchParams.get("commit");
  const patch =
    selected && commits.some((commit) => commit.sha === selected)
      ? await getCommitPatch(env, selected, path)
      : null;

  return {
    slug: params.slug,
    commits,
    selected,
    patch: patch?.patch ?? null,
    headSha: await currentHead(env).catch(() => ""),
  };
}

function diffKind(line: string) {
  if (line.startsWith("+") && !line.startsWith("+++")) return "add";
  if (line.startsWith("-") && !line.startsWith("---")) return "del";
  if (line.startsWith("@@")) return "hunk";
  return undefined;
}

export default function PostHistory({ loaderData }: Route.ComponentProps) {
  const { slug, commits, selected, patch } = loaderData;

  return (
    <Panel
      title={`History: ${slug}`}
      description="Every commit that touched this post. Restoring happens in the editor's drawer, where a revision loads as unsaved changes."
    >
      <p className="posts-toolbar">
        <Link to={`/admin/posts/${slug}/edit`} className="btn-ghost">
          Back to editor
        </Link>
      </p>

      {commits.length === 0 ? (
        <p className="muted">No commits found for this post.</p>
      ) : (
        <ol className="history-list">
          {commits.map((commit, index) => (
            <li key={commit.sha} className="history-entry">
              <div className="history-meta">
                <code>{commit.sha.slice(0, 7)}</code>
                <span className="history-message">{commit.message}</span>
                <span className="muted">
                  {commit.author}
                  {" · "}
                  {new Date(commit.date).toLocaleString("en-US", {
                    timeZone: "UTC",
                  })}
                  {index === 0 ? " · current" : ""}
                </span>
              </div>

              <div className="history-actions">
                <Link
                  to={
                    selected === commit.sha
                      ? `/admin/posts/${slug}/history`
                      : `/admin/posts/${slug}/history?commit=${commit.sha}`
                  }
                >
                  {selected === commit.sha ? "Hide diff" : "View diff"}
                </Link>

                {/* No restore control here any more. Ruling 1 moved restoring
                    into the editor's drawer, where it loads rather than
                    writes, and leaving a second one on this page would have
                    been a second way to commit wearing the same word. */}
              </div>

              {selected === commit.sha ? (
                patch ? (
                  <pre className="history-diff">
                    {patch.split("\n").map((line, i) => (
                      <span key={i} data-diff={diffKind(line)}>
                        {line}
                        {"\n"}
                      </span>
                    ))}
                  </pre>
                ) : (
                  <p className="muted">
                    No diff recorded for this commit.
                  </p>
                )
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
