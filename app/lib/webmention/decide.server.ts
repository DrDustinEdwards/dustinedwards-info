import { decideWebmention, deleteWebmention } from "~/db";
import { purgePost } from "~/lib/cache-purge.server";
import { PolicyError, WRITE_CAPABILITIES, type Actor } from "~/lib/editor/publish-policy.mjs";

// Write and purge are one function: a forgotten purge is invisible, the page just stays stale.
// Delete also needs `destroy`: it removes the only copy of what a stranger sent. The admin page passes
// no actor because the layout middleware already refuses writes for the smoke credential.

export type MentionDecision = "approve" | "reject" | "delete";

export const MENTION_POLICIES = {
  write: "mention-decide-requires-write",
  destroy: "mention-delete-requires-admin",
} as const;

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

  // The slug comes from the statement that moved the row, so the purge names the row this call changed.
  const slug =
    decision === "delete"
      ? await deleteWebmention(env, id)
      : await decideWebmention(env, id, decision === "approve" ? "approved" : "rejected");

  // Null means nothing moved (the write only touches verified rows), so there is nothing to purge.
  if (slug) await purgePost(slug, `mention ${decision}`);

  return { changed: slug !== null, slug };
}
