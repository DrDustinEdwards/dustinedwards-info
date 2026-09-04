import { useState } from "react";
import { Form, Link, data, redirect, useNavigation } from "react-router";

import { AdminAlert } from "~/components/admin/alert";
import { OverflowMenu } from "~/components/admin/overflow-menu";
import { Panel } from "~/components/admin/panel";
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
   * TYPE THE COUNT. Bulk delete alone sits at this rung of the friction ladder.
   *
   * The disaster this guards is a select-all reflex deleting the corpus in one
   * gesture, and the operative variable in that disaster is N. So the friction
   * must VERIFY N rather than merely pause: a confirm() is dismissed by the
   * same reflex that armed it, while typing the number cannot be satisfied
   * without reading it.
   *
   * Deliberately NOT escalated elsewhere. Single delete keeps its plain
   * confirm, and so do both retag intents, because a ladder whose every rung is
   * the same height has no rungs: confirmation used everywhere becomes
   * background noise and stops being read. Retag is reversible by its own
   * inverse; a delete is recoverable only through git.
   *
   * The count is read from `chosen` INSIDE the handler. React reattaches this
   * handler on every render, so the closure is current, but reading it here
   * rather than hoisting it keeps that true if the button is ever memoized.
   *
   * **THIS IS NO LONGER THE GATE, AND MUST NOT BECOME ONE AGAIN.** The action
   * checks the same count server-side, because a handler does not run for a
   * reader without JavaScript and the destruction did. What this function now
   * does is CARRY what the operator typed into the request, so a scripted
   * operator is asked once rather than twice; the server is what decides.
   */
  const confirmDelete = () => {
    const n = chosen.length;
    const shown = chosen.slice(0, 5);
    const rest = n - shown.length;
    const list = shown.join(", ") + (rest > 0 ? `, and ${rest} more` : "");
    const typed = prompt(
      `Delete ${n} post${n === 1 ? "" : "s"}? This removes each file and its rows.\n\n` +
        `${list}\n\nType ${n} to confirm.`,
    );
    // Cancel returns null; a mismatch returns the wrong string. Both abort here
    // as earlier feedback. A miss that DID reach the action would be refused
    // there too, which is the property that matters.
    if (typed === null) return null;
    return typed.trim();
  };

  /*
   * What the handler typed, carried in a hidden field so the ONE submission a
   * scripted operator makes already satisfies the server check. With scripting
   * off this stays empty, the action refuses, and the page renders the
   * server-side confirmation step below.
   */
  const [typedCount, setTypedCount] = useState("");

  /** What the author actually asked for, in words, for the empty state. */
  const askedFor = [
    filters.q ? `"${filters.q}"` : null,
    filters.status ? `status ${filters.status}` : null,
    filters.tag ? `tag ${filters.tag}` : null,
  ].filter(Boolean);

  return (
    <Panel
      title="Posts"
      description="Every post, drafts included. Saving commits a markdown file to main and then syncs D1."
    >
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
      <Form method="get" action="/admin/posts" className="posts-filters" role="search">
        <div className="posts-filter-field">
          <label htmlFor="posts-q">Search</label>
          <input
            id="posts-q"
            type="search"
            name={FILTER_KEYS.q}
            defaultValue={filters.q}
            placeholder="Title or slug"
            className="posts-filter-input"
          />
        </div>

        <div className="posts-filter-field">
          <label htmlFor="posts-status">Status</label>
          <select
            id="posts-status"
            name={FILTER_KEYS.status}
            defaultValue={filters.status}
            className="posts-filter-select"
          >
            <option value="">Any status</option>
            <option value="published">Published</option>
            <option value="scheduled">Scheduled</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div className="posts-filter-field">
          <label htmlFor="posts-tag">Tag</label>
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
        </div>

        <button type="submit" className="btn-ghost posts-filter-submit">
          Filter
        </button>
        {/* A LINK, not a reset button: clearing means going to the unfiltered
            URL, and a link says that and is bookmarkable. `reset` would restore
            the form's defaults, which are the CURRENT filters, so it would
            appear to do nothing. */}
        {/* `.btn-ghost`, matching the empty state's Clear, and that settles the
            fourth appearance of the a:visited specificity rule at the DESIGN
            level rather than with another `:visited` selector. A bare text link
            to an already-visited URL correctly turns claret, so the two Clears
            did not match. A ghost button carries a border, which is a
            non-colour affordance, so rule 2 exempts it from the underline and
            from visited styling and the two controls now agree. */}
        {filtered ? (
          <Link to="/admin/posts" className="btn-ghost posts-filter-clear">
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
        <p className="posts-scheduled-note">
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
        <p className="editor-notice" role="status">
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
        <form method="post" className="posts-confirm-delete">
          <h2>Re-sync the Ask corpus?</h2>
          <p>
            Every record whose key is not in this run is REMOVED from the AI
            index, and cached answers are dropped. A sync against a partial
            corpus prunes the index to whatever that corpus held. The corpus
            currently has <strong>{actionData.confirmSyncAsk}</strong> post(s).
          </p>
          <label>
            <span>
              Type <strong>1</strong> to confirm
            </span>
            <input name={CONFIRM_FIELD} autoComplete="off" inputMode="numeric" />
          </label>
          <div className="posts-confirm-actions">
            <Link to="/admin/posts" className="btn-ghost">
              Cancel
            </Link>
            <button type="submit" name="intent" value="sync-ask" className="btn-danger">
              Sync the corpus
            </button>
          </div>
        </form>
      ) : null}

      {actionData?.confirmDelete ? (
        <form method="post" className="posts-confirm-delete">
          <h2>
            Delete {actionData.confirmDelete.count} post
            {actionData.confirmDelete.count === 1 ? "" : "s"}?
          </h2>
          <p>
            This removes each file and its rows. It is recoverable only through
            git.
          </p>
          <ul>
            {actionData.confirmDelete.slugs.map((slug) => (
              <li key={slug}>
                <code>{slug}</code>
                <input type="hidden" name="slug" value={slug} />
              </li>
            ))}
          </ul>
          <label>
            <span>
              Type <strong>{actionData.confirmDelete.count}</strong> to confirm
            </span>
            <input name={CONFIRM_FIELD} autoComplete="off" inputMode="numeric" />
          </label>
          <div className="posts-confirm-actions">
            <Link to="/admin/posts" className="btn-ghost">
              Cancel
            </Link>
            <button type="submit" name="intent" value="bulk-delete" className="btn-danger">
              Delete permanently
            </button>
          </div>
        </form>
      ) : null}

      {/* Ask index drift. Surfaced here because a save is allowed to succeed
          when the Ask sync behind it fails, and the save then redirects, so
          there is nowhere else a failure could be reported. Nothing renders
          when the index is clean; the count still reaches the meta line under
          the table, where it is reference rather than a demand. */}
      {askDrifted && ask ? (
        <AdminAlert
          title="Ask index drifted"
          headingId="ask-drift"
          action={
            <Form method="post">
              <button type="submit" name="intent" value="sync-ask" className="btn">
                Sync Ask corpus
              </button>
            </Form>
          }
        >
          <p>
            {ask.missing.length} record(s) missing from the index, {ask.stale.length} stale
            item(s) left in it. Ask is answering from a corpus that no longer matches the
            site.
          </p>
        </AdminAlert>
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
            <Link to="/admin/posts" className="btn-ghost">
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
            {chosen.length > 0 ? (
              <div className="posts-bulk" role="group" aria-label="Bulk actions">
                <p className="posts-bulk-count" aria-live="polite">
                  {chosen.length} selected
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

                {/*
                  THE CONFIRMATION, CARRIED. Hidden because a scripted operator
                  already answered the prompt; the server reads this name either
                  way, and with scripting off it arrives empty and the action
                  refuses rather than deleting.
                */}
                <input type="hidden" name={CONFIRM_FIELD} defaultValue={typedCount} />

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
                  className="btn-danger"
                  onClick={(event) => {
                    const typed = confirmDelete();
                    if (typed === null) {
                      event.preventDefault();
                      return;
                    }
                    // Set it on the DOM node directly: React state written here
                    // does not reach the form before this same event submits it.
                    const field = event.currentTarget.form?.elements.namedItem(
                      CONFIRM_FIELD,
                    );
                    if (field instanceof HTMLInputElement) field.value = typed;
                    setTypedCount(typed);
                  }}
                >
                  Delete
                </button>
              </div>
            ) : null}

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
              <caption>
                {`Origin requests per post over the last ${
                  readership.status === "live" ? readership.data.windowDays : 0
                } days, sampling weighted. ` + CACHE_SENTENCE}
              </caption>
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
                  <th scope="col">Status</th>
                  <th scope="col">Title</th>
                  <th scope="col">Publish date</th>
                  {/* The honest label, matching the panel that owns this data.
                      It says what the number IS, and the caption under the
                      table says what it is not. */}
                  <th scope="col">Origin requests</th>
                  <th scope="col">Actions</th>
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
                    <td>
                    {/* Rule 1: the state is a WORD first. Colour separates the
                        three at a glance and border-style separates them again,
                        so the pill still says three different things once
                        forced-colors has taken the fill and the tint away. */}
                    <span className="status-pill" data-state={post.state}>
                      {post.state}
                    </span>
                  </td>
                  <td>
                    <Link to={`/admin/posts/${post.slug}/edit`} className="posts-title">
                      {post.title}
                    </Link>
                    {/*
                      THE HERO, MARKED. The public index promotes one featured
                      post above the others and this list could not say which,
                      so the only way to find it was to read the markdown.

                      A WORD, for the same reason the status pill is a word:
                      rule 1, and a mark carried only by colour or an icon says
                      nothing under forced-colors and nothing to a screen
                      reader. It sits next to the title rather than in the
                      status column because it is orthogonal to state: a
                      featured post can be draft, scheduled or published.
                    */}
                    {post.featured ? <span className="posts-featured">Featured</span> : null}
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
                  <td>
                    <div className="posts-actions">
                      <Link to={`/admin/posts/${post.slug}/edit`} className="row-action">
                        Edit
                      </Link>
                      {/* Only a post the public query would actually return.
                          A scheduled post is published in the database and 404s
                          on the site, so offering View for it sends the author
                          to a dead page. */}
                      {post.state === "published" ? (
                        <a
                          href={`/blog/${post.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="row-action"
                        >
                          View
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                          >
                            <path d="M15 3h6v6" />
                            <path d="M10 14 21 3" />
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                          </svg>
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                      ) : null}
                      {/*
                        UNPUBLISH, on the rows where it is a real transition.
                        A draft has nothing to withdraw, and a never-published
                        draft must not be offered anything that changes public
                        state from here at all: first publication has a ceremony
                        and it lives in the editor.

                        Associated by the `form` ATTRIBUTE, because this cell is
                        inside the bulk selection form and forms cannot nest.
                        The form itself sits below the table.
                      */}
                      {post.state === "published" || post.state === "scheduled" ? (
                        <button
                          type="submit"
                          form={rowFormId("unpublish", post.slug)}
                          name="intent"
                          value="unpublish"
                          className="row-action"
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
                        className="row-action"
                      >
                        Duplicate
                      </button>
                    </div>
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

          {/* Reference, not a demand: the numbers that describe the AI layer's
              condition sit under the thing they describe, quiet, and only the
              drift alert above ever asks for anything. */}
          {filtered || ask || budget ? (
            <p className="posts-meta">
              {/* Only when filtered. Unfiltered, "31 of 31" is noise. */}
              {filtered ? `Showing ${posts.length} of ${total} posts. ` : null}
              {ask ? `Ask index: ${ask.present} of ${ask.expected} records indexed.` : null}
              {ask && budget ? " " : null}
              {budget
                ? `Budget ${budget.count} of ${budget.limit} answers used on ${budget.day} (UTC); cached answers do not count.`
                : null}
            </p>
          ) : null}
        </div>
      )}
    </Panel>
  );
}
