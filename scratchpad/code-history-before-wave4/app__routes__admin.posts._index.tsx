import { useEffect, useState } from "react";
import { Form, Link, data, redirect, useNavigation } from "react-router";

import { ConfirmDialog } from "~/components/admin/confirm-dialog";
import { OverflowMenu } from "~/components/admin/overflow-menu";
import { RowMenu } from "~/components/admin/row-menu";
import { listAllPostsForAdmin, listAllPostTagsForAdmin } from "~/db";
import { adminActorContext } from "~/lib/auth.server";
import { getEnv } from "~/lib/context";
import { timed, timingsContext } from "~/lib/timing";
import { CONFIRM_FIELD, confirmationSatisfied } from "~/lib/destructive.mjs";
import { parsePost, parseTags, serializePost } from "~/lib/editor/frontmatter";
import { readFile } from "~/lib/editor/github.server";
import {
  deletePost,
  regenerateAllFromRepo,
  savePost,
} from "~/lib/editor/publish.server";
import { copySlugCandidates } from "~/lib/editor/duplicate.mjs";
import {
  CACHE_SENTENCE,
  READERSHIP_ABSENT,
  postReadershipPath,
} from "~/lib/admin/origin-requests.mjs";
import { fetchPostReadership } from "~/lib/admin/traffic.server";
import { postPath } from "~/lib/content/pipeline.mjs";
import {
  askAvailable,
  askStatusContext,
  pruneAskCorpus,
  syncAskCorpus,
} from "~/lib/search/ask.server";
import { readAskBudget, resetAskBudget } from "~/lib/search/ask-guard.server";
import type { Route } from "./+types/admin.posts._index";

export function meta() {
  return [{ title: "Posts · Admin" }, { name: "robots", content: "noindex" }];
}

/**
 * The pill's three states out of the two the database stores.
 *
 * "scheduled" is derived, not a column: `status` is only ever draft or
 * published, and a published row whose `publish_at` is still ahead of now is
 * live to the admin and invisible to the public. The test is deliberately the
 * same one `publiclyVisible()` runs, so the pill cannot claim a post is on the
 * site when the public query would hide it.
 *
 * Derived in the LOADER rather than in the component, because it reads the
 * clock. Computed during render it would be evaluated once on the server and
 * again on the client, and a post scheduled for the next few seconds would
 * hydrate into a different word than it rendered with.
 */
function statusOf(
  status: string,
  publishAt: Date | null,
  now: number,
): "published" | "scheduled" | "draft" {
  if (status !== "published") return "draft";
  if (publishAt && publishAt.getTime() > now) return "scheduled";
  return "published";
}

/**
 * The id tying a row's button to the form it submits, STATED ONCE.
 *
 * The button and the form are rendered in two different places, hundreds of
 * lines apart, and a browser resolves the pair by string equality alone: a
 * mismatch produces a button that submits the whole page's default form or
 * nothing at all, silently, with no error anywhere. One function means the two
 * spellings cannot drift.
 *
 * Slugs match `SLUG_PATTERN`, so the result is always a valid HTML id.
 */
function rowFormId(intent: "duplicate" | "unpublish", slug: string) {
  return `row-${intent}-${slug}`;
}

/** The three filter keys, named once so the form, the loader and the clear link agree. */
const FILTER_KEYS = { q: "q", status: "status", tag: "tag" } as const;

/**
 * The filter state, read from the URL and normalized.
 *
 * URL-driven rather than component state, which is what makes it work with
 * scripting off and makes a filtered list a LINK. `status` is validated against
 * the three states the pill can show, so a hand-typed `?status=banana` degrades
 * to "no status filter" rather than silently matching nothing and looking like
 * an empty corpus.
 */
function readFilters(params: URLSearchParams) {
  const status = (params.get(FILTER_KEYS.status) ?? "").trim();
  return {
    q: (params.get(FILTER_KEYS.q) ?? "").trim(),
    status: status === "published" || status === "scheduled" || status === "draft" ? status : "",
    tag: (params.get(FILTER_KEYS.tag) ?? "").trim(),
  };
}

/**
 * Days from now until a scheduled post goes live, rounded UP.
 *
 * Ceiling rather than round, because a post going live in 30 hours is "in 2
 * days" and never "in 1 day": the author must not read a number that has
 * already passed. Computed in the LOADER for the same reason `statusOf` is;
 * see the note there.
 */
function daysUntil(publishAt: Date, now: number) {
  return Math.max(1, Math.ceil((publishAt.getTime() - now) / 86_400_000));
}

