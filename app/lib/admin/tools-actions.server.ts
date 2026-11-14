import { regenerateAllFromRepo } from "~/lib/editor/publish.server";
import { errorMessage } from "@dustinedwards/site-runtime/log";
import { askAvailable, startAskSync } from "~/lib/search/ask.server";
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

/** Asks AI Search to read the corpus from D1 now rather than on its schedule; it indexes what changed. */
export async function syncAskIndex(env: Env): Promise<Message> {
  if (!askAvailable(env))
    return { message: "Ask is not enabled: no AI Search binding.", failed: true };
  const asked = await startAskSync(env, "asked for on /admin/tools");
  if (!asked.ok) return { message: `The sync was refused. ${asked.error}`, failed: true };
  return {
    message: asked.joined
      ? `A sync was already running (${asked.job.id}); another follows it, and saved answers are dropped when it ends.`
      : `Sync ${asked.job.id} started; saved answers are dropped when it ends.`,
  };
}

export async function resetAskBudgetAndReport(env: Env): Promise<Message> {
  if (!askAvailable(env)) return { message: "Ask is not enabled.", failed: true };
  await resetAskBudget(env);
  const after = await readAskBudget(env);
  return { message: `Ask budget reset. ${after.count} of ${after.limit} used today.` };
}
