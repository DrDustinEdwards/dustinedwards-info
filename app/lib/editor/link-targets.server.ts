import { listAllPostsForAdmin } from "~/db";

import { stateOf } from "./publish-transition.mjs";

/**
 * Every post is offered, with its state: hiding unpublished ones makes an author paste a path from
 * memory, which is where typos come from.
 */
export async function loadLinkTargets(env: Env) {
  // A failed read throws: an empty list would read as "no posts to link to".
  const rows = await listAllPostsForAdmin(env);
  const now = Date.now();
  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    state: stateOf(
      {
        draft: row.status !== "published",
        publishAt: row.publishAt ? row.publishAt.toISOString() : "",
      },
      now,
    ),
  }));
}
