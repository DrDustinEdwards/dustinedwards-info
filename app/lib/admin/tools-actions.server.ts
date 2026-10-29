import { listAllPostsForAdmin } from "~/db";
import { regenerateAllFromRepo } from "~/lib/editor/publish.server";
import { errorMessage } from "~/lib/error-message.mjs";
import { askAvailable, pruneAskCorpus, syncAskCorpus } from "~/lib/search/ask.server";
import { readAskBudget, resetAskBudget } from "~/lib/search/ask-guard.server";

/*
 * One handler per intent of the tools page's action. The route keeps the dispatch and, for its one
 * destructive intent, the typed confirmation: check:destructive reads it off the route's own action,
 * so a handler here runs only once the route has let it.
 */

/* `failed` picks the live region: a failure interrupts as an alert, a result waits as a status. */
type Message = { message: string; failed?: true };

/** Appended when a write landed but its cache purge did not: the public pages are stale until expiry. */
function unpurgedNote(count: number) {
  return count > 0
    ? ` The cache purge failed for ${count} post(s), so public pages may show the old version until their cache expires.`
    : "";
}

export async function regeneratePosts(env: Env): Promise<Message> {
  try {
    const { synced, removed, unpurged } = await regenerateAllFromRepo(env);
    return {
      message:
        `Re-rendered ${synced} posts from their source` +
        (removed > 0 ? ` and removed ${removed} no longer in it` : "") +
        "." +
        unpurgedNote(unpurged),
    };
  } catch (error) {
    return {
      message: `Regenerate failed. ${errorMessage(error)}`,
      failed: true,
    };
  }
}

/** The post count the sync confirmation shows: what the index will hold afterwards. */
export async function askSyncConfirmCount(env: Env) {
  const posts = await listAllPostsForAdmin(env);
  return posts.length;
}

/** Runs the sync the route has confirmed: upload every record, then prune what this run did not upload. */
export async function syncAskIndex(env: Env): Promise<Message> {
  try {
    const { uploaded, keys, failed, cacheDropped } = await syncAskCorpus(env);
    const removed = await pruneAskCorpus(env, keys);
    return {
      message:
        `Uploaded ${uploaded} search records to AI Search` +
        (removed.length > 0 ? `, removed ${removed.length} stale item(s)` : "") +
        `, dropped ${cacheDropped} cached answer(s).` +
        // Named, so a transient that outlived its retries is not read as a finished sync.
        (failed.length > 0
          ? ` FAILED after retries: ${failed.map((f) => f.key).join(", ")}. Run the sync again.`
          : ""),
      ...(failed.length > 0 ? { failed: true as const } : {}),
    };
  } catch (error) {
    return {
      message: `Ask sync failed. ${errorMessage(error)}`,
      failed: true,
    };
  }
}

export async function resetAskBudgetAndReport(env: Env): Promise<Message> {
  if (!askAvailable(env)) return { message: "Ask is not enabled.", failed: true };
  await resetAskBudget(env);
  const after = await readAskBudget(env);
  return { message: `Ask budget reset. ${after.count} of ${after.limit} used today.` };
}
