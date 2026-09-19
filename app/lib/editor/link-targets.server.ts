import { listAllPostsForAdmin } from "~/db";

import { stateOf } from "./publish-transition.mjs";

/**
 * The posts the editor's Cmd+K palette can link to.
 *
 * ONE module, because both editor routes need the same list and a second derivation is how they
 * would come to disagree about which posts are public.
 *
 * **Every post is offered, including the ones that are not live, and each carries its state.**
 * Offering only published posts is the safe default and the wrong one: an author who cannot find a
 * scheduled part pastes the path from memory, which is what produces a typo. What must not happen is
 * inserting a link that 404s WITHOUT SAYING SO.
 *
 * `stateOf` is the editor's own transition module and reads the clock, so it is called HERE, on the
 * server.
 */
export async function loadLinkTargets(env: Env) {
  const rows = await listAllPostsForAdmin(env).catch(() => []);
  const now = Date.now();
  return rows.map((row) => ({
    slug: row.slug,
    title: row.title,
    // The DB stores a status column and a date; the transition table speaks in
    // `draft` plus `publishAt`. Mapping here rather than teaching the table
    // about the schema keeps it a pure function of two facts.
    state: stateOf(
      {
        draft: row.status !== "published",
        publishAt: row.publishAt ? row.publishAt.toISOString() : "",
      },
      now,
    ),
  }));
}
