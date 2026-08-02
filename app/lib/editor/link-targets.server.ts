import { listAllPostsForAdmin } from "~/db";

import { stateOf } from "./publish-transition.mjs";

/**
 * The posts the editor's Cmd+K palette can link to.
 *
 * ONE module, because both the edit route and the new-post route need the same
 * list and a second derivation is how the two would come to disagree about
 * which posts are public.
 *
 * **Every post is offered, including the ones that are not live, and each
 * carries its state.** Offering only published posts would have been the safe
 * default and it is the wrong one: a series links forward to a part that is
 * still scheduled, and an author who cannot find it in the palette will paste
 * the path from memory instead, which is the case that actually produces a typo.
 * What must not happen is inserting a link that 404s WITHOUT SAYING SO, so the
 * state travels with the target and the palette marks it.
 *
 * `stateOf` is the editor's own transition module, the same one the edit route
 * uses to decide what its primary button says, so "published" here means
 * exactly what it means everywhere else on this plane. It reads the clock, so
 * it is called HERE, on the server, and never during a render.
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
