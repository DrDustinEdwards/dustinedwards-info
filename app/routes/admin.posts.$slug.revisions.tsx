import { data } from "react-router";

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
  const env = getEnv(context);
  const url = new URL(request.url);
  const sha = url.searchParams.get("sha");

  if (!sha) {
    // The commit list is supplied by the edit route's own loader, so this
    // branch exists for a refresh after a save rather than for first paint.
    const { listCommitsForPath } = await import("~/lib/editor/github.server");
    return Response.json({ commits: await listCommitsForPath(env, postPath(params.slug)) });
  }

  // A sha reaches the GitHub API, so it is checked rather than forwarded. Git
  // object names are hex; anything else is a caller error and never a lookup.
  if (!/^[0-9a-f]{7,40}$/i.test(sha)) {
    throw data({ error: "Not a commit id." }, { status: 400 });
  }

  if (url.searchParams.get("want") === "content") {
    const file = await readFile(env, postPath(params.slug), sha);
    if (!file) {
      throw data(
        { error: `This post does not exist at ${sha.slice(0, 7)}.` },
        { status: 404 },
      );
    }
    // Parsed on the SERVER, so the browser is handed the same field shape the
    // editor already renders and no second frontmatter parser ships to it.
    return Response.json({ fields: parsePost(file.content) });
  }

  const patch = await getCommitPatch(env, sha, postPath(params.slug));
  return Response.json({ patch: patch?.patch ?? null });
}
