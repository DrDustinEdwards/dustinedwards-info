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
import { postPath } from "~/lib/content/slug.mjs";
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
 * `scheduled` is DERIVED, not a column: a published row whose `publish_at` is
 * still ahead of now is live to the admin and invisible to the public, and the
 * test is the one `publiclyVisible()` runs. Derived in the LOADER because it
 * reads the clock.
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
 * The id tying a row's button to the form it submits, STATED ONCE. A browser
 * pairs them by string equality alone, so a mismatch submits the wrong form or
 * nothing, silently.
 */
function rowFormId(intent: "duplicate" | "unpublish", slug: string) {
  return `row-${intent}-${slug}`;
}

/** The three filter keys, named once so the form, the loader and the clear link agree. */
const FILTER_KEYS = { q: "q", status: "status", tag: "tag" } as const;

/**
 * The filter state, read from the URL and normalized. URL-driven is what makes
 * it work with scripting off and makes a filtered list a LINK. `status` is
 * validated, so `?status=banana` degrades to no filter rather than matching
 * nothing and looking like an empty corpus.
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
 * Rounded UP: a post going live in 30 hours is "in 2 days" and never "in 1
 * day", because the author must not read a number that has already passed.
 */
function daysUntil(publishAt: Date, now: number) {
  return Math.max(1, Math.ceil((publishAt.getTime() - now) / 86_400_000));
}

