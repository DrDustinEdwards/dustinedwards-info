import { Link, data } from "react-router";

import { timed, timedLoader } from "~/lib/timing";

import { Panel } from "~/components/admin/panel";
import { DiffBlock, RevisionMeta } from "~/components/admin/revision-list";
import { getEnv } from "~/lib/context";
import {
  getCommitPatch,
  listCommitsForPath,
  readFile,
} from "~/lib/editor/github.server";
import { postPath } from "~/lib/content/slug.mjs";
import type { Route } from "./+types/admin.posts.$slug.history";

export function meta({ params }: Route.MetaArgs) {
  return [
    { title: `History: ${params.slug} · Admin` },
    { name: "robots", content: "noindex" },
  ];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const path = postPath(params.slug);

  return timedLoader(context, async (timings) => {

    // The read is the 404: the commits endpoint answers a missing or deleted path with commits or an
    // empty list, never a not-found.
    const file = await timed(timings, "gh_read_file", () => readFile(env, path));
    if (!file) throw data("Not found", { status: 404 });

    const commits = await timed(timings, "gh_commits", () => listCommitsForPath(env, path));

    const selected = new URL(request.url).searchParams.get("commit");
    const patch =
      selected && commits.some((commit) => commit.sha === selected)
        ? await timed(timings, "gh_patch", () => getCommitPatch(env, selected, path))
        : null;

    const payload = {
      slug: params.slug,
      commits,
      selected,
      patch: patch?.patch ?? null,
    };

    return data(payload);
  });
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
              <RevisionMeta revision={commit} current={index === 0} />

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
              </div>

              {selected === commit.sha ? (
                patch ? (
                  <DiffBlock patch={patch} label={`Diff for ${commit.sha.slice(0, 7)}`} />
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
