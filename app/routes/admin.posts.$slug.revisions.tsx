import { data } from "react-router";

import { timed, timingsContext } from "~/lib/timing";

import { getEnv } from "~/lib/context";
import { parsePost } from "~/lib/editor/frontmatter";
import { getCommitPatch, readFile } from "~/lib/editor/github.server";
import { postPath } from "~/lib/editor/publish.server";
import type { Route } from "./+types/admin.posts.$slug.revisions";

/**
 * Reading git, for the editor's revision drawer. JSON, GET, and NOTHING ELSE.
 *
 * **This module exports no `action`, and that is the enforcement of ruling 1,
 * not a stylistic choice.** Ruling 1 says a restore LOADS a revision into the
 * editor as unsaved content and never writes, and that every mutation stays on
 * the one existing save path. A route with no action cannot be made to write by
 * any request: React Router answers a POST here with 405 before any code of
 * mine runs. The guarantee is therefore structural rather than a promise made
 * in a comment, which is what makes it provable from outside.
 *
 * It sits inside /admin, so the layout middleware has already required the
 * single-admin session before any of this executes.
 *
 * Three questions, one route, because they are the same resource at different
 * depths and a route each would be three places to keep the path construction
 * in step:
 *
 *   (no params)          the commits that touched this post
 *   ?sha=<sha>           that commit's diff against its parent
 *   ?sha=<sha>&want=content   that revision's fields, for loading into the editor
 */

export async function loader({ params, request, context }: Route.LoaderArgs) {
  /*
   * A RESOURCE ROUTE, and instrumented anyway.
   *
   * It returns raw `Response.json`, so the `headers()` export the other admin
   * routes used to carry never applied here. That sentence used to end "the
   * header is set on each Response directly", which stopped being true when the
   * per-route stamps came out: the header is written once, in `workers/app.ts`,
   * for every response on both planes.
   *
   * Marked because it makes GitHub calls and because the finding this session
   * exists for is that the ONE loader nobody suspected was the expensive one.
   */
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  /*
   * PUSHES THE MARK, DOES NOT WRITE THE HEADER. It used to do both, and the
   * write was redundant: `workers/app.ts` stamps `Server-Timing` from the same
   * shared array after the handler returns, with `set`, so this one was
   * overwritten by an identical value on every request that asked for it.
   *
   * The push stays because it is the MEASUREMENT, and it is the only place
   * `loader_total` is recorded for this route. The response argument is kept so
   * every return path still runs it: dropping it would make the mark
   * conditional on which branch returned.
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
    // The commit list is supplied by the edit route's own loader, so this
    // branch exists for a refresh after a save rather than for first paint.
    const { listCommitsForPath } = await import("~/lib/editor/github.server");
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
