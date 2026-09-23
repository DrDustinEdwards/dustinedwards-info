import { data } from "react-router";

import { timed, timingsContext } from "~/lib/timing";

import { getEnv } from "~/lib/context";
import { parsePost } from "~/lib/editor/frontmatter";
import {
  getCommitPatch,
  listCommitsForPath,
  readFile,
} from "~/lib/editor/github.server";
import { postPath } from "~/lib/content/slug.mjs";
import type { Route } from "./+types/admin.posts.$slug.revisions";

/**
 * Reading git, for the editor's revision drawer. JSON, GET, and NOTHING ELSE.
 *
 * THIS MODULE EXPORTS NO `action`, and that is the enforcement of ruling 1 rather
 * than a stylistic choice: a route with no action cannot be made to write by any
 * request, because React Router answers a POST with 405 before any code of mine
 * runs. The guarantee is structural and therefore provable from outside.
 *
 * Three questions, one route, because they are the same resource at different
 * depths and a route each would be three places to keep the path construction in
 * step.
 */

export async function loader({ params, request, context }: Route.LoaderArgs) {
  /*
   * A RESOURCE ROUTE, and instrumented anyway: it makes GitHub calls, and the
   * finding this instrumentation exists for is that the ONE loader nobody suspected
   * was the expensive one.
   */
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  /*
   * PUSHES THE MARK, DOES NOT WRITE THE HEADER: the transport stamps it from the
   * same shared array after the handler returns. The push stays because it is the
   * MEASUREMENT, and the response argument is kept so every return path still runs
   * it.
   */
  const stamp = (response: Response) => {
    if (timings) {
      timings.push({ name: "loader_total", ms: performance.now() - loaderStart });
    }
    return response;
  };
  const env = getEnv(context);
  const url = new URL(request.url);
  const sha = url.searchParams.get("sha");

  if (!sha) {
    // This branch exists for a refresh after a save rather than for first paint.
    // STATIC, because this file already imports the same module statically and five
    // others do too, so the chunk was in the graph however this line was written.
    const commits = await timed(timings, "gh_commits", () =>
      listCommitsForPath(env, postPath(params.slug)),
    );
    return stamp(Response.json({ commits }));
  }

  // A sha reaches the GitHub API, so it is checked rather than forwarded. Git
  // object names are hex; anything else is a caller error and never a lookup.
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
    // Parsed on the SERVER, so the browser is handed the same field shape the
    // editor already renders and no second frontmatter parser ships to it.
    return stamp(Response.json({ fields: parsePost(file.content) }));
  }

  const patch = await timed(timings, "gh_patch", () =>
    getCommitPatch(env, sha, postPath(params.slug)),
  );
  return stamp(Response.json({ patch: patch?.patch ?? null }));
}
