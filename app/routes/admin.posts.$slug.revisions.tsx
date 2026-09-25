import { data } from "react-router";

import { timed, timedLoader } from "~/lib/timing";

import { getEnv } from "~/lib/context";
import { parsePost } from "~/lib/editor/frontmatter";
import {
  getCommitPatch,
  listCommitsForPath,
  readFile,
} from "~/lib/editor/github.server";
import { postPath } from "~/lib/content/slug.mjs";
import type { Route } from "./+types/admin.posts.$slug.revisions";

/** Exports no `action`: React Router answers a POST with 405, so no request can make this route write. */

export async function loader({ params, request, context }: Route.LoaderArgs) {
  return timedLoader(context, async (timings) => {
    const env = getEnv(context);
    const url = new URL(request.url);
    const sha = url.searchParams.get("sha");

    if (!sha) {
      const commits = await timed(timings, "gh_commits", () =>
        listCommitsForPath(env, postPath(params.slug)),
      );
      return Response.json({ commits });
    }

    // A sha reaches the GitHub API, so anything that is not hex is refused rather than forwarded.
    if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
      throw data({ error: "Not a commit id." }, { status: 400 });
    }

    if (url.searchParams.get("want") === "content") {
      const file = await timed(timings, "gh_read_file_at_sha", () =>
        readFile(env, postPath(params.slug), sha),
      );
      if (!file) {
        throw data(
          { error: `This post does not exist at ${sha.slice(0, 7)}.` },
          { status: 404 },
        );
      }
      return Response.json({ fields: parsePost(file.content) });
    }

    const patch = await timed(timings, "gh_patch", () =>
      getCommitPatch(env, sha, postPath(params.slug)),
    );
    return Response.json({ patch: patch?.patch ?? null });
  });
}
