import { listAllPostsForAdmin, listBlogTags } from "~/db";
import { errorMessage } from "~/lib/error-message.mjs";
import { timed, type Timings } from "~/lib/timing";

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

/**
 * What both editors offer: the existing tags and the link targets. A failed tag read is shown,
 * never an empty list: it comes back as a sentence in `problems`, and the editor still opens.
 */
export async function loadEditorOptions(env: Env, timings: Timings | undefined) {
  const problems: string[] = [];
  const tags = await timed(timings, "d1_tags", () =>
    listBlogTags(env).catch((error: unknown) => {
      console.error("editor tags read failed", error);
      problems.push(`Existing tags could not be read, so none are suggested: ${errorMessage(error)}`);
      return [];
    }),
  );
  const linkTargets = await timed(timings, "d1_link_targets", () => loadLinkTargets(env));
  return { tagOptions: tags.map((tag) => tag.slug), linkTargets, problems };
}