export async function loader({ request, context }: Route.LoaderArgs) {
  /*
   * INSTRUMENTED 2026-08-22, and this route is why the session exists.
   *
   * It cost 1,420ms median with NOT ONE `timed()` call, while its two D1
   * queries measure 0.33 to 0.47ms IN D1. Roughly 1,400ms was unattributed, and
   * three previous fixes landed on the 90ms layout because the layout was the
   * only thing marked. Every await below now has a name.
   */
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const env = getEnv(context);
  const filters = readFilters(new URL(request.url).searchParams);

  /*
   * THREE INDEPENDENT READS, STARTED TOGETHER.
   *
   * MEASURED on production 2026-08-22, twelve samples, and the marks tiled
   * `loader_total` with a residual of EXACTLY ZERO on all twelve, which is what
   * proved they were strictly serial: d1_admin_posts 80ms + ask_status_uncached
   * 182ms + ask_budget_do 50ms = loader_total 314ms at the median.
   *
   * None of the three reads anything the others write. D1, AI Search and a
   * Durable Object are three different backends. So the loader's floor is the
   * SLOWEST of them, not their sum.
   *
   * This is the third instance of one shape in this repo: the admin layout's
   * drift and nav counts were serial, and the editor awaits five times inside
   * its returned object literal. Started here, awaited below, in the order the
   * work downstream actually needs them.
   */
  const askPromise = timed(timings, "ask_status_uncached", () =>
    context.get(askStatusContext)(),
  );
  /*
   * The catch is attached AT CREATION, not at the await. A promise that rejects
   * before anything awaits it is an unhandled rejection, and starting work
   * early is exactly what creates that gap. `askStatusReader` resolves to null
   * rather than throwing, so only this one needs it, and it keeps the same
   * "a failing budget read must not take the page down" behaviour the awaited
   * try/catch had.
   */
  const budgetPromise: Promise<Awaited<ReturnType<typeof readAskBudget>> | null> =
    askAvailable(env)
      ? timed(timings, "ask_budget_do", () => readAskBudget(env)).catch((error) => {
          console.error("ask budget read failed", error);
          return null;
        })
      : Promise.resolve(null);

  /*
   * A FOURTH INDEPENDENT READ, started here with the other three. Roadmap G.
   *
   * Analytics Engine is a fourth backend and shares nothing with D1, AI Search
   * or the budget Durable Object, so it belongs in the same concurrent group
   * and the loader's floor stays the SLOWEST of the four rather than their sum.
   * That is the property the comment above this block measured and it is why
   * this is a promise rather than an await.
   *
   * `fetchPostReadership` never rejects: it returns the error arm of
   * `SourceResult`, which is what the column renders as an absence with a
   * reason. So there is no catch here, unlike the budget read.
   */
  const readershipPromise = timed(timings, "ae_post_readership", () =>
    fetchPostReadership(env),
  );

  const [rows, tagRows] = await timed(timings, "d1_admin_posts", () =>
    Promise.all([listAllPostsForAdmin(env), listAllPostTagsForAdmin(env)]),
  );

  const tagsBySlug = new Map<string, string[]>();
  for (const row of tagRows) {
    const list = tagsBySlug.get(row.slug);
    if (list) list.push(row.tag);
    else tagsBySlug.set(row.slug, [row.tag]);
  }

  const now = Date.now();
  const all = rows.map((post) => {
    const state = statusOf(post.status, post.publishAt, now);
    return {
      ...post,
      state,
      tags: tagsBySlug.get(post.slug) ?? [],
      // Only a scheduled post has one, and it is a NUMBER by the time the
      // component sees it. Rendering "in N days" from a date in the component
      // would read the clock during render, which is the trap `statusOf`
      // already documents: the server and the hydration would disagree for any
      // post near a day boundary.
      scheduledInDays:
        state === "scheduled" && post.publishAt ? daysUntil(post.publishAt, now) : null,
    };
  });

  // Searching title AND slug, because the slug is what the author types when
  // they remember the URL and not the wording of the headline.
  const needle = filters.q.toLowerCase();
  const posts = all.filter((post) => {
    if (filters.status && post.state !== filters.status) return false;
    if (filters.tag && !post.tags.includes(filters.tag)) return false;
    if (!needle) return true;
    return (
      post.title.toLowerCase().includes(needle) || post.slug.toLowerCase().includes(needle)
    );
  });

  const filtered = Boolean(filters.q || filters.status || filters.tag);

  // Ask index drift, shown because the editor's Ask sync is allowed to fail
  // without failing the save. This is an ADMIN page, so it may await the AI
  // layer; no public route ever does.
  //
  // The status now comes from the reader the admin layout's middleware put on
  // the context, because the Posts nav badge wants the same fact and a listing
  // per consumer would be two. It still arrives in THIS route's loader data:
  // the alert owns the repair, and check:admin-ui fabricates `ask` here.
  /*
   * THE PRIME CANDIDATE, now a measurement instead of an argument.
   *
   * This is the UNCACHED Ask reader. `askDriftCount` gave the nav badge a
   * short-TTL KV cache precisely because this call's per-call variance is 46 to
   * 2,055ms measured, and that fix took it off the LAYOUT's path. This page
   * still makes it, on every load, and nothing named it until now.
   */
  const ask = await askPromise;

  /*
   * A SECOND UNMARKED AWAIT, which the diagnosis did not name: this reads the
   * ASK_BUDGET Durable Object. A DO read is a network hop and a cold object has
   * to be woken, so it is a candidate on the same footing as the Ask reader and
   * it had no more instrumentation than the other did.
   */
  const budget = await budgetPromise;

  /** Roadmap G. Awaited last of the four; it started first, with the others. */
  const readership = await readershipPromise;

  const payload = {
    posts,
    ask,
    budget,
    filters,
    filtered,
    /** The unfiltered total, so the list can say "12 of 31" honestly. */
    total: all.length,
    /**
     * The scheduled queue's headline number, counted over the WHOLE corpus and
     * not the filtered view. What is scheduled is a fact about the site, and it
     * must not disappear because the author happened to be searching.
     */
    scheduledTotal: all.filter((post) => post.state === "scheduled").length,
    /**
     * THE TAB COUNTS, off the SAME array the list is drawn from.
     *
     * Not a second query, which is the media library's recorded defect: its
     * Unused chip counted with one predicate and filtered with another, so the
     * chip and the grid disagreed. Counted over `all` rather than `posts`,
     * because a tab's job is to say how many are behind it, and a count that
     * shrank to the current filter would say nothing.
     */
    statusCounts: {
      all: all.length,
      published: all.filter((post) => post.state === "published").length,
      draft: all.filter((post) => post.state === "draft").length,
      scheduled: all.filter((post) => post.state === "scheduled").length,
    },
    /** Every tag in use, drafts included, for the filter's options. */
    tagOptions: [...new Set(tagRows.map((row) => row.tag))].sort(),
    /**
     * Origin requests by path, or the reason there are none. Roadmap G.
     *
     * The WHOLE report rather than a per-row number, because the column has to
     * tell a measured zero from an unasked question and only `complete` and the
     * error arm carry that. Flattening it to `readership[slug] ?? 0` in the
     * loader would throw away the distinction ruling 2 turns on.
     */
    readership,
  };

  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });

  // No header unless it was asked for, so the default response is byte-identical
  // to what shipped before any of this instrumentation existed.
  return data(payload);
}

