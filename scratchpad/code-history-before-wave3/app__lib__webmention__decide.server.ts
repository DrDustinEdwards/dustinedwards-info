import { decideWebmention, deleteWebmention } from "~/db";
import { purgePost } from "~/lib/cache-purge.server";
import { PolicyError, WRITE_CAPABILITIES, type Actor } from "~/lib/editor/publish-policy.mjs";

/**
 * DECIDING A MENTION, AND PURGING WHAT THAT CHANGED. One door, two callers.
 *
 * ## WHY THIS EXISTS AT ALL
 *
 * The admin page did the write and the purge as two adjacent statements in
 * three branches. That was fine while it was the only caller. The operator API
 * is now a second caller, and copying "write, then purge" into it would be a
 * second place to forget the purge, in the one feature whose whole point this
 * session was proving the purge works.
 *
 * The failure that shape produces is invisible from both ends: the write
 * succeeds and reports success, and a page that is never invalidated simply
 * stays stale for ten minutes. Nothing errors. So the pair is one function and
 * the second caller cannot take only half of it.
 *
 * ## THE CAPABILITY CHECK IS THE EXISTING TABLE, NOT A NEW ONE
 *
 * `WRITE_CAPABILITIES` already answers "may this actor write" and "may this
 * actor destroy", keyed by the actor kind so a new kind is a typecheck failure
 * rather than a silent permission. Both questions are asked here:
 *
 *   approve, reject   need `write`. Reversible: the DB layer's decidable set
 *                     holds approved and rejected alongside pending precisely
 *                     so the pair is a two-way door.
 *   delete            needs `destroy` as well. It removes the only copy of what
 *                     a stranger sent; there is no repository behind this table
 *                     and no derivation that could produce the row again.
 *
 * So the SMOKE actor is refused everything here (write: false), and the
 * OPERATOR may approve and reject and may not delete, which is exactly the
 * shape `delete_post` already has and for the same reason. Nothing about that
 * mapping is new policy; it is the existing table asked two questions.
 *
 * **THE ADMIN PAGE DOES NOT PASS AN ACTOR AND DOES NOT NEED TO.** Every
 * `/admin` write is already refused for the smoke credential by the layout
 * middleware's method allowlist, before any action runs, and the only other
 * caller of that plane is the human admin. Passing an actor there would be a
 * second enforcement point for a rule that already has one. The actor argument
 * is optional and the operator path is what supplies it.
 */

/** What a caller may ask for. A fourth value is a typecheck failure. */
export type MentionDecision = "approve" | "reject" | "delete";

/** The policy names a refusal carries, so a caller can branch without matching prose. */
export const MENTION_POLICIES = {
  write: "mention-decide-requires-write",
  destroy: "mention-delete-requires-admin",
} as const;

/**
 * Apply one decision and invalidate the page it changed.
 *
 * @param env     the Worker environment
 * @param id      the mention row id
 * @param decision approve, reject or delete
 * @param actor   when present, checked against `WRITE_CAPABILITIES`
 * @returns the target slug when a row actually moved, null when none did
 */
export async function decideMention(
  env: Env,
  id: number,
  decision: MentionDecision,
  actor?: Actor,
): Promise<{ changed: boolean; slug: string | null }> {
  if (actor) {
    const may = WRITE_CAPABILITIES[actor.kind];
    if (!may.write) {
      throw new PolicyError(
        `Refused (${MENTION_POLICIES.write}): this credential is read only and may ` +
          `not decide a mention.`,
        MENTION_POLICIES.write,
      );
    }
    if (decision === "delete" && !may.destroy) {
      throw new PolicyError(
        `Refused (${MENTION_POLICIES.destroy}): deleting a mention removes the only ` +
          `copy of what somebody sent and is reserved to the human admin. Reject it ` +
          `instead, which is reversible.`,
        MENTION_POLICIES.destroy,
      );
    }
  }

  /*
   * THE WRITE RETURNS THE SLUG, which is what the purge names. Taking it from
   * the statement that moved the row rather than from a separate read is what
   * makes the purge name the row this call actually changed: a second read
   * could answer about a row the `where` clause refused.
   */
  const slug =
    decision === "delete"
      ? await deleteWebmention(env, id)
      : await decideWebmention(env, id, decision === "approve" ? "approved" : "rejected");

  /*
   * NULL MEANS NOTHING MOVED, and nothing is purged. `decideWebmention` is
   * scoped to rows that have been verified, so an unverified or failed row
   * returns null here rather than silently succeeding, and a purge for a page
   * that did not change would be a wasted call against a rate limit.
   */
  if (slug) await purgePost(slug, `mention ${decision}`);

  return { changed: slug !== null, slug };
}
