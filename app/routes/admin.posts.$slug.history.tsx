import { Form, Link, data, redirect } from "react-router";

import { Panel } from "~/components/admin/panel";
import { getEnv } from "~/lib/context";
import {
  getCommitPatch,
  listCommitsForPath,
  readFile,
} from "~/lib/editor/github.server";
import {
  EditorError,
  GitHubError,
  currentHead,
  savePost,
} from "~/lib/editor/publish.server";
import type { Route } from "./+types/admin.posts.$slug.history";

/**
 * Version history for one post.
 *
 * Read-heavy and admin-only. Git already holds the history, so this is a window
 * onto it: the commit list and the diffs come straight from the GitHub API over
 * the token the editor already uses.
 *
 * Restore is the one write, and it does not touch refs. It reads the file as it
 * was at an old commit and puts it through `savePost`, the same atomic path the
 * editor uses, which lands a NEW commit on top. History is never rewritten and
 * nothing is ever force pushed.
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

export async function action({ params, request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await request.formData();
  const sha = String(form.get("sha") ?? "");
  const headSha = String(form.get("headSha") ?? "");

  if (form.get("intent") !== "restore" || !sha) {
    return { error: "Nothing to restore." };
  }

  try {
    const old = await readFile(env, postPath(params.slug), sha);
    if (!old) {
      return { error: `The post does not exist at ${sha.slice(0, 7)}.` };
    }

    // The gates run again on the restored content, which is correct: an old
    // commit predating a rule should not be able to bypass it.
    await savePost(env, {
      slug: params.slug,
      raw: old.content,
      expectedHeadSha: headSha || null,
      isNew: false,
    });
    return redirect(`/admin/posts/${params.slug}/edit`);
  } catch (error) {
    if (error instanceof EditorError || error instanceof GitHubError) {
      return { error: error.message };
    }
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function diffKind(line: string) {
  if (line.startsWith("+") && !line.startsWith("+++")) return "add";
  if (line.startsWith("-") && !line.startsWith("---")) return "del";
  if (line.startsWith("@@")) return "hunk";
  return undefined;
}

export default function PostHistory({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const { slug, commits, selected, patch, headSha } = loaderData;

  return (
    <Panel
      title={`History: ${slug}`}
      description="Every commit that touched this post. Restoring writes a new commit; nothing is rewritten."
    >
      {actionData?.error ? (
        <div className="editor-problem" role="alert">
          <strong>Not restored</strong>
          <p>{actionData.error}</p>
        </div>
      ) : null}

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

                {index > 0 ? (
                  <Form method="post">
                    <input type="hidden" name="sha" value={commit.sha} />
                    <input type="hidden" name="headSha" value={headSha} />
                    <button
                      type="submit"
                      name="intent"
                      value="restore"
                      className="btn-ghost"
                    >
                      Restore this version
                    </button>
                  </Form>
                ) : null}
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