export async function action({ request, context }: Route.ActionArgs) {
  const form = await request.formData();
  const env = getEnv(context);
  const intent = form.get("intent");
  /*
   * WHO IS ASKING, read once for every branch below. The layout middleware put
   * it here; `savePost` and `deletePost` require it rather than defaulting to
   * the most privileged principal, so the bulk paths say it explicitly.
   */
  const actor = context.get(adminActorContext);

  if (intent === "regenerate") {
    try {
      const { synced } = await regenerateAllFromRepo(env);
      return { message: `Re-rendered ${synced} posts from the repository.` };
    } catch (error) {
      return {
        message: `Regenerate failed. ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // Ask mode's corpus. Separate from Regenerate because they fail
  // independently: D1 is the site's search and must not be held hostage to the
  // AI index, and the AI index must never be repaired by touching D1.
  if (intent === "sync-ask") {
    if (!askAvailable(env)) {
      return { message: "Ask is not enabled: no AI Search binding." };
    }
    /*
     * **THE CONFIRMATION, CHECKED HERE. Ruled 2026-08-17.**
     *
     * "Sync" reads as additive and is not: `pruneAskCorpus` DELETES every AI
     * Search record whose key is not in the set this run uploaded, and the run
     * also drops cached answers. So a sync against a partial artifact prunes
     * the index to whatever that artifact contained, and the button sat one
     * item below Regenerate in the same menu with nothing between a mis-click
     * and that outcome.
     *
     * The count is 1 rather than the number of records at risk, for the same
     * reason as the media rebuild: how many a prune removes is not knowable
     * without running it, so a typed count would be invented precision. The
     * step states the corpus size instead, which is what is actually at stake.
     */
    const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();

    if (!confirmationSatisfied(typed, 1)) {
      // The corpus size at stake, from the store the sync will actually read.
      const posts = await listAllPostsForAdmin(env);
      return { confirmSyncAsk: posts.length };
    }

    try {
      const { uploaded, keys, cacheDropped } = await syncAskCorpus(env);
      const removed = await pruneAskCorpus(env, keys);
      return {
        message:
          `Uploaded ${uploaded} search records to AI Search` +
          (removed.length > 0 ? `, removed ${removed.length} stale item(s)` : "") +
          `, dropped ${cacheDropped} cached answer(s).`,
      };
    } catch (error) {
      return {
        message: `Ask sync failed. ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /*
   * DUPLICATE AS TEMPLATE. Section F item 3.
   *
   * Reads the committed file, gives it a free slug, and re-enters `savePost` as
   * a NEW post. There is no second write path and no copy of the frontmatter
   * logic: the copy is serialized by the same `serializePost` the editor uses,
   * so anything the editor round-trips, this round-trips.
   *
   * ## IT CANNOT BE A BACK DOOR TO A FIRST PUBLICATION, BY CONSTRUCTION
   *
   * The copy is written with `draft: true`, so `decide()` sees `wantsPublished`
   * false and cannot classify the write as `published-first` whatever the
   * source post's state was. That is the structural half. The stamping half is
   * the same call: `priorRaw` is null for a new slug and the post is a draft,
   * so `forceFirstPublished` REMOVES the key rather than carrying the original
   * one across. Clearing it here as well is belt and braces and is written down
   * as such, because a reader looking for the guarantee should find it in the
   * policy module rather than in this route's good manners.
   *
   * ## WHAT IS COPIED, AND WHY THE TITLE IS NOT TOUCHED
   *
   * Everything except the publication state. Section F asks for the same body
   * and frontmatter, and a route that also invented a title would be making an
   * editorial decision on the author's behalf in the one place they are about
   * to look anyway: the copy opens in the editor. The list tells the two apart
   * by slug, which is the field that had to change.
   */
  if (intent === "duplicate") {
    const slug = String(form.get("slug") ?? "");
    const file = await readFile(env, postPath(slug));
    if (!file) return { message: `No post file exists for "${slug}", so there is nothing to copy.` };
    const fields = parsePost(file.content);

    /*
     * The first candidate with no committed file wins. Probed against the
     * repository rather than against the loader's D1 rows, because D1 is a
     * DERIVED store (rule 18) and the file is what `savePost` will refuse on.
     * Asking the derived copy would let a row that had drifted hand out a slug
     * the commit then rejects.
     */
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
      // Straight into the editor. A duplicate exists to be edited, and landing
      // back on the list would leave the author hunting for the row they just
      // made among rows with the same title.
      return redirect(`/admin/posts/${target}/edit`);
    } catch (error) {
      return {
        message: `Duplicate failed. ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /*
   * UNPUBLISH FROM THE LIST. Section F item 4.
   *
   * THE SAME TRANSITION THE EDITOR'S "Revert to draft" MAKES, reached without
   * opening the post. No new policy and no new writer: read the committed file,
   * flip one flag, and go back through `savePost`, which is the door every
   * other write in this repo uses.
   *
   * ## WHY IT IS A READ-MODIFY-WRITE AND NOT A POST TO THE EDIT ROUTE
   *
   * The editor's unpublish carries the whole post in its payload, because the
   * author may have edited the body in the same breath. A list row carries a
   * slug and nothing else, so posting that payload to the edit route would
   * serialize a post with an empty body and destroy it. The file is the only
   * thing that knows what the post says, so the file is what gets read.
   *
   * ## NO CONFIRMATION, DELIBERATELY, and the ladder is the reason
   *
   * Bulk delete types the count and single delete confirms, because both are
   * recoverable only through git. This is reversible by its own inverse, in one
   * click, and the message says how. A ladder whose every rung is the same
   * height has no rungs, which is the argument the delete path already makes
   * here in as many words.
   *
   * `expectedHeadSha` IS OMITTED, the same no-optimistic-check path the bulk
 * operations below take and for a weaker version of the same reason. The window
 * is between this read and the commit, and what it costs is one concurrent edit
 * to the body being overwritten with the copy this action read. `commitFiles`
 * re-reads head itself, so nothing is lost from another POST; only a save this
 * action never saw could be. On a single-admin site with one editor open that
 * is a window nobody has hit, and carrying a sha from a list page rendered
 * minutes ago would refuse ordinary unpublishes for a fact the list never
 * displayed. Stated rather than left for a reader to notice.
 *
 * REPUBLISH IS NOT OFFERED ON THE LIST. `first_published` is frontmatter and
   * not a D1 column, so this loader cannot tell a never-published draft from a
   * withdrawn one without reading every file from GitHub. A republish control
   * that could not make that distinction would be a one-click first publication
   * on the rows where it is wrong, which is exactly what the ceremony reserves
   * to the editor. Republishing stays where the fact lives.
   */
  if (intent === "unpublish") {
    const slug = String(form.get("slug") ?? "");
    const file = await readFile(env, postPath(slug));
    if (!file) return { message: `No post file exists for "${slug}".` };
    const fields = parsePost(file.content);
    // The COMMITTED file decides, not the row the page was rendered from. A
    // list open in another tab can be describing a post that has already been
    // withdrawn, and writing an identical file would cost a commit that changes
    // nothing.
    if (fields.draft) return { message: `"${slug}" is already a draft. Nothing changed.` };

    try {
      await savePost(env, {
        slug,
        raw: serializePost({ ...fields, draft: true }),
        isNew: false,
        actor,
      });
      return {
        message:
          `Unpublished "${slug}". It is a draft now, so it is off the public site, ` +
          `the feeds and the sitemap. Republish it from its editor.`,
      };
    } catch (error) {
      return {
        message: `Unpublish failed. ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /*
   * BULK OPERATIONS.
   *
   * Each one ITERATES the existing per-post write function, serially, one
   * commit per post. There is no bulk commit variant and no second write path:
   * `deletePost` and `savePost` stay the only mutators, so every gate, policy
   * and side effect that guards a single post guards each of these too.
   *
   * expectedHeadSha is OMITTED, which `commitFiles` documents as the
   * no-optimistic-check path (`github.server.ts:190` treats a falsy value as
   * "do not compare"). That is correct here rather than lax: each successful
   * commit ADVANCES head, so one captured sha would refuse on iteration two by
   * construction, and `commitFiles` re-reads head itself on every call
   * (`:188`), so each iteration already builds on the current tree. Re-reading
   * `currentHead` per iteration would add a round trip and protect against
   * nothing a single-admin bulk action can hit.
   *
   * PARTIAL FAILURE IS THE DESIGN CENTRE. There is no transaction across
   * posts, so the loop continues past a failure and reports per slug. That is
   * safe because each post is an independent commit and `deletePost` throws
   * before `commitFiles` when the file is missing, so a refused post leaves
   * nothing half-written.
   */
  if (
    intent === "bulk-delete" ||
    intent === "bulk-add-tag" ||
    intent === "bulk-remove-tag"
  ) {
    const slugs = form.getAll("slug").map(String).filter(Boolean);
    if (slugs.length === 0) return { message: "Nothing selected." };

    /** Per-slug failures, so one bad post cannot hide behind a total. */
    const failed: string[] = [];
    let done = 0;
    let skipped = 0;

    if (intent === "bulk-delete") {
      /*
       * **THE TYPED-COUNT LADDER, ENFORCED HERE AND NOT ONLY IN THE UI.**
       *
       * It lived entirely in `confirmDelete()`, an `onClick` handler calling
       * `prompt()`. With scripting off the handler never ran, the button
       * submitted, and this loop deleted every selected post with no
       * confirmation at all. The ceremony was script-only while the destruction
       * was not, which is exactly the defect `empty-trash` was fixed for and
       * which survived here because that fix closed one instance and never
       * swept for siblings.
       *
       * AN UNCONFIRMED DELETE IS NOT AN ERROR, IT IS THE CONFIRMATION STEP.
       * Refusing with the slugs in hand lets the page render a real
       * server-rendered second step, so the no-script path gets a confirmation
       * rather than a dead end.
       *
       * Counted from the slugs in THIS request, never from a number the form
       * carried, so a stale page cannot authorise a delete of a different size
       * than the operator was shown.
       */
      const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();
      if (!confirmationSatisfied(typed, slugs.length)) {
        return {
          confirmDelete: { slugs, count: slugs.length, typed },
          message:
            `Nothing was deleted. ${slugs.length} post(s) are selected and the ` +
            `confirmation read ${typed || "(blank)"}. Type the count exactly to confirm.`,
        };
      }
      for (const slug of slugs) {
        try {
          await deletePost(env, { slug, actor });
          done += 1;
        } catch (error) {
          failed.push(`${slug}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      return {
        message:
          `Deleted ${done} of ${slugs.length}.` +
          (failed.length > 0 ? ` Failed on ${failed.join("; ")}` : ""),
      };
    }

    // Retag ADDS or REMOVES one tag. It never replaces the set, so a post's
    // other tags are untouched and a mistake costs one tag rather than all.
    const wanted = parseTags(String(form.get("tag") ?? ""))[0];
    if (!wanted) return { message: "Enter a tag first." };
    const adding = intent === "bulk-add-tag";

    for (const slug of slugs) {
      try {
        const file = await readFile(env, postPath(slug));
        if (!file) {
          failed.push(`${slug}: no source file`);
          continue;
        }
        const fields = parsePost(file.content);
        const has = fields.tags.includes(wanted);
        // A no-op post is SKIPPED rather than committed. Writing it anyway
        // would cost a commit that changes nothing, and would rewrite the
        // frontmatter of the two posts whose key order is not yet canonical.
        if (adding === has) {
          skipped += 1;
          continue;
        }
        const tags = adding
          ? [...fields.tags, wanted]
          : fields.tags.filter((t) => t !== wanted);
        await savePost(env, {
          slug,
          raw: serializePost({ ...fields, tags }),
          isNew: false,
          actor,
        });
        done += 1;
      } catch (error) {
        failed.push(`${slug}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const verb = adding ? "Tagged" : "Untagged";
    const why = adding ? "already tagged" : "not tagged";
    return {
      message:
        `${verb} ${done} with "${wanted}"` +
        (skipped > 0 ? `, skipped ${skipped} ${why}` : "") +
        "." +
        (failed.length > 0 ? ` Failed on ${failed.join("; ")}` : ""),
    };
  }

  if (intent === "reset-ask-budget") {
    if (!askAvailable(env)) return { message: "Ask is not enabled." };
    await resetAskBudget(env);
    const after = await readAskBudget(env);
    return { message: `Ask budget reset. ${after.count} of ${after.limit} used today.` };
  }

  return { message: null };
}

/**
 * The status facet, which is FIXED and therefore tabs rather than a select.
 *
 * `key` indexes the loader's counts and `value` is the URL parameter. "All" is
 * the ABSENCE of the parameter rather than a fifth value, so the unfiltered
 * list and the All tab are one URL by construction.
 */
const STATUS_TABS = [
  { key: "all", value: "", label: "All" },
  { key: "published", value: "published", label: "Published" },
  { key: "draft", value: "draft", label: "Drafts" },
  { key: "scheduled", value: "scheduled", label: "Scheduled" },
] as const;

export default function AdminPosts({
  loaderData,
  actionData,
  /**
   * The selection this page starts with. Empty in production, always: React
   * Router passes only loaderData, actionData, params and matches, so nothing
   * on the wire can set this.
   *
   * It exists for `check:admin-ui`, which renders one static pass and never
   * dispatches an event. Without a way to declare an initial selection the bulk
   * bar never mounts under the harness, and the three bulk intents contribute
   * no payload at all, which is how session D shipped with that gap stated.
   * scripts/lib/route-render.mjs spreads declared props last; the reasoning for
   * a prop over a fabricated loaderData field is recorded there.
   */
  initialSelection = [],
}: Route.ComponentProps & { initialSelection?: string[] }) {
  const { posts, ask, budget, filters, filtered, total, scheduledTotal, tagOptions } =
    loaderData;
  /* Defaulted for the same reason `readership` is: check:admin-ui renders this
     component against fabricated loader data, and a fixture written before this
     field existed must render zeros rather than throw. */
  const statusCounts = loaderData.statusCounts ?? {
    all: total,
    published: 0,
    draft: 0,
    scheduled: scheduledTotal,
  };

  /**
   * Origin requests for one post's public route, or the reason there is none.
   *
   * THREE OUTCOMES AND THEY ARE NOT INTERCHANGEABLE. A number, a measured zero,
   * or an absence with a sentence. Ruling 2 of the blog roadmap: where the data
   * source cannot answer, the number is ABSENT and the panel says why, never a
   * zero and never a dash a reader could read as one.
   *
   * The measured zero is a real answer and is rendered as one: the source was
   * live, the result was complete, and this path had no origin requests in the
   * window. What it does NOT mean is that nobody read the post, which is what
   * the caveat under the table is for.
   *
   * `readership` is defaulted because `check:admin-ui` renders this component
   * against fabricated loader data, and a state written before this field
   * existed must render an honest absence rather than throw.
   */
  const readership = loaderData.readership ?? {
    status: "error" as const,
    data: null,
    message: "This view was rendered without a readership source.",
  };
  const readershipFor = (slug: string): { count: number } | { absent: string } => {
    if (readership.status === "error") {
      return { absent: READERSHIP_ABSENT.source + readership.message };
    }
    const count = readership.data.byPath[postReadershipPath(slug)];
    if (typeof count === "number") return { count };
    // Absent from the result. Complete means that is a measured zero; truncated
    // means the query never asked about this path and cannot say.
    return readership.data.complete
      ? { count: 0 }
      : { absent: READERSHIP_ABSENT.truncated };
  };

  /*
   * PENDING STATE, from the router. Every control on this page changes which
   * rows come back, so unlike /admin/media there is no display-only case to
   * exclude: any navigation here is a real fetch and all of them get the mark.
   * One attribute the stylesheet dims plus `aria-busy`. No spinner, no timer.
   */
  const navigation = useNavigation();
  const pending = navigation.state === "loading" && navigation.location != null;
  const askDrifted = ask ? ask.missing.length > 0 || ask.stale.length > 0 : false;

  /*
   * Selection lives in the client, which the admin plane is allowed (hard rule
   * 9 exempts it, and /login with it). The public plane's law is untouched.
   *
   * Keyed by slug rather than by row index so a re-render, a sort or a filter
   * change cannot silently re-point a selection at a different post. The
   * selection is deliberately NOT persisted across a filter change either: the
   * bulk bar can only ever act on what the author can currently see.
   */
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const visible = posts.map((post) => post.slug);
  const chosen = selected.filter((slug) => visible.includes(slug));
  const allShown = chosen.length > 0 && chosen.length === visible.length;

  const toggle = (slug: string) =>
    setSelected((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  /**
   * WHERE CANCEL GOES, and it carries the filter the operator was looking at.
   *
   * The confirmation used to send Cancel to a bare `/admin/posts`, which
   * silently dropped a status or tag filter the reader had set: they backed out
   * of one delete and lost the view they were working in.
   */
  const cancelParams = new URLSearchParams();
  if (filters.q) cancelParams.set("q", filters.q);
  if (filters.status) cancelParams.set("status", filters.status);
  if (filters.tag) cancelParams.set("tag", filters.tag);
  const cancelQuery = cancelParams.toString();
  const cancelHref = cancelQuery ? `/admin/posts?${cancelQuery}` : "/admin/posts";

  /**
   * Whether the client is running, for the two controls that must differ.
   *
   * Initialised false so the hydration render matches the server's. The bulk
   * bar's count is meaningless without script (nothing updates it) and the
   * server is the only thing that knows how many slugs a submission carried.
   */
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  /** What the author actually asked for, in words, for the empty state. */
  const askedFor = [
    filters.q ? `"${filters.q}"` : null,
    filters.status ? `status ${filters.status}` : null,
    filters.tag ? `tag ${filters.tag}` : null,
  ].filter(Boolean);

  return (
    <>
      <div className="admin-page-head">
        <h1>Posts</h1>
        {/*
          THE ONE STATUS SENTENCE, and it AGREES WITH THE NOTICE below it.

          Ruling 54 makes that a rule because the two drifted: the panel's
          description read "Every post, drafts included" while a drift alert
          under it said search was answering from stale text. The description
          was about the page; this is about the site right now.
        */}
        <p className="admin-page-status">
          {`${statusCounts.all} post${statusCounts.all === 1 ? "" : "s"}, ` +
            `${statusCounts.published} published and ${statusCounts.draft} draft(s).` +
            (askDrifted && ask
              ? ` ${ask.missing.length + ask.stale.length} of them have changed since search last read them.`
              : " Search is up to date with all of them.")}
        </p>
      </div>
      {/* New post is the only thing in this row that CREATES. The other three
          intents repair, so they sit behind the overflow on the far side
          rather than beside the primary action wearing the same weight. Every
          one of them submits the identical form it did before: same method,
          same intent value, same action. */}
      <div className="posts-toolbar">
        <Link to="/admin/posts/new" className="btn">
          New post
        </Link>
        <OverflowMenu label="Maintenance">
          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="regenerate"
              className="overflow-menu-item"
              data-menu-item
            >
              Regenerate all
              <span className="overflow-menu-item-hint">
                Re-render every post from the repository
              </span>
            </button>
          </Form>
          {/* Kept here as well as in the drift alert. The alert owns the repair
              when there is something to repair, but it does not render when the
              index is clean, and an intent that exists only while it is needed
              cannot be run pre-emptively. */}
          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="sync-ask"
              className="overflow-menu-item"
              data-menu-item
            >
              Sync Ask corpus
              <span className="overflow-menu-item-hint">
                Upload every search record to the AI Search instance that powers Ask
              </span>
            </button>
          </Form>
          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="reset-ask-budget"
              className="overflow-menu-item"
              data-menu-item
            >
              Reset Ask budget
              <span className="overflow-menu-item-hint">Clear today&rsquo;s Ask answer count</span>
            </button>
          </Form>
        </OverflowMenu>
      </div>

      {/*
        SEARCH AND FILTER, as a GET form.

        A GET form is the whole design: the filter state lives in the URL, so it
        survives a reload, is linkable, is what the back button restores, and
        works with scripting off with no enhancement at all. That is also why
        this is a plain <form> rather than react-router's <Form>: the browser's
        own submission already produces exactly the navigation wanted.

        It is a NEW SUBMISSION on this page and therefore a real change to
        check:admin-ui's fixture. Regenerated deliberately, with the before and
        after triples reported, per the queue's standing rule.
      */}
      {/*
        ONE FILTER ROW: the search box on the left, then the status tabs.

        THE STATUS SELECT BECAME TABS because status is a FIXED vocabulary of
        four, and a select hides three of them behind a click while a tab row
        shows all four and how many are behind each. Tag stays a select: its
        vocabulary is whatever the corpus happens to contain, so it is not a
        fixed facet and a tab per tag would grow without limit.

        NO "Filter" BUTTON. The text input submits on Enter, the tabs are links,
        and the tag select carries the visually hidden submit below, which is
        what keeps the tag facet usable with scripting off: a select cannot
        submit its own form without either a button or script, and dropping the
        button entirely would have taken the tag filter with it.
      */}
      <Form method="get" action="/admin/posts" className="posts-filters" role="search">
        <label className="sr-only" htmlFor="posts-q">
          Search titles and slugs
        </label>
        <input
          id="posts-q"
          type="search"
          name={FILTER_KEYS.q}
          defaultValue={filters.q}
          placeholder="Search titles and slugs"
          className="posts-filter-input"
        />

        {/* Links, so the filtered view is a URL: it survives a reload, it is
            linkable, the back button restores it, and it needs no script.
            `aria-current` is what announces which one is on. */}
        <nav className="posts-tabs" aria-label="Filter by status">
          {STATUS_TABS.map((tab) => {
            const on = filters.status === tab.value;
            const params = new URLSearchParams();
            if (filters.q) params.set(FILTER_KEYS.q, filters.q);
            if (filters.tag) params.set(FILTER_KEYS.tag, filters.tag);
            if (tab.value) params.set(FILTER_KEYS.status, tab.value);
            const query = params.toString();
            return (
              <Link
                key={tab.label}
                to={query ? `/admin/posts?${query}` : "/admin/posts"}
                aria-current={on ? "page" : undefined}
                className="posts-tab"
              >
                {tab.label}
                {/* A count of ZERO renders. "Scheduled 0" is a real answer to
                    the question the tab poses; hiding it would make an empty
                    facet look like a missing one. Announced as words, because
                    a bare numeral beside a label reads as a position. */}
                <span className="posts-tab-count" aria-hidden="true">
                  {statusCounts[tab.key]}
                </span>
                <span className="sr-only">
                  {`, ${statusCounts[tab.key]} post${statusCounts[tab.key] === 1 ? "" : "s"}`}
                </span>
              </Link>
            );
          })}
        </nav>

        <label className="sr-only" htmlFor="posts-tag">
          Tag
        </label>
        <select
          id="posts-tag"
          name={FILTER_KEYS.tag}
          defaultValue={filters.tag}
          className="posts-filter-select"
        >
          <option value="">Any tag</option>
          {tagOptions.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        {/* Visually hidden, never removed. Without it a scriptless reader can
            choose a tag and has no way to apply it. It carries no name, so the
            request it makes is the one this form always made. */}
        <button type="submit" className="sr-only posts-filter-submit">
          Apply the tag filter
        </button>

        {/* A LINK, not a reset button: clearing means going to the unfiltered
            URL, and a link says that and is bookmarkable. `reset` would restore
            the form's defaults, which are the CURRENT filters, so it would
            appear to do nothing. */}
        {filtered ? (
          <Link to="/admin/posts" className="btn-secondary posts-filter-clear">
            Clear
          </Link>
        ) : null}
      </Form>

      {/*
        THE SCHEDULED QUEUE, stated whenever anything is scheduled.

        It is counted over the whole corpus rather than the filtered view, and
        it links to the filtered list rather than duplicating it: what is
        scheduled is a fact about the site, and a second table would be a second
        thing to keep true. Neutral, not tinted: this is information, and rule 4
        spends the one tint per view on the drift alert.
      */}
      {scheduledTotal > 0 ? (
        <p className="admin-notice posts-scheduled-note">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          {scheduledTotal} post{scheduledTotal === 1 ? " is" : "s are"} scheduled and not yet
          public.{" "}
          <Link to={`/admin/posts?${FILTER_KEYS.status}=scheduled`}>Show the queue</Link>
        </p>
      ) : null}

      {/* This one IS a live announcement, and correctly so: it reports what the
          submit the operator just pressed did. Unlike the drift region below,
          it is news. */}
      {actionData?.message ? (
        <p className="admin-notice" role="status">
          {actionData.message}
        </p>
      ) : null}

      {/*
        THE SERVER-RENDERED CONFIRMATION STEP.

        Reached when the action refused an unconfirmed bulk delete, which is the
        no-script path: the handler that would have prompted never ran, so the
        request arrived with an empty confirmation and nothing was deleted. This
        is the second step, and it exists so the refusal is a confirmation
        rather than a dead end.

        It re-carries each slug as a hidden field, so the selection survives a
        round trip it never made as URL state, and it is an ordinary form: no
        script participates at any point.
      */}
      {/*
        THE SYNC-ASK CONFIRMATION. Same shape as the bulk-delete step below: the
        action refuses an unconfirmed run and returns what is at stake, and this
        renders it as an ordinary form so the no-script path reaches it too.
      */}
      {actionData?.confirmSyncAsk !== undefined ? (
        <ConfirmDialog
          title="Rebuild the search answer index?"
          body={
            <p>
              Every record not in this run is removed from the index, and saved
              answers are dropped. The site currently has{" "}
              <strong>{actionData.confirmSyncAsk}</strong> post(s), so that is
              what the index will hold afterwards.
            </p>
          }
          requireTyped="1"
          confirmLabel="Rebuild the index"
          cancelHref={cancelHref}
        >
          <input type="hidden" name="intent" value="sync-ask" />
        </ConfirmDialog>
      ) : null}

      {actionData?.confirmDelete ? (
        <ConfirmDialog
          title={`Delete ${actionData.confirmDelete.count} post${
            actionData.confirmDelete.count === 1 ? "" : "s"
          }`}
          body={
            <p>
              This removes each markdown file and its rows. Git still has them;
              nothing else does.
            </p>
          }
          stake={actionData.confirmDelete.slugs}
          requireTyped={String(actionData.confirmDelete.count)}
          confirmLabel="Delete permanently"
          cancelHref={cancelHref}
        >
          {/* THE INTENT IS A FIELD, not the submitter's value. The button is
              disabled until the count matches, and a disabled submitter sends
              neither its name nor its value. */}
          <input type="hidden" name="intent" value="bulk-delete" />
          {actionData.confirmDelete.slugs.map((slug) => (
            <input key={slug} type="hidden" name="slug" value={slug} />
          ))}
        </ConfirmDialog>
      ) : null}

      {/* Ask index drift. Surfaced here because a save is allowed to succeed
          when the Ask sync behind it fails, and the save then redirects, so
          there is nowhere else a failure could be reported. Nothing renders
          when the index is clean; the count still reaches the meta line under
          the table, where it is reference rather than a demand. */}
      {askDrifted && ask ? (
        /*
          A STANDING CONDITION, so a named region and never a live one. It is
          rendered into the first byte of HTML on every visit; announcing it as
          news each time would interrupt a reader who came to do something else,
          and it is not news, it is a state the site is in.

          The words say what it means for a READER of the site rather than what
          it means for the index: ruling 54 keeps "Ask index" and "corpus" off
          the operator's page.
        */
        <section className="admin-notice" data-tone="warning" aria-labelledby="ask-drift">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <div className="admin-notice-body">
            <h2 id="ask-drift">Search is answering from older text</h2>
            <p>
              {`${ask.missing.length} post(s) are missing from the answer index and ` +
                `${ask.stale.length} record(s) in it no longer match the site, so an ` +
                `answer may quote text that has changed.`}
            </p>
          </div>
          <Form method="post" className="admin-notice-action">
            <button type="submit" name="intent" value="sync-ask" className="btn">
              Rebuild the answer index
            </button>
          </Form>
        </section>
      ) : null}

      {posts.length === 0 ? (
        /* Two different nothings, and they must not read the same. An empty
           corpus is a state of the site; an empty RESULT is a state of the
           question just asked, so it repeats the question and offers the way
           back out. Reporting "no posts yet" to someone who mistyped a slug
           would be the system lying about itself. */
        filtered ? (
          <div className="posts-empty">
            <p>
              No posts match {askedFor.join(", ")}. Searched {total} post
              {total === 1 ? "" : "s"} by title and slug.
            </p>
            <Link to="/admin/posts" className="btn-secondary">
              Clear filters
            </Link>
          </div>
        ) : (
          <p className="muted">No posts yet.</p>
        )
      ) : (
        <div className="posts-card">
          {/* One Form around the bar AND the table, so the checkboxes are its
              own controls. Nesting a form inside another is invalid, which is
              why this sits here rather than wrapping the toolbar above. */}
          <Form method="post">
            {/*
              ALWAYS IN THE DOCUMENT, revealed by CSS. Ruling 54, and it closes
              a measured defect rather than a preference.

              It used to render only when `chosen.length > 0`, which is CLIENT
              state. With scripting off `onChange` never runs, `chosen` stays
              empty, and the bar never rendered at all: measured 2026-09-09 on
              the server render, `posts-bulk` absent, `bulk-delete` absent. So a
              scriptless operator could tick every checkbox and had no control
              to act on them, and the server-rendered confirmation step behind
              that control was unreachable from this page.

              `:has(.posts-check input:checked)` in admin-posts.css reveals it
              instead, which is the browser answering a question about its own
              checkboxes with no script involved. The row still submits `slug`
              per ticked box exactly as before.
            */}
              <div className="posts-bulk" role="group" aria-label="Actions for the selected posts">
                {/*
                  THE COUNT IS SCRIPT-ONLY, and says so by not appearing.
                  Nothing updates it without script, and a bar reading
                  "0 selected" above two ticked boxes is worse than a bar that
                  does not claim a number. The heading names the group either
                  way; the server counts the slugs the submission actually
                  carried, and the confirmation states that count.
                */}
                <p className="posts-bulk-count" aria-live="polite">
                  {hydrated ? `${chosen.length} selected` : "With the selected posts"}
                </p>

                <label className="posts-bulk-tag">
                  <span>Tag</span>
                  <input
                    type="text"
                    name="tag"
                    list="posts-bulk-tags"
                    autoComplete="off"
                    placeholder="tag name"
                  />
                </label>
                {/* The vocabulary the loader already ships, offered rather than
                    enforced: a new tag is legitimate. */}
                <datalist id="posts-bulk-tags">
                  {tagOptions.map((tag) => (
                    <option key={tag} value={tag} />
                  ))}
                </datalist>

                <button type="submit" name="intent" value="bulk-add-tag" className="btn">
                  Add tag
                </button>
                <button type="submit" name="intent" value="bulk-remove-tag" className="btn">
                  Remove tag
                </button>
                <button
                  type="submit"
                  name="intent"
                  value="bulk-delete"
                  className="btn-secondary"
                >
                  Delete
                </button>
              </div>

            {/*
              THE SCROLLPORT, and the table scrolls inside it so the DOCUMENT
              does not. Measured on the deployed build once the topbar stopped
              being the widest thing on the page: this table's own min-content
              is 582px, the same number the topbar had, so for as long as both
              were 582 the table was invisible behind the bar. Two independent
              defects wearing one number.

              `tabindex` and the region role are what make a scrollable box
              usable rather than merely contained: without them a keyboard
              reader can see the clipped columns and has no way to reach them.
              The label names what scrolls, because "region" alone announces
              nothing.
            */}
            <div className="posts-table-scroll" tabIndex={0} role="region" aria-label="Posts table">
            <table className="posts-table" data-pending={pending || undefined} aria-busy={pending || undefined}>
              {/*
                THE CAVEAT, and it is `CACHE_SENTENCE` itself rather than a
                second telling of it. `app/lib/admin/origin-requests.mjs` owns
                that sentence and records the probe that produced it; a
                paraphrase here would be a second copy of a measured claim,
                free to drift from the measurement. Rule 17.

                IN THE CAPTION, matching the origin-requests panel, and for the
                same reason its own gate records: a caption is the element whose
                job is to say what a number is and is not, so it is the one
                place allowed to name the thing the column is being contrasted
                against. Every label surface stays plain.

                ONE STRING, not interpolated children, because React SSR splices
                comment nodes between adjacent text nodes and anything reading
                the markup back would have to strip them first.
              */}
              <thead>
                <tr>
                  <th scope="col" className="posts-check">
                    <label className="posts-check-label">
                      <input
                        type="checkbox"
                        checked={allShown}
                        onChange={() => setSelected(allShown ? [] : visible)}
                      />
                      {/* Never the bare word "all" while a filter is active:
                          this only ever selects what is on screen. */}
                      <span className="sr-only">
                        {filtered
                          ? `Select all ${visible.length} shown`
                          : `Select all ${visible.length}`}
                      </span>
                    </label>
                  </th>
                  <th scope="col" className="posts-title-cell">Title</th>
                  <th scope="col">Published</th>
                  {/*
                    THE LABEL IS "Reads counted", and it is where two rulings meet.

                    Ruling 54 takes "origin requests" off the operator's page. The
                    copy law gated in check-admin-ui.mjs forbids "views", "visits",
                    "visitors" and "traffic" here, because a cached read never
                    reaches the Worker and any of those words would overstate
                    readership by whatever the edge served. The participle is what
                    satisfies both: plain words that CLAIM only what was counted.
                    What is not counted is the disclosure under the table.
                  */}
                  <th scope="col" className="posts-readership">Reads counted</th>
                  <th scope="col" className="posts-row-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.slug} data-selected={chosen.includes(post.slug) || undefined}>
                    <td className="posts-check">
                      <label className="posts-check-label">
                        <input
                          type="checkbox"
                          name="slug"
                          value={post.slug}
                          checked={chosen.includes(post.slug)}
                          onChange={() => toggle(post.slug)}
                        />
                        <span className="sr-only">Select {post.title}</span>
                      </label>
                    </td>
                    <td className="posts-title-cell">
                    <span className="posts-title-row">
                      <Link to={`/admin/posts/${post.slug}/edit`} className="posts-title">
                        {post.title}
                      </Link>
                      {/* Rule 1: the state is a WORD first. Colour separates the
                          three at a glance and border-style separates them again,
                          so the pill still says three different things once
                          forced-colors has taken the fill and the tint away.

                          ON the title row since ruling 54, rather than in a
                          column of its own. The reader scans titles; the state
                          they want is the state of the title they just found,
                          and a column two cells away makes them track back. */}
                      <span className="status-pill" data-state={post.state}>
                        {post.state}
                      </span>
                      {/*
                        THE HERO, MARKED. The public index promotes one featured
                        post above the others and this list could not say which,
                        so the only way to find it was to read the markdown.

                        A WORD, for the same reason the status pill is a word:
                        rule 1, and a mark carried only by colour or an icon says
                        nothing under forced-colors and nothing to a screen
                        reader. It sits beside the state rather than in it,
                        because it is orthogonal: a featured post can be draft,
                        scheduled or published.
                      */}
                      {post.featured ? <span className="posts-featured">Featured</span> : null}
                    </span>
                    <span className="posts-slug">/{post.slug}</span>
                  </td>
                  <td className="posts-date">
                    {post.publishAt
                      ? new Date(post.publishAt).toISOString().slice(0, 10)
                      : "not set"}
                    {/* The queue, per post: a scheduled row says WHEN in
                        readable terms as well as in ISO. The number arrived
                        from the loader already computed, so nothing here reads
                        the clock. */}
                    {post.scheduledInDays !== null ? (
                      <span className="posts-date-relative">
                        in {post.scheduledInDays} day{post.scheduledInDays === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </td>
                  {/*
                    ORIGIN REQUESTS for this post's public route. Roadmap G.
                    A number, a measured zero, or an absence carrying its own
                    sentence: never a bare dash, which reads as zero.
                  */}
                  <td className="posts-readership">
                    {(() => {
                      const value = readershipFor(post.slug);
                      return "count" in value ? (
                        <span className="posts-readership-count">
                          {value.count.toLocaleString()}
                        </span>
                      ) : (
                        // The reason is the content, not a tooltip: a title
                        // attribute is invisible to touch and to a screen
                        // reader that does not announce it, and this sentence
                        // is the whole point of the cell.
                        <span className="posts-readership-absent">{value.absent}</span>
                      );
                    })()}
                  </td>
                  <td className="posts-row-actions">
                    {/*
                      ONE MENU PER ROW. It used to be up to four loose buttons
                      per row, which across fifteen rows is fifty-odd controls
                      competing with the fifteen names the reader came to find.

                      Every item still submits exactly what it submitted before:
                      same method, same intent value, same form. The buttons are
                      associated by the `form` ATTRIBUTE because this cell sits
                      inside the bulk selection form and forms cannot nest; the
                      row forms themselves sit below the table.
                    */}
                    <RowMenu label={`Actions for ${post.title}`}>
                      <Link
                        to={`/admin/posts/${post.slug}/edit`}
                        className="row-menu-item"
                        data-menu-item
                      >
                        Edit
                      </Link>
                      {post.state === "published" ? (
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="row-menu-item"
                          data-menu-item
                        >
                          View on the site
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ) : null}
                      {/*
                        UNPUBLISH, on the rows where it is a real transition. A
                        draft has nothing to withdraw, and a never-published
                        draft must not be offered anything that changes public
                        state from here: first publication has a ceremony and it
                        lives in the editor.
                      */}
                      {post.state === "published" || post.state === "scheduled" ? (
                        <button
                          type="submit"
                          form={rowFormId("unpublish", post.slug)}
                          name="intent"
                          value="unpublish"
                          className="row-menu-item"
                          data-menu-item
                        >
                          Unpublish
                        </button>
                      ) : null}
                      {/* Offered on every row: a published post is the likeliest
                          template, and a draft is the likeliest thing to fork. */}
                      <button
                        type="submit"
                        form={rowFormId("duplicate", post.slug)}
                        name="intent"
                        value="duplicate"
                        className="row-menu-item"
                        data-menu-item
                      >
                        Duplicate
                      </button>
                    </RowMenu>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
            </div>
          </Form>

          {/*
            THE ROW-ACTION FORMS, one pair per post, OUTSIDE the bulk form.

            They cannot live in the cells that hold their buttons: those cells
            are inside the selection form, a form cannot nest inside another,
            and a browser drops the inner one. Same resolution the editor's
            delete button already uses, by the `form` attribute.

            ## WHY THE SLUG IS A HIDDEN FIELD AND NOT THE BUTTON'S VALUE

            One shared form per intent with `name="slug"` on each button would
            be two forms in total instead of two per row, and it would put the
            slug in the SUBMITTER. `check:admin-ui` reads a submitter's name and
            value as the intent, so the page's submission tuple set would then
            grow by one entry per post and the fixture would be describing the
            corpus rather than the request surface. The gate's media pages
            already record that trap in as many words. With the slug as a field,
            every row contributes the identical tuple and the distinct set stays
            one wide however many posts exist.

            No confirmation on either: duplicate creates a draft and changes
            nothing public, and unpublish is reversible by its own inverse. The
            typed-count ladder is reserved for what only git can undo.
          */}
          {posts.map((post) => (
            <Form
              key={`duplicate-${post.slug}`}
              id={rowFormId("duplicate", post.slug)}
              method="post"
              className="posts-row-form"
            >
              <input type="hidden" name="slug" value={post.slug} />
            </Form>
          ))}
          {posts
            .filter((post) => post.state === "published" || post.state === "scheduled")
            .map((post) => (
              <Form
                key={`unpublish-${post.slug}`}
                id={rowFormId("unpublish", post.slug)}
                method="post"
                className="posts-row-form"
              >
                <input type="hidden" name="slug" value={post.slug} />
              </Form>
            ))}

          {/*
            THE CAVEAT, AS A DISCLOSURE. It was the table's `<caption>`, which a
            screen reader announces before every row and which spent five
            sentences at the top of the page explaining a column. The closed
            summary is enough to act on; the body is for whoever wants to know
            why the number is what it is.
          */}
          <details className="posts-explain">
            <summary>What the read count includes, and what it misses</summary>
            <p>
              {`Only reads that reached the server, over the last ${
                readership.status === "live" ? readership.data.windowDays : 0
              } days, sampling weighted. ` + CACHE_SENTENCE}
            </p>
          </details>

          {/* Reference, not a demand: the numbers that describe the AI layer's
              condition sit under the thing they describe, quiet, and only the
              drift alert above ever asks for anything. */}
          {filtered || ask || budget ? (
            <p className="posts-meta">
              {/* Only when filtered. Unfiltered, "31 of 31" is noise. */}
              {filtered ? `Showing ${posts.length} of ${total} posts. ` : null}
              {ask ? `Search has read ${ask.present} of ${ask.expected} posts.` : null}
              {ask && budget ? " " : null}
              {budget
                ? `Budget ${budget.count} of ${budget.limit} answers used on ${budget.day} (UTC); cached answers do not count.`
                : null}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