export async function loader({ request, context }: Route.LoaderArgs) {
  /*
   * Every await below is named. Unattributed time sent three earlier fixes to the
   * layout, which was the only thing marked.
   */
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const env = getEnv(context);
  const filters = readFilters(new URL(request.url).searchParams);

  /*
   * THREE INDEPENDENT READS, STARTED TOGETHER. None reads what the others write,
   * so the loader's floor is the SLOWEST of them and not their sum.
   */
  const askPromise = timed(timings, "ask_status_uncached", () =>
    context.get(askStatusContext)(),
  );
  /*
   * The catch is attached AT CREATION: a promise that rejects before anything
   * awaits it is an unhandled rejection, and starting work early creates that gap.
   * A FAILING BUDGET READ MUST NOT TAKE THE PAGE DOWN, so it resolves to null and
   * the list still renders.
   */
  const budgetPromise: Promise<Awaited<ReturnType<typeof readAskBudget>> | null> =
    askAvailable(env)
      ? timed(timings, "ask_budget_do", () => readAskBudget(env)).catch((error) => {
          console.error("ask budget read failed", error);
          return null;
        })
      : Promise.resolve(null);

  /*
   * A FOURTH INDEPENDENT READ, same group. `fetchPostReadership` never rejects,
   * it returns the error arm of `SourceResult`, so it needs no catch.
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
      // A NUMBER by the time the component sees it. Rendering from a date would read
      // the clock during render, and server and hydration would disagree near a day
      // boundary.
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

  // This is an ADMIN page, so it may await the AI layer; NO PUBLIC ROUTE EVER
  // DOES. The status comes from the layout middleware's reader, so the nav badge and
  // this alert read one listing.
  /*
   * The UNCACHED Ask reader. The nav badge has a short-TTL KV cache precisely
   * because this call's per-call variance is wide.
   */
  const ask = await askPromise;

  /*
   * Reads the ASK_BUDGET Durable Object: a network hop, and a cold object has to
   * be woken.
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
     * Counted over the WHOLE corpus, not the filtered view: what is scheduled is a
     * fact about the site and must not vanish because the author was searching.
     */
    scheduledTotal: all.filter((post) => post.state === "scheduled").length,
    /**
     * THE TAB COUNTS, off the SAME array the list is drawn from, never a second
     * query: a count and a list drawn from two predicates disagree.
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
     * The WHOLE report rather than a per-row number: only `complete` and the error
     * arm can tell a measured zero from an unasked question. Ruling 2.
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
   * WHO IS ASKING, read once for every branch. `savePost` and `deletePost`
   * require it rather than defaulting to the most privileged principal.
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
     * **CHECKED HERE.** "Sync" reads as additive and is not: `pruneAskCorpus`
     * DELETES every record this run did not upload. The typed count is 1 because how
     * many it removes cannot be known first.
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
   * DUPLICATE AS TEMPLATE. Reads the committed file, gives it a free slug, and
   * re-enters `savePost` as a NEW post: no second write path.
   *
   * IT CANNOT BE A BACK DOOR TO A FIRST PUBLICATION: the copy is written with
   * `draft: true`, so `decide()` cannot classify it as `published-first`, and
   * `forceFirstPublished` removes the key rather than carrying it across.
   */
  if (intent === "duplicate") {
    const slug = String(form.get("slug") ?? "");
    const file = await readFile(env, postPath(slug));
    if (!file) return { message: `No post file exists for "${slug}", so there is nothing to copy.` };
    const fields = parsePost(file.content);

    /*
     * Probed against the repository, not the loader's D1 rows: D1 is a DERIVED store
     * (rule 18) and the file is what `savePost` will refuse on.
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
   * UNPUBLISH FROM THE LIST. REPUBLISH IS NOT OFFERED: `first_published` is
   * frontmatter, not a D1 column, so a control here could not tell a
   * never-published draft from a withdrawn one.
   */
  if (intent === "unpublish") {
    const slug = String(form.get("slug") ?? "");
    const file = await readFile(env, postPath(slug));
    if (!file) return { message: `No post file exists for "${slug}".` };
    const fields = parsePost(file.content);
    // The COMMITTED file decides, not the row the page was rendered from: another
    // tab can describe a post already withdrawn.
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
   * Each ITERATES the per-post writer, one commit each, so every gate guarding one
   * post guards all. `expectedHeadSha` is OMITTED because each commit advances
   * head.
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
       * **THE LADDER IS ENFORCED HERE, NOT ONLY IN THE UI**: with scripting off an
       * `onClick` ceremony never runs. An unconfirmed delete is the CONFIRMATION STEP,
       * not an error. The count comes from the slugs in THIS request and never from a
       * number the form carried, so a stale page cannot authorize a delete of a
       * different size than the operator was shown.
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

    // Retag ADDS or REMOVES one tag, never replaces the set, so a mistake costs one
    // tag rather than all.
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
        // A no-op post is SKIPPED: writing it would cost a commit that changes nothing
        // and rewrite frontmatter whose key order is not yet canonical.
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
 * The status facet, FIXED and therefore tabs rather than a select. "All" is the
 * ABSENCE of the parameter, so the unfiltered list and the All tab are one URL by
 * construction.
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
   * The selection this page starts with. Empty in production, always: React Router
   * passes only loaderData, actionData, params and matches.
   *
   * It exists for `check:admin-ui`, which renders one static pass and dispatches no
   * event: without it the bulk bar never mounts under the harness and the three bulk
   * intents contribute no payload.
   */
  initialSelection = [],
}: Route.ComponentProps & { initialSelection?: string[] }) {
  const { posts, ask, budget, filters, filtered, total, scheduledTotal, tagOptions } =
    loaderData;
  /*
   * Defaulted like `readership`: `check:admin-ui` renders against fabricated
   * loader data, and a fixture written before this field existed must render zeros.
   */
  const statusCounts = loaderData.statusCounts ?? {
    all: total,
    published: 0,
    draft: 0,
    scheduled: scheduledTotal,
  };

  /**
   * Origin requests for one post's public route, or the reason there is none.
   *
   * THREE OUTCOMES, NOT INTERCHANGEABLE: a number, a measured zero, or an absence
   * with a sentence. Where the source cannot answer the number is ABSENT and the
   * panel says why, never a zero and never a dash a reader could read as one.
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
   * PENDING STATE. Every control here changes which rows come back, so every
   * navigation gets the mark: one dimmed attribute plus `aria-busy`. No spinner.
   */
  const navigation = useNavigation();
  const pending = navigation.state === "loading" && navigation.location != null;
  const askDrifted = ask ? ask.missing.length > 0 || ask.stale.length > 0 : false;

  /*
   * Selection lives in the client, which hard rule 9 exempts for the admin plane.
   * Keyed by slug, not row index, so a re-render or filter change cannot re-point it
   * at a different post.
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
   * Cancel carries the filter the operator was looking at: a bare `/admin/posts`
   * drops it and loses the view they were working in.
   */
  const cancelParams = new URLSearchParams();
  if (filters.q) cancelParams.set("q", filters.q);
  if (filters.status) cancelParams.set("status", filters.status);
  if (filters.tag) cancelParams.set("tag", filters.tag);
  const cancelQuery = cancelParams.toString();
  const cancelHref = cancelQuery ? `/admin/posts?${cancelQuery}` : "/admin/posts";

  /**
   * Initialized false so the hydration render matches the server's. The bulk bar's
   * count is meaningless without script.
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
         * THE ONE STATUS SENTENCE, and it AGREES WITH THE NOTICE below it: that is
         * about the page, this is about the site right now.
         */}
        <p className="admin-page-status">
          {`${statusCounts.all} post${statusCounts.all === 1 ? "" : "s"}, ` +
            `${statusCounts.published} published and ${statusCounts.draft} draft(s).` +
            (askDrifted && ask
              ? ` ${ask.missing.length + ask.stale.length} of them have changed since search last read them.`
              : " Search is up to date with all of them.")}
        </p>
      </div>
      {/*
       * New post is the only thing here that CREATES; the other three repair, so they
       * sit behind the overflow rather than wearing the primary action's weight.
       */}
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
          {/*
           * Kept here as well as in the drift alert: the alert does not render when the
           * index is clean, and an intent that exists only while needed cannot be run
           * pre-emptively.
           */}
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
       * A GET form: the filter state lives in the URL, so it survives a reload, is
       * linkable, is what the back button restores, and works with scripting off.
       */}
      {/*
       * TABS because status is a FIXED vocabulary of four; tag stays a select, its
       * vocabulary being whatever the corpus holds. The hidden submit keeps the tag
       * facet usable with scripting off.
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

        {/*
         * Links, so the filtered view is a URL that survives a reload and needs no
         * script. `aria-current` announces which one is on.
         */}
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
                {/*
                 * A count of ZERO renders: hiding it would make an empty facet look like a
                 * missing one. Announced as words, because a bare numeral reads as a position.
                 */}
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
       * THE SERVER-RENDERED CONFIRMATION STEP, which is the no-script path. It
       * re-carries each slug as a hidden field, and no script participates at any point.
       */}
      {/*
       * THE SYNC-ASK CONFIRMATION, same shape: the action refuses an unconfirmed run
       * and returns what is at stake, so the no-script path reaches it too.
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
          {/*
           * THE INTENT IS A FIELD, not the submitter's value: a disabled submitter sends
           * neither its name nor its value.
           */}
          <input type="hidden" name="intent" value="bulk-delete" />
          {actionData.confirmDelete.slugs.map((slug) => (
            <input key={slug} type="hidden" name="slug" value={slug} />
          ))}
        </ConfirmDialog>
      ) : null}

      {/*
       * Surfaced here because a save may succeed when the Ask sync behind it fails and
       * then redirects, so there is nowhere else to report it.
       */}
      {askDrifted && ask ? (
        /*
         * A STANDING CONDITION, so a named region and never a live one: announcing it as
         * news on every visit would interrupt a reader who came to do something else.
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
        /*
         * Two different nothings, and they must not read the same. An empty corpus is a
         * state of the site; an empty RESULT is a state of the question just asked.
         */
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
          {/*
           * One Form around the bar AND the table, so the checkboxes are its own controls:
           * a form cannot nest inside another.
           */}
          <Form method="post">
            {/*
             * ALWAYS IN THE DOCUMENT, revealed by CSS: on CLIENT state a scriptless operator
             * could tick every box with no control to act on. `:has()` asks the browser about
             * its own checkboxes.
             */}
              <div className="posts-bulk" role="group" aria-label="Actions for the selected posts">
                {/*
                 * THE COUNT IS SCRIPT-ONLY and says so by not appearing: a bar reading
                 * "0 selected" above two ticked boxes is worse than one claiming no number.
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
             * `tabindex` and the region role are what make a scrollable box usable rather
             * than merely contained: without them a keyboard reader sees the clipped columns
             * and cannot reach them.
             */}
            <div className="posts-table-scroll" tabIndex={0} role="region" aria-label="Posts table">
            <table className="posts-table" data-pending={pending || undefined} aria-busy={pending || undefined}>
              {/*
               * `CACHE_SENTENCE` itself, not a paraphrase: that would be a second copy of a
               * measured claim. Rule 17. ONE STRING, because React SSR splices comment nodes
               * between adjacent text.
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
                   * THE LABEL IS "Reads counted". check-admin-ui.mjs forbids "views", "visits",
                   * "visitors" and "traffic" here: a cached read never reaches the Worker.
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
                      {/*
                       * The state is a WORD first. Color and border-style separate the three again,
                       * so the pill still says three things once forced-colors takes the fill away.
                       */}
                      <span className="status-pill" data-state={post.state}>
                        {post.state}
                      </span>
                      {/*
                       * THE HERO, MARKED WITH A WORD: a mark carried only by color or an icon says
                       * nothing under forced-colors and nothing to a screen reader.
                       */}
                      {post.featured ? <span className="posts-featured">Featured</span> : null}
                    </span>
                    <span className="posts-slug">/{post.slug}</span>
                  </td>
                  <td className="posts-date">
                    {post.publishAt
                      ? new Date(post.publishAt).toISOString().slice(0, 10)
                      : "not set"}
                    {/*
                     * The number arrived from the loader already computed, so nothing here reads the
                     * clock.
                     */}
                    {post.scheduledInDays !== null ? (
                      <span className="posts-date-relative">
                        in {post.scheduledInDays} day{post.scheduledInDays === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </td>
                  {/*
                   * A number, a measured zero, or an absence carrying its own sentence: never a
                   * bare dash, which reads as zero.
                   */}
                  <td className="posts-readership">
                    {(() => {
                      const value = readershipFor(post.slug);
                      return "count" in value ? (
                        <span className="posts-readership-count">
                          {value.count.toLocaleString()}
                        </span>
                      ) : (
                        // The reason is the content, not a tooltip: a `title` is invisible to touch and
                        // to a screen reader that does not announce it.
                        <span className="posts-readership-absent">{value.absent}</span>
                      );
                    })()}
                  </td>
                  <td className="posts-row-actions">
                    {/*
                     * Associated by the `form` ATTRIBUTE because this cell sits inside the bulk
                     * selection form and forms cannot nest; the row forms sit below the table.
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
                       * Only where it is a real transition: a never-published draft must not be
                       * offered anything that changes public state here. First publication lives in the
                       * editor.
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
           * OUTSIDE the bulk form: forms cannot nest. THE SLUG IS A FIELD, not the
           * button's value: `check:admin-ui` reads a submitter as the intent, so the tuple
           * set would grow per post.
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
           * A DISCLOSURE rather than a `<caption>`, which a screen reader announces before
           * every row.
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
