import { redirect } from "react-router";

import { listAllPostsForAdmin } from "~/db";
import { applyBulkTag } from "~/lib/admin/bulk-tag";
import { postPath } from "~/lib/content/slug.mjs";
import { copySlugCandidates } from "~/lib/editor/duplicate.mjs";
import { parsePost, parseTagInput, serializePost } from "~/lib/editor/frontmatter";
import { readFile } from "~/lib/editor/github.server";
import type { Actor } from "~/lib/editor/publish-policy.mjs";
import { deletePost, regenerateAllFromRepo, savePost } from "~/lib/editor/publish.server";
import { errorMessage } from "~/lib/error-message.mjs";
import { askAvailable, pruneAskCorpus, syncAskCorpus } from "~/lib/search/ask.server";
import { readAskBudget, resetAskBudget } from "~/lib/search/ask-guard.server";

/*
 * One handler per intent of the posts list's action. The route keeps the dispatch and, for its two
 * destructive intents, the typed confirmation: check:destructive reads both off the route's own
 * action, so a handler here runs only once the route has let it.
 */

type Message = { message: string };

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
        `Re-rendered ${synced} posts from the repository` +
        (removed > 0 ? ` and removed ${removed} no longer in it` : "") +
        "." +
        unpurgedNote(unpurged),
    };
  } catch (error) {
    return {
      message: `Regenerate failed. ${errorMessage(error)}`,
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
    };
  } catch (error) {
    return {
      message: `Ask sync failed. ${errorMessage(error)}`,
    };
  }
}

/*
 * Not a back door to a first publication: the copy is written with `draft: true`, and
 * `forceFirstPublished` removes the key rather than carrying it across.
 */
export async function duplicatePost(env: Env, form: FormData, actor: Actor) {
  const slug = String(form.get("slug") ?? "");
  const file = await readFile(env, postPath(slug));
  if (!file) return { message: `No post file exists for "${slug}", so there is nothing to copy.` };
  const fields = parsePost(file.content);

  /* Probed against the repository, not D1: D1 is derived, and the file is what `savePost` refuses on. */
  let target: string | null = null;
  const candidates = copySlugCandidates(slug);
  for (const candidate of candidates) {
    if (!(await readFile(env, postPath(candidate)))) {
      target = candidate;
      break;
    }
  }
  if (!target) {
    return {
      message:
        `Could not find a free slug for a copy of "${slug}": the first ` +
        `${candidates.length} candidates are all taken. Delete some copies first.`,
    };
  }

  try {
    await savePost(env, {
      slug: target,
      raw: serializePost({ ...fields, slug: target, draft: true, firstPublished: "" }),
      isNew: true,
      actor,
    });
    return redirect(`/admin/posts/${target}/edit`);
  } catch (error) {
    return {
      message: `Duplicate failed. ${errorMessage(error)}`,
    };
  }
}

/*
 * No republish here: `first_published` is frontmatter, not a D1 column, so this list cannot tell
 * a never-published draft from a withdrawn one.
 */
export async function unpublishPost(env: Env, form: FormData, actor: Actor): Promise<Message> {
  const slug = String(form.get("slug") ?? "");
  const file = await readFile(env, postPath(slug));
  if (!file) return { message: `No post file exists for "${slug}".` };
  const fields = parsePost(file.content);
  // The committed file decides, not the rendered row: another tab may already have withdrawn it.
  if (fields.draft) return { message: `"${slug}" is already a draft. Nothing changed.` };

  try {
    const { purged } = await savePost(env, {
      slug,
      raw: serializePost({ ...fields, draft: true }),
      isNew: false,
      actor,
    });
    return {
      message:
        `Unpublished "${slug}". It is a draft now, so it is off the public site, ` +
        `the feeds and the sitemap. Republish it from its editor.` +
        unpurgedNote(purged === false ? 1 : 0),
    };
  } catch (error) {
    return {
      message: `Unpublish failed. ${errorMessage(error)}`,
    };
  }
}

/** Deletes the selection the route has confirmed, one post at a time through the per-post writer. */
export async function bulkDeletePosts(env: Env, slugs: string[], actor: Actor): Promise<Message> {
  const failed: string[] = [];
  let done = 0;
  let unpurged = 0;
  const askFailures: string[] = [];
  for (const slug of slugs) {
    try {
      const { purged, askRemoval } = await deletePost(env, { slug, actor });
      done += 1;
      if (purged === false) unpurged += 1;
      if (askRemoval && !askRemoval.ok) askFailures.push(`${slug}: ${askRemoval.message}`);
    } catch (error) {
      failed.push(`${slug}: ${errorMessage(error)}`);
    }
  }
  return {
    message:
      `Deleted ${done} of ${slugs.length}.` +
      (failed.length > 0 ? ` Failed on ${failed.join("; ")}` : "") +
      (askFailures.length > 0 ? ` Ask removal failed on ${askFailures.join("; ")}` : "") +
      unpurgedNote(unpurged),
  };
}

export async function bulkTagPosts(
  env: Env,
  form: FormData,
  slugs: string[],
  intent: "bulk-add-tag" | "bulk-remove-tag",
  actor: Actor,
): Promise<Message> {
  const failed: string[] = [];
  let unpurged = 0;

  const wanted = parseTagInput(String(form.get("tag") ?? ""))[0];
  if (!wanted) return { message: "Enter a tag first." };
  const adding = intent === "bulk-add-tag";

  // A no-op post is skipped: writing it costs a commit and rewrites frontmatter whose key order is
  // not yet canonical.
  const tally = await applyBulkTag({
    ids: slugs,
    wanted,
    adding,
    missing: "no source file",
    read: async (slug) => {
      const file = await readFile(env, postPath(slug));
      if (!file) return null;
      const fields = parsePost(file.content);
      return { item: fields, tags: fields.tags };
    },
    write: async (slug, fields, tags) => {
      const { purged } = await savePost(env, {
        slug,
        raw: serializePost({ ...fields, tags }),
        isNew: false,
        actor,
      });
      if (purged === false) unpurged += 1;
    },
  });
  const done = tally.done;
  const skipped = tally.skipped;
  failed.push(...tally.failed);

  const verb = adding ? "Tagged" : "Untagged";
  const why = adding ? "already tagged" : "not tagged";
  return {
    message:
      `${verb} ${done} with "${wanted}"` +
      (skipped > 0 ? `, skipped ${skipped} ${why}` : "") +
      "." +
      (failed.length > 0 ? ` Failed on ${failed.join("; ")}` : "") +
      unpurgedNote(unpurged),
  };
}

export async function resetAskBudgetAndReport(env: Env): Promise<Message> {
  if (!askAvailable(env)) return { message: "Ask is not enabled." };
  await resetAskBudget(env);
  const after = await readAskBudget(env);
  return { message: `Ask budget reset. ${after.count} of ${after.limit} used today.` };
}
