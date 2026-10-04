import { Fragment } from "react";
import { Link, data } from "react-router";

import { timed, timedLoader } from "~/lib/timing";

import { Empty } from "capsomer/react/empty";
import { Panel } from "capsomer/react/panel";
import { Pill, Status } from "capsomer/react/status";
import { Row, RowList } from "capsomer/react/row-list";

import { PageHead } from "~/components/admin/page-head";
import { DiffBlock } from "~/components/admin/revision-list";
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
    <div className="app-page">
      <PageHead
        crumbs={[
          { label: "Posts", href: "/admin/posts" },
          { label: slug, href: `/admin/posts/${slug}/edit` },
          { label: "History" },
        ]}
        title={`History: ${slug}`}
        lead="Every commit that touched this post. Restoring happens in the editor's drawer, where a revision loads as unsaved changes."
        actions={
          <Link to={`/admin/posts/${slug}/edit`} className="cap-btn">
            Back to editor
          </Link>
        }
      />

      {commits.length === 0 ? (
        <Empty kind="nothing-yet">No commits found for this post.</Empty>
      ) : (
        <Panel title="Commits" count={commits.length} flush>
          <RowList label="Commits">
            {commits.map((commit, index) => (
              <Fragment key={commit.sha}>
                <Row
                  title={commit.message}
                  status={<Pill variant="outline">{commit.sha.slice(0, 7)}</Pill>}
                  meta={
                    <span>
                      {commit.author}
                      {" · "}
                      {/* UTC, so the server render and hydration agree on which day a commit landed. */}
                      {new Date(commit.date).toLocaleString("en-US", { timeZone: "UTC" })}
                    </span>
                  }
                  detail={index === 0 ? <Status tone="ok">current</Status> : undefined}
                  actions={
                    <Link
                      className="cap-btn"
                      data-size="sm"
                      to={
                        selected === commit.sha
                          ? `/admin/posts/${slug}/history`
                          : `/admin/posts/${slug}/history?commit=${commit.sha}`
                      }
                    >
                      {selected === commit.sha ? "Hide diff" : "View diff"}
                    </Link>
                  }
                />
                {selected === commit.sha ? (
                  <li>
                    {patch ? (
                      <DiffBlock patch={patch} label={`Diff for ${commit.sha.slice(0, 7)}`} />
                    ) : (
                      <p className="cap-muted">No diff recorded for this commit.</p>
                    )}
                  </li>
                ) : null}
              </Fragment>
            ))}
          </RowList>
        </Panel>
      )}
    </div>
  );
}
