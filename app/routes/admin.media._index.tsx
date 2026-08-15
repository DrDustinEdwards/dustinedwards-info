import { useEffect, useRef, useState } from "react";

import { Form, Link } from "react-router";

import { AdminAlert } from "~/components/admin/alert";
import { OverflowMenu } from "~/components/admin/overflow-menu";
import { Panel } from "~/components/admin/panel";
import {
  claimMediaKeyForDelete,
  mediaCounts,
  mediaRecord,
  mediaRefsFor,
  mediaRoleCounts,
  // `mediaUnusedCount` is no longer imported: the Unused chip is
  // gone (v6 ruling 2) and the function has no other caller. Left in `~/db`
  // rather than deleted, because the predicate it shares with the filter is
  // still the definition the usage note describes.
  mediaTagCounts,
  mediaTrashedCount,
  mediaTwins,
  restoreMediaRecord,
  setMediaTags,
  trashMediaRecord,
  trashedMediaKeys,
  upsertMediaRecord,
} from "~/db";
import { getEnv } from "~/lib/context";
import { storageOf } from "~/lib/media/classify.mjs";
import { normaliseTags, parseTags } from "~/lib/media/tags.mjs";
import { displaySummary, groupRows, hrefWith, isModified, readView } from "~/lib/media/view.mjs";
import {
  MEDIA_PAGE_SIZE,
  deleteMediaObject,
  isManagedKey,
  isViewable,
  listMedia,
  thumbUrl,
} from "~/lib/media/core.server";
import { rebuildMediaIndex } from "~/lib/media/rebuild.server";
import { resolveCitations, type MediaCitation } from "~/lib/media/resolvers.server";
import { UPLOAD_FORM_INTENT, uploadErrorSentence } from "~/lib/media/upload-contract.mjs";
import type { Route } from "./+types/admin.media._index";

/**
 * The media library. Search, browse, copy an address, and manage one asset.
 *
 * The page composes three things that stay separate underneath: the media core
 * (what is in the bucket), the media table (what we know about the image), and
 * the resolver seam (who cites it). Nothing here scans content itself.
 *
 * ## WHAT THE v1 REDESIGN CHANGED, AND WHY
 *
 * SEARCH IS THE PRIMARY CONTROL and the chips are secondary. The page led with
 * six chips and no search box, which is a filing cabinet with no index: it can
 * narrow to a group of twenty and cannot answer "the microscope one". The form
 * is a native GET borrowing the posts list pattern verbatim, so the state is the
 * URL, the back button restores it, and nothing needs script. It filters IN SQL,
 * unlike the posts list, because this page paginates: see `matchesQuery`.
 *
 * THE TILE LOST ITS FORMS AND THE PAGE GAINED A DETAIL VIEW. Every tile carried
 * an alt disclosure and a delete button, which is what made the cards 330px tall
 * and three to a row. Editing alt and deleting are per-asset work, so they moved
 * to `?key=`, and the grid became a grid.
 *
 * COPYING IS THE PAGE'S ONE JOB, so it is one visible button per tile. The old
 * subtitle told the reader to "copy the filename into a post" beside tiles that
 * offered no copy control and showed the ORIGINAL NAME rather than the address a
 * post actually needs. The button emits `object.url`, which is `/media/<key>`
 * for R2 rows and the path itself for static ones.
 *
 * REBUILD MOVED INTO THE MAINTENANCE MENU, the grammar the posts list already
 * ships, and its submission is untouched: same method, same `intent=rebuild`,
 * same empty field set. That identity is what `check:admin-ui` reads, and it is
 * the evidence that the move is presentation.
 *
 * ## THE ONE THING THAT NEEDS SCRIPT, AND ITS FALLBACK
 *
 * The clipboard has no no-script equivalent, and the admin plane is exempt from
 * the progressive enhancement law anyway. The fallback is still cheap and is
 * built rather than skipped: the filename on every tile is a link to the detail
 * view, which renders the same address in a readonly input that selects and
 * copies by hand. So a reader without script loses one click and never meets a
 * dead control.
 */

export function meta() {
  return [{ title: "Media · Admin" }, { name: "robots", content: "noindex" }];
}

/**
 * The filter vocabulary, in ONE place, used to build the chips and to read the
 * URL back. A second list would be a second answer to "is this a valid filter".
 *
 * `?role=` values are the role column verbatim; `unused` is the one view that is
 * not a role, which is why it is a member here rather than a separate parameter.
 */
const FILTERS = [
  { id: "content", label: "Content", hint: "Images and documents you can use in a post" },
  { id: "generated", label: "Generated", hint: "Social cards and diagrams, rebuilt by command" },
  { id: "brand", label: "Brand", hint: "Logos and marks the site code references" },
  { id: "icon", label: "Icons", hint: "Favicons and touch icons the browser asks for" },
  /*
   * THE UNUSED CHIP IS GONE, v6 ruling 2, and it is worth saying why rather
   * than just deleting a line.
   *
   * It read "70 of 70". The corpus has zero image references, so the chip
   * selected everything, narrowed nothing, and sat there permanently lit. A
   * filter that never filters is furniture, and an alarm that never stops is
   * not a signal.
   *
   * What was TRUE about it survives as the usage note, because the limitation
   * is real: usage means "the renderer emitted a citation", so an asset placed
   * by route code reads as uncited. Dropping the chip must not drop the caveat.
   */
] as const;

const ROLE_IDS = new Set(["content", "generated", "brand", "icon"]);

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1") || 1;

  // The picker asks for a flatter, bigger payload from this same loader, which
  // is what makes it the same listing rather than a second one.
  const picker = url.searchParams.get("picker") === "1";

  // DEFAULT TO CONTENT, which is the whole ordering fix stated as a default.
  // An empty `?role=` is not "no filter", it is the absence of the parameter;
  // `?role=all` is how the reader asks for everything. Anything unrecognised
  // falls back to the default rather than erroring, because a bad URL should
  // show a library rather than a stack trace.
  /*
   * THE WHOLE VIEW STATE, PARSED ONCE, by the module that also builds every
   * link on the page.
   *
   * The parameters used to be read here one at a time and rebuilt in the
   * component one at a time, which is how `q` fell off the pagination links and
   * `role` fell off the chips. One parse and one `hrefWith` is the repair, and
   * it is structural: a link that drops a parameter now has to be written by
   * NOT calling the only function that builds links.
   */
  const view = readView(url.searchParams);

  const requested = url.searchParams.get("role");
  const filter = requested === "all" || (requested && ROLE_IDS.has(requested))
    ? requested
    : "content";

  /** Free text. Trimmed once here so every reader downstream sees the same q. */
  const q = view.q;

  const listed = await listMedia(env, {
    page,
    limit: picker ? 200 : MEDIA_PAGE_SIZE,
    // The reader's Display choices, straight through. The picker branch below
    // ignores them, because the picker is a fixed insertion surface rather than
    // a view somebody configured.
    ...(picker ? {} : { sort: view.sort, dir: view.dir, tag: view.tag, trashed: view.trash }),
    // THE PICKER FILTER, applied in SQL rather than in the map below, so an
    // excluded row never crosses the wire. An OG card is 1200x630 of branded
    // chrome built for a social feed; inserting one into a post body would be
    // nonsense, so `r2-derived` is excluded outright. Documents go too: this
    // picker inserts images.
    //
    // Unconditional, and deliberately NOT merged with the `role` filter below:
    // the picker's rule is a constraint on what may be inserted, not a view the
    // reader chose, so a `?role=` in the URL must not be able to widen it.
    insertableOnly: picker,
    ...(picker
      ? {}
      : {
          // THE ROLE FILTER IS SUSPENDED IN THE TRASH VIEW. The bin holds
          // whatever was thrown away, and narrowing it by role would hide rows
          // an author is looking for from a view whose whole job is to find
          // them again.
          ...(!view.trash && ROLE_IDS.has(filter) ? { role: filter } : {}),
          ...(q ? { q } : {}),
        }),
  });
  const keys = listed.objects.map((object) => object.key);

  if (picker) {
    return {
      picker: true as const,
      objects: listed.objects.map((object) => ({
        key: object.key,
        url: object.url,
        thumb: thumbUrl(object.key, 320),
        alt: object.alt,
      })),
      truncated: listed.hasMore,
    };
  }

  // Usage, asked BOTH ways, and a refusal needs only one of them to object.
  //
  // `media_refs` is written by the pipeline at render time, so it is precise:
  // it records what the renderer actually emitted. The resolver scans the
  // artifact's markdown for the literal URL, so it is a conservative SUPERSET:
  // it will count a mention inside a code fence that the renderer never turned
  // into a link. Neither subsumes the other, and for a delete decision the
  // union is what fails closed.
  const [resolution, refs, twins] = await Promise.all([
    resolveCitations(env, keys),
    mediaRefsFor(env, keys),
    // Exact content identity only. See `mediaTwins` for why nothing perceptual
    // is coming.
    mediaTwins(env),
  ]);

  /*
   * THE DETAIL VIEW, as a parameter on this page rather than a route of its own.
   *
   * `/admin/media/:key` cannot carry these keys: 58 of the rows are static and
   * their key IS a path beginning with `/`, so it is not one path segment. A
   * parameter also keeps the picker, the listing and the detail on one loader,
   * which is the property the picker was built on.
   *
   * READ BY KEY, not found in `objects`. The detail is reachable by URL, so the
   * row it names may be on any page or on none, and picking it out of the
   * current page would make a bookmarked link work only from the page it was
   * copied on.
   */
  const detailKey = url.searchParams.get("key");
  let detail = null;
  if (detailKey) {
    const row = await mediaRecord(env, detailKey);
    if (row) {
      const [detailResolution, detailRefs] = await Promise.all([
        resolveCitations(env, [row.key]),
        mediaRefsFor(env, [row.key]),
      ]);
      detail = {
        found: true as const,
        key: row.key,
        url: row.storage === "static" ? row.key : `/media/${row.key}`,
        thumb: thumbUrl(row.key, 640),
        viewable: isViewable(row.kind),
        deletable: row.storage !== "static",
        originalName: row.originalName,
        role: row.role,
        storage: row.storage,
        kind: row.kind,
        mime: row.mime,
        bytes: row.bytes ?? 0,
        width: row.width,
        height: row.height,
        alt: row.alt,
        caption: row.caption,
        uploadedAt: row.uploadedAt,
        placeholder: row.placeholder,
        /** Rows the pipeline wrote, which is the precise half of usage. */
        refs: (detailRefs.get(row.key) ?? []).map((ref) => ({
          sourceType: ref.sourceType,
          sourceId: ref.sourceId,
          form: ref.form,
          detail: ref.detail,
        })),
        /** The artifact scan, which is the conservative superset. */
        citations: detailResolution.citations.get(row.key) ?? [],
        scanComplete: detailResolution.complete,
        tags: parseTags(row.tags ?? ""),
        trashedAt: row.trashedAt,
        /**
         * The CONTENT HASH, read off the key and never recomputed.
         *
         * Keys are content-addressed, so the hash is already in the filename. A
         * static row's key is a path rather than a hash, so it has none and the
         * inspector says nothing rather than showing a truncated path as if it
         * were a digest.
         */
        hash: /^([0-9a-f]{16,})\./.exec(row.key)?.[1] ?? null,
        /** Rows carrying identical bytes. Exact identity only. */
        twins: (await mediaTwins(env)).get(row.key) ?? [],
      };
    } else {
      detail = { found: false as const, key: detailKey };
    }
  }

  /*
   * THE UPLOAD FLASH, read off the URL the upload route redirected to.
   *
   * The code becomes a sentence HERE rather than in the component, on this
   * file's standing rule: the component stays free of anything but its loader
   * data, which is what `check:admin-ui` renders it with.
   */
  const uploaded = url.searchParams.get("uploaded");
  const uploadError = uploadErrorSentence(url.searchParams.get("upload-error"));

  return {
    picker: false as const,
    objects: listed.objects.map((object) => ({
      ...object,
      thumb: thumbUrl(object.key, 320),
      /**
       * Decided HERE, not in the component.
       *
       * `core.server` is stubbed when `check:admin-ui` renders these routes, and
       * the stub is a Proxy with no own keys, so a named export that a component
       * CALLS comes back undefined and the render throws. Nothing had called one
       * before, only referenced them from loaders. Keeping the decision in the
       * loader keeps the component free of server imports, which is what the
       * harness assumes and what the split is for anyway.
       */
      viewable: isViewable(object.kind),
      citations: resolution.citations.get(object.key) ?? [],
      /** Rows the pipeline wrote. The refcount that makes a shared blob safe. */
      refCount: (refs.get(object.key) ?? []).length,
      /** Parsed HERE, so the component never sees the delimited storage form. */
      tags: parseTags(object.tags ?? ""),
      /** How many other rows carry the same bytes. Zero for almost everything. */
      twinCount: (twins.get(object.key) ?? []).length,
    })),
    page,
    hasMore: listed.hasMore,
    /** Which chip is active. Echoed back so the chips render without re-parsing. */
    filter,
    /** Echoed for the same reason: the input, the chips and the pager all carry it. */
    q,
    detail,
    uploaded,
    uploadError,
    /** False when a resolver threw. The page says so and delete refuses. */
    scanComplete: resolution.complete,
    scanFailed: resolution.failed,
    /** What the index holds, so a rebuild's effect is visible on the page. */
    counts: await mediaCounts(env),
    /**
     * The role split, shown BESIDE the row count rather than instead of it.
     * The two answer different questions: rows say the rebuild ran, roles say
     * the deriver worked. See the rebuild action for why conflating them cost a
     * session.
     */
    roleCounts: await mediaRoleCounts(env),

    /**
     * THE VIEW STATE, echoed whole so the component can build links from it.
     *
     * Not spread into the payload as loose fields: the component calls
     * `hrefWith(view, {one: override})`, and handing it the object is what makes
     * that the easy thing to do.
     */
    view,
    /** Whether `Reset to defaults` has anything to reset. */
    modified: isModified(view),
    /** How many rows are in the bin, for the Trash lens. */
    trashedCount: await mediaTrashedCount(env),
    /**
     * Tags in use, with counts, for the filter chips.
     *
     * From `mediaTagCounts`, which excludes trashed rows, so a tag carried only
     * by binned assets does not offer a chip leading to an empty grid.
     */
    tagCounts: await mediaTagCounts(env),

    /**
     * THE UNUSED CHIP IS GONE, and the honest sentence it stood for is not.
     *
     * It read "70 of 70" against a corpus with zero image references, so it
     * filtered nothing, narrowed nothing, and alarmed. A permanent alarm is not
     * a signal. What was TRUE about it survives as `usageNote` below, because
     * the limitation is real and dropping the chip must not drop the caveat:
     * usage here means "the renderer emitted a citation", so an asset a route
     * references in CODE reads as uncited by this definition and by no other one
     * available. The nine roster photos are exactly that case.
     */
    usageNote:
      "Usage counts what the renderer emitted for a post. An asset referenced " +
      "only by route code, like the roster photos, has no citation here and is " +
      "not therefore unused.",
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await request.formData();
  const intent = form.get("intent");

  /*
   * TAGS. Written through `setMediaTags`, which owns the storage form.
   *
   * The action does NOT serialise: it hands over what the human typed and the
   * db function decides what is stored. A route that pre-serialised would be a
   * second author of the delimiter rule, which is the defect that rule exists
   * to prevent.
   *
   * Not gated by `isManagedKey`, unlike alt. A static asset has a row and can
   * legitimately carry organisational labels; what `isManagedKey` protects is
   * WRITING TO THE BUCKET, and this writes only to the index.
   */
  /*
   * BULK TAGGING. The bulk-actions ruling applied UNCHANGED, deliberately.
   *
   * This is the posts index's grammar, verbatim, down to the intent names and
   * the shape of the message: ADD or REMOVE one tag, never replace the set, so
   * a mistake costs one tag rather than all of them; skip a row already in the
   * target state and NAME BOTH COUNTS, because "12 tagged" when nine were
   * already tagged is a different fact from "12 tagged" when none were;
   * continue past failures and report per key.
   *
   * It ITERATES `setMediaTags`, the same per-row writer the inspector uses.
   * There is no bulk SQL path and there must not be: a second writer would be a
   * second author of the delimiter rule, and the whole reason that rule lives
   * in a pure module is that this table has already been bitten by two writers
   * disagreeing about a join character.
   */
  if (intent === "bulk-add-tag" || intent === "bulk-remove-tag") {
    const keys = form.getAll("key").map(String).filter(Boolean);
    if (keys.length === 0) return { message: "Nothing selected." };

    // ONE tag, normalised by the module that owns the rule. An input that
    // normalises to nothing is refused rather than treated as a clear.
    const wanted = normaliseTags(String(form.get("tag") ?? ""))[0];
    if (!wanted) return { message: "Enter a tag first." };
    const adding = intent === "bulk-add-tag";

    const failed: string[] = [];
    let done = 0;
    let skipped = 0;

    for (const key of keys) {
      try {
        const row = await mediaRecord(env, key);
        if (!row) {
          failed.push(`${key}: no row`);
          continue;
        }
        const current = parseTags(row.tags);
        const has = current.includes(wanted);
        // Already in the target state: SKIPPED, not rewritten. Writing anyway
        // would touch updated_at on rows nothing changed about.
        if (adding === has) {
          skipped += 1;
          continue;
        }
        await setMediaTags(
          env,
          key,
          adding ? [...current, wanted] : current.filter((t) => t !== wanted),
        );
        done += 1;
      } catch (error) {
        failed.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      message:
        `${adding ? "Tagged" : "Untagged"} ${done} of ${keys.length}` +
        (skipped > 0 ? `, ${skipped} already ${adding ? "tagged" : "untagged"}` : "") +
        "." +
        (failed.length > 0 ? ` Failed on ${failed.join("; ")}` : ""),
    };
  }

  if (intent === "set-tags") {
    const key = String(form.get("key") ?? "");
    const saved = await setMediaTags(env, key, String(form.get("tags") ?? ""));
    return {
      message: saved.length
        ? `Tags saved for ${key}: ${saved.join(", ")}.`
        : `Tags cleared for ${key}.`,
    };
  }

  /*
   * TRASH AND RESTORE. **NEITHER TOUCHES R2 AND NEITHER TOUCHES A PUBLIC URL.**
   *
   * The messages say so, in full, every time. Ruling 3 of this arc: if any copy
   * could be read as a takedown, rewrite it. An author who trashes an asset and
   * then finds the image still loading on a published post must not conclude
   * the button failed.
   */
  if (intent === "trash") {
    const key = String(form.get("key") ?? "");
    const { moved } = await trashMediaRecord(env, key);
    return {
      message: moved
        ? `${key} moved to the trash. Its address still works and any page using it is unchanged; this hides it from the library.`
        : `${key} was already in the trash.`,
    };
  }

  if (intent === "restore") {
    const key = String(form.get("key") ?? "");
    const { restored } = await restoreMediaRecord(env, key);
    return {
      message: restored
        ? `${key} restored to the library.`
        : `${key} was not in the trash.`,
    };
  }

  /*
   * EMPTY TRASH. Iterates the EXISTING guarded delete, one key at a time.
   *
   * Per the bulk ruling: continue past failures and report per key. A cited
   * asset is refused by `claimMediaKeyForDelete` in the same single statement
   * that protects a one-off delete, so emptying the bin cannot become a way
   * around the refcount guard. The friction ladder is unchanged: the confirm
   * lives on the control, and this is the same delete it has always been.
   */
  if (intent === "empty-trash") {
    const keys = await trashedMediaKeys(env);
    const deleted: string[] = [];
    const refused: string[] = [];
    for (const key of keys) {
      // Static rows have no object to remove, so emptying leaves them binned
      // rather than pretending to delete a file the site ships.
      if (!isManagedKey(key)) {
        refused.push(`${key} (static, nothing to delete)`);
        continue;
      }
      const claimed = await claimMediaKeyForDelete(env, key);
      if (!claimed) {
        refused.push(`${key} (something cites it)`);
        continue;
      }
      try {
        await deleteMediaObject(env, key);
        deleted.push(key);
      } catch (error) {
        refused.push(`${key} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
    return {
      message:
        `Emptied ${deleted.length} of ${keys.length}.` +
        (refused.length ? ` Kept: ${refused.join("; ")}.` : ""),
    };
  }

  if (intent === "set-alt") {
    const key = String(form.get("key") ?? "");
    if (!isManagedKey(key)) return { message: "Not a managed media key." };
    // Editing alt updates the RECORD and rewrites no post. Ruling 2: alt is
    // contextual as well as intrinsic, so posts keep whatever alt they were
    // written with and only future insertions pick this up.
    await upsertMediaRecord(env, { key, alt: String(form.get("alt") ?? "") });
    return { message: `Alt text saved for ${key}. Existing posts are unchanged.` };
  }

  if (intent === "rebuild") {
    // Replaces the old page-scoped backfill, which only ever saw the objects on
    // the current page and could not touch static assets at all. This one is
    // whole-corpus and idempotent: it re-derives every derived column and
    // preserves every authored one, so it is safe to press at any time.
    //
    // **It reported nothing useful the first time it was pressed, and that was a
    // real defect rather than a cosmetic one.** It wrote all 70 rows and looked
    // like it had done nothing, because the page still listed R2 and so showed
    // exactly what it had shown before. Dustin reported it as broken. A
    // maintenance action whose only evidence is invisible is indistinguishable
    // from one that failed, so the count is now read back OUT OF D1 afterwards
    // rather than trusted from the report, and the listing this redirects to
    // reads D1 too, so the page itself changes.
    // **The row count and the role split answer DIFFERENT questions, and reading
    // one as a proxy for the other sends the next session to debug a correct
    // file.** This cost real time on 2026-08-02, so it is written down here next
    // to the numbers rather than left to be rediscovered:
    //
    //   ROW COUNT   answers "did the rebuild run at all". Backfilling rows from
    //               the buckets is one code path.
    //   ROLE SPLIT  answers "does roleOf() work". Deriving role is a DIFFERENT
    //               code path, and it runs per row after the row exists.
    //
    // They are independent. A rebuild that ran with a completely broken
    // `roleOf()` still produces the full row count, every row simply carrying
    // the column default. So a stale-looking role split does NOT imply the
    // deriver is broken, and a correct role split does not prove the rebuild
    // reached every source. Report both, and read each for what it answers.
    const report = await rebuildMediaIndex(env);
    const after = await mediaCounts(env);
    const total = after.reduce((sum, row) => sum + Number(row.n), 0);
    const breakdown = after
      .map((row) => `${row.n} ${row.storage}/${row.kind}`)
      .sort()
      .join(", ");
    const roles = await mediaRoleCounts(env);
    const roleBreakdown = roles
      .map((row) => `${row.n} ${row.role}`)
      .sort()
      .join(", ");

    const parts = [
      `Rebuilt from ${report.scannedObjects} R2 object(s) and ${report.scannedFiles} static ` +
        `file(s). The index now holds ${total} row(s): ${breakdown}`,
      // Reported ALONGSIDE the row count, never instead of it. See above: one
      // says the rebuild ran, the other says the deriver worked.
      `By role: ${roleBreakdown}`,
    ];
    if (report.removed > 0) {
      parts.push(`${report.removed} row(s) removed for sources that no longer exist`);
    }
    // Reported, never swallowed. A rebuild that quietly skipped assets would be
    // indistinguishable from one that had nothing to do.
    if (report.failures.length > 0) {
      parts.push(
        `${report.failures.length} could not be derived: ${report.failures.slice(0, 3).join("; ")}` +
          (report.failures.length > 3 ? ` and ${report.failures.length - 3} more` : ""),
      );
    }
    parts.push("Alt text, captions and focal points were preserved");
    return { message: `${parts.join(". ")}.` };
  }

  if (intent === "delete") {
    const key = String(form.get("key") ?? "");

    // STATIC ASSETS ARE NOT DELETABLE HERE, and this is enforced in the ACTION
    // rather than by hiding the button. A hidden button is a UI opinion; a
    // hand-made POST, a stale page or a future refactor all route around it.
    // Removing a static asset means a commit that deletes the file, because the
    // file is in the repo and a Worker cannot write to the assets host at all:
    // deleting the ROW would simply leave check:media red until the next
    // rebuild put it straight back.
    if (storageOf(key) === "static") {
      return {
        message:
          `Delete refused: ${key} is a static asset, served from the repo rather than R2. ` +
          `Remove it with a commit that deletes the file, then rebuild the index.`,
      };
    }

    if (!isManagedKey(key)) return { message: "Not a managed media key." };

    // THE CHECK RUNS HERE, SERVER SIDE, ON A FRESH READ. The page the operator
    // is looking at may be minutes old and a post may have started citing this
    // object since it rendered, so the UI's opinion is never the authority.
    const [resolution, refs] = await Promise.all([
      resolveCitations(env, [key]),
      mediaRefsFor(env, [key]),
    ]);

    // Ruling 4: FAIL CLOSED. "We could not check" is not "nothing cites it".
    if (!resolution.complete) {
      return {
        message: `Delete refused: the reference scan failed (${resolution.failed.join(", ")}), so it cannot be confirmed that nothing cites this object.`,
      };
    }

    // THE REFCOUNT. Content-addressed keys mean two posts can share one blob,
    // so the question is not "does this post use it" but "does ANYTHING use
    // it". Deleting the object while a second citation survives would break
    // that other post, which is exactly the cost the CAS ruling accepted and
    // this is where it is paid.
    const rows = refs.get(key) ?? [];
    const citations = resolution.citations.get(key) ?? [];
    if (rows.length > 0 || citations.length > 0) {
      const sources = new Set(rows.map((row) => `${row.sourceType}:${row.sourceId}`));
      const refNote =
        rows.length > 0
          ? ` The pipeline recorded ${rows.length} reference(s) across ${sources.size} item(s).`
          : "";
      return {
        message: `Delete refused. ${describeCitations(citations)}${refNote}`,
      };
    }

    /*
     * THE CLAIM, and it is one statement on purpose. Finding B009: everything
     * above is a check-then-act, so a save that adds a citation after the read
     * and before the delete used to lose its image. `claimMediaKeyForDelete`
     * removes the row only if nothing cites the key AT THAT INSTANT, inside a
     * single D1 statement, and reports whether it won.
     *
     * Losing means something cited it in the meantime, so this refuses, which
     * is the same fail-closed stance the checks above take. The row goes first
     * because R2 wins every conflict: a surviving object with no row is
     * backfilled by the next rebuild, while a row with no object is the case
     * `check:media` calls an error.
     *
     * The residual, stated rather than implied: a save can still land a ref
     * between this claim and the R2 delete below. Closing that needs both paths
     * to take a lock, which the save path does not have. What this removes is
     * the wide window, the one that spanned two awaits and a network round
     * trip; what is left is bounded by a single R2 call and cannot be reached
     * without a concurrent writer on a single-author system.
     */
    if (!(await claimMediaKeyForDelete(env, key))) {
      return {
        message: `Delete refused: ${key} was cited or removed while this delete was being checked. Reload and try again.`,
      };
    }

    await deleteMediaObject(env, key);
    return { message: `Deleted ${key} and its row. Nothing cited it.` };
  }

  return { message: null };
}

/** A refusal that names what is citing the object and how. */
function describeCitations(citations: MediaCitation[]) {
  const byItem = new Map<string, MediaCitation[]>();
  for (const citation of citations) {
    const list = byItem.get(citation.id);
    if (list) list.push(citation);
    else byItem.set(citation.id, [citation]);
  }
  const parts = [...byItem.entries()].map(([id, list]) => {
    const forms = [...new Set(list.map((c) => c.form))].join(", ");
    return `${list[0].title} (${id}: ${forms}, ${list.map((c) => c.detail).join("; ")})`;
  });
  return `Still cited by ${parts.length} post${parts.length === 1 ? "" : "s"}: ${parts.join(" and ")}.`;
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} kB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * THE LAST SEGMENT, because a directory is the part these names SHARE.
 *
 * Measured on the rendered page: a tile showed `/phage-hunters/2024-cohort-gro`
 * with the rest cut off. The nine roster photos share every character of that
 * prefix and differ only at the end, so nine tiles rendered as nine copies of
 * one string while the distinguishing half was the half thrown away.
 *
 * Dropping the directory rather than de-emphasising it, because a de-emphasised
 * prefix still spends horizontal space on the segment that fails to tell these
 * rows apart, and at 109px of room there is none to spend. The full key stays a
 * hover away in the `title` and a click away in the detail view, which is also
 * the no-script route to the address.
 *
 * A content-addressed key has no directory, so this returns it unchanged. What
 * remains is still too long for the tile, which `middleTruncate` below handles.
 */
function displayName(object: { originalName: string | null; key: string }) {
  if (object.originalName) return object.originalName;
  const last = object.key.split("/").pop();
  return last && last.length > 0 ? last : object.key;
}

/**
 * TRUNCATION FROM THE MIDDLE, because both ends carry meaning and the tail
 * carries more of it.
 *
 * Measured in a browser, and NO line clamp fixes this. Two lines at 13px cut a
 * 39-character roster name; three lines at 12px still cut a 58-character
 * document name. The cut always lands on the end, which is exactly where these
 * names differ: `...session-01` against `...session-02`, `...paper-1` against
 * `...paper-2`.
 *
 * So the middle goes and both ends stay, with the tail given the larger share.
 *
 * THE CAP IS 13 BECAUSE THE NAME GETS 109px, and every number here was read off
 * a rendered page rather than estimated. The tile is 153px, the body pads 8 each
 * side, the icon takes 22 and the gap 4, which leaves 109 for the name. At the
 * page's own font that holds 13 characters: cap 14 measured 110px and clipped 7
 * of 24 tiles by one pixel, cap 16 measured 125, cap 20 measured 144 to 156, and
 * cap 22 measured 158 to 169. That progression is also why the control beside it
 * is a glyph rather than the word Copy: the word cost 41px and left the name 104,
 * so the browser ellipsised the END again and undid this function in the same
 * commit that added it.
 *
 * Character-based rather than pixel-based, for the same reason the social card's
 * title cap is: this renders on a server that cannot measure a font, and the CSS
 * ellipsis stays on as the backstop for a name that is short in characters and
 * wide in pixels.
 */
function middleTruncate(name: string, max = 13, tail = 9) {
  if (name.length <= max) return name;
  return `${name.slice(0, max - tail - 1)}…${name.slice(-tail)}`;
}

/**
 * THE PAGE'S ONE JOB, as one small button beside the name it copies.
 *
 * The clipboard needs script, which is why the filename beside it links to the
 * detail view where the same string sits in a readonly input. Feedback is a data
 * attribute rather than component state: the page holds no client state by
 * ruling, and a copy button with no acknowledgement reads as broken.
 *
 * AN ICON RATHER THAN THE WORD, and the reason is measured rather than
 * fashionable. It shipped as a full-width block under every tile, which at 24
 * tiles is 24 slabs competing with the pictures they belong to. Compacting it
 * to the WORD "Copy" beside the name was measured next: the word cost 41px of a
 * 131px row and left the name 85, which the browser then ellipsised from the
 * end, undoing the truncation fix in the same commit that made it. The glyph
 * costs 22 and leaves the name 109.
 *
 * `title` carries the address for a pointer, and the visually hidden span
 * carries the accessible name for everything else. An icon with neither is a
 * button that says nothing to a screen reader.
 */
/**
 * One labelled row of segmented links inside the Display popover.
 *
 * LINKS, not buttons, and not a `<select>`. Every one of these is a different
 * URL, so making them links is what lets the whole display state be shared,
 * bookmarked and restored by the back button with no script at all. A select
 * would need an onChange to navigate, which is the one thing this page has
 * never required.
 */

/**
 * Drop a file anywhere on the page to load it into the upload form.
 *
 * LAYERED OVER THE FORM, never instead of it. It sets the EXISTING input's
 * `files` and does not submit, so what happens next is what has always happened
 * next: the author sees the filename in the field and presses Upload. That is
 * the whole enhancement, and it is why it degrades perfectly: with script off
 * the form is untouched and the page behaves exactly as it did before this
 * existed.
 *
 * It deliberately DOES NOT auto-submit. A drop is easy to do by accident, an
 * upload writes to R2, and the friction ladder puts a deliberate press in front
 * of every write on this page.
 *
 * KEYBOARD REACHABILITY is not this control's job and it does not claim any: it
 * renders no focusable element and adds no shortcut. The file input beside it
 * is the keyboard path and always was, which is why this can be a pure
 * convenience rather than a second way in that has to be made accessible.
 *
 * CLIENT STATE ADDED: one boolean, `over`, purely to draw the target. It is
 * initialised false so the hydration render matches the server's.
 */
function DropAnywhere({ inputRef }: { inputRef: React.RefObject<HTMLInputElement | null> }) {
  const [over, setOver] = useState(false);

  useEffect(() => {
    /* A COUNTER, not a boolean, because dragenter and dragleave fire for every
       nested element the pointer crosses and a naive boolean flickers off the
       moment the cursor moves between two tiles. */
    let depth = 0;
    const stop = (event: DragEvent) => {
      event.preventDefault();
    };
    const enter = (event: DragEvent) => {
      if (!event.dataTransfer?.types.includes("Files")) return;
      depth += 1;
      setOver(true);
    };
    const leave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const drop = (event: DragEvent) => {
      depth = 0;
      setOver(false);
      const files = event.dataTransfer?.files;
      if (!files || files.length === 0) return;
      event.preventDefault();
      const input = inputRef.current;
      if (!input) return;
      // ONE file, because the form takes one and inventing a queue here would
      // be a second upload path with none of the server's contract.
      const one = new DataTransfer();
      one.items.add(files[0]);
      input.files = one.files;
      input.focus();
    };

    window.addEventListener("dragover", stop);
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragover", stop);
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [inputRef]);

  if (!over) return null;
  return (
    <p className="media-drop-hint" role="status">
      Drop to load it into the upload form. Nothing uploads until you press
      Upload.
    </p>
  );
}

function MediaDisplayGroup({
  label,
  options,
  current,
  hrefFor,
}: {
  label: string;
  options: Array<[string, string]>;
  current: string;
  hrefFor: (id: string) => string;
}) {
  return (
    <div className="media-display-group">
      <span className="media-display-label">{label}</span>
      <nav className="media-display-options" aria-label={label}>
        {options.map(([id, text]) => (
          <Link
            key={id}
            to={hrefFor(id)}
            className={`search-chip${current === id ? " is-active" : ""}`}
            aria-current={current === id ? "true" : undefined}
          >
            {text}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      className="btn-ghost media-copy"
      title={value}
      onClick={(event) => {
        const button = event.currentTarget;
        navigator.clipboard
          .writeText(value)
          .then(() => {
            button.dataset.copied = "yes";
            window.setTimeout(() => {
              delete button.dataset.copied;
            }, 1500);
          })
          .catch(() => {
            button.dataset.copied = "no";
          });
      }}
    >
      {/* Two rounded rectangles, one behind the other: the copy glyph every
          admin surface uses, drawn in currentColor so it takes the button's
          own token and adds no colour of its own. */}
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
        focusable="false"
      >
        <rect x="9" y="9" width="12" height="12" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </svg>
      <span className="sr-only">Copy the address for {label}</span>
    </button>
  );
}

export default function AdminMedia({
  loaderData,
  actionData,
  /*
   * HARNESS SEAM, per admin queue ruling 8: an OPTIONAL PROP with a production
   * default, never loaderData, which is the server contract the gate polices.
   *
   * `check:admin-ui` renders one static pass and dispatches no events, so
   * without this the bulk bar never mounts and the two bulk intents contribute
   * NO payload, which is exactly how the posts index left its most destructive
   * surface outside the fixture for a session. Defaulted, wire-unreachable by
   * construction, and this is the SECOND such seam against the ruled ceiling of
   * three: the posts index has the other one, with the same name.
   */
  initialSelection = [],
}: Route.ComponentProps & { initialSelection?: string[] }) {
  if (loaderData.picker) return null;
  const {
    objects,
    page,
    hasMore,
    filter,
    q,
    detail,
    uploaded,
    uploadError,
    scanComplete,
    scanFailed,
    counts,
    roleCounts,
    view,
    modified,
    trashedCount,
    tagCounts,
    usageNote,
  } = loaderData;

  /*
   * SELECTION, and it is the ONLY client state this page has ever carried.
   *
   * Everything else here is a URL: the view, the sort, the filters, the open
   * inspector. Selection is not, and deliberately: it is transient, it means
   * nothing after a navigation, and putting twelve keys in a query string would
   * make every link on the page unreadable and every back button surprising.
   *
   * With script off there is no bulk bar and no checkboxes render as useful, so
   * the page degrades to exactly what it did before this landed: per-row
   * controls in the inspector. Nothing that only works with script is the only
   * way to do anything here.
   */
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const visible = objects.map((o) => o.key);
  /** Selection survives a filter change only for rows still on screen. */
  const chosen = selected.filter((key) => visible.includes(key));
  const allShown = visible.length > 0 && chosen.length === visible.length;
  const toggle = (key: string) =>
    setSelected((was) => (was.includes(key) ? was.filter((k) => k !== key) : [...was, key]));

  /*
   * SHIFT-RANGE. The last row the reader touched, so shift-click can span.
   *
   * A REF rather than state, and that is the whole point: it is remembered
   * between events and never rendered, so it cannot cause a re-render and
   * cannot differ between the server render and the hydrated one. The seam this
   * enhancement adds to the page is therefore zero new rendered state.
   *
   * Degrades to nothing. Without script no checkbox toggles at all, and a plain
   * click without shift behaves exactly as it did before this existed.
   */
  const anchor = useRef<string | null>(null);
  /** The real file input, so the drop enhancement fills it rather than a copy. */
  const fileRef = useRef<HTMLInputElement>(null);
  const selectRange = (key: string, shift: boolean) => {
    const from = anchor.current;
    anchor.current = key;
    if (!shift || !from || from === key) {
      toggle(key);
      return;
    }
    const a = visible.indexOf(from);
    const b = visible.indexOf(key);
    if (a < 0 || b < 0) {
      toggle(key);
      return;
    }
    const span = visible.slice(Math.min(a, b), Math.max(a, b) + 1);
    // ADDS the span rather than replacing the selection, which is what every
    // file manager does and what makes two separate ranges possible.
    setSelected((was) => [...new Set([...was, ...span])]);
  };

  const total = counts.reduce((sum, row) => sum + Number(row.n), 0);
  const byRole = new Map(roleCounts.map((row) => [row.role, Number(row.n)]));
  const active = FILTERS.find((f) => f.id === filter);

  /*
   * EVERY LINK ON THIS PAGE IS `hrefWith(view, {one override})`.
   *
   * This replaced a hand-rolled merge that listed the parameters it carried,
   * which is precisely how the two evaporation incidents happened: the list in
   * the builder and the set of parameters the page actually had drifted apart,
   * silently, because a missing query parameter is not a payload difference and
   * no gate could see it.
   *
   * `hrefWith` starts from the WHOLE state and overrides one field, and its
   * parameter list is derived from the defaults rather than typed again. There
   * is no longer a place to forget one.
   */
  const linkTo = (over: Parameters<typeof hrefWith>[1] = {}) => hrefWith(view, over);

  /** A chip is its own filter, back at page one, carrying everything else. */
  const chipHref = (role: string) => linkTo({ role, page: 1 });
  /** A tag chip toggles: pressing the active one clears it. */
  const tagHref = (tag: string) => linkTo({ tag: view.tag === tag ? "" : tag, page: 1 });
  const count = (id: string) => byRole.get(id);

  return (
    <Panel
      title="Media"
      // Written for someone looking for a picture, and it now describes the
      // control the page actually has. The previous line told the reader to copy
      // a filename beside tiles that showed a name and offered no copy button.
      description="Every picture, card and file the site knows about. Search it, copy an address, and paste that into a post."
    >
      <div className="posts-toolbar">
        {/*
          UPLOAD, on the page whose job is finding pictures.

          It posts to the same endpoint the two editors use and declares itself
          with a hidden `intent`, which is the ONLY thing that selects the
          redirect branch there; the editors keep the JSON path by sending
          nothing new. Images only, because that is what the endpoint accepts:
          the library's documents arrive as committed static assets.
        */}
        <Form
          method="post"
          action="/admin/media/upload"
          encType="multipart/form-data"
          className="media-upload"
        >
          <label className="media-upload-label" htmlFor="media-file">
            Upload an image
          </label>
          <input
            ref={fileRef}
            id="media-file"
            type="file"
            name="file"
            accept="image/*"
          />
          <DropAnywhere inputRef={fileRef} />
          {/* The intent rides on the SUBMIT BUTTON rather than in a hidden
              field, and the difference is what a gate can see: check:admin-ui
              reduces a form to `METHOD action | intent | fields`, so a hidden
              field lands in the field list as a bare name while a button's
              name/value pins the TOKEN. The payload is identical either way. */}
          <button type="submit" name="intent" value={UPLOAD_FORM_INTENT} className="btn">
            Upload
          </button>
        </Form>

        {/* Rebuild is a REPAIR, so it sits where the posts list puts its
            repairs rather than beside the browsing controls. Same form, same
            method, same intent, same empty field set: check:admin-ui compares
            exactly that, which is what makes this a move and not a change. */}
        <OverflowMenu label="Maintenance">
          <Form method="post">
            <button
              type="submit"
              name="intent"
              value="rebuild"
              className="overflow-menu-item"
              data-menu-item
            >
              Rebuild media index
              <span className="overflow-menu-item-hint">
                Re-derive every row from R2 and the repo, preserving alt and captions
              </span>
            </button>
          </Form>
        </OverflowMenu>
      </div>

      {/*
        SEARCH AND FILTER, as a GET form, borrowed from the posts list.

        The filter state lives in the URL, so it survives a reload, is linkable,
        is what the back button restores, and works with scripting off with no
        enhancement at all. A plain <form>, not react-router's <Form>, because
        the browser's own submission already produces the navigation wanted.

        The role rides along as a hidden field so searching does not silently
        widen the group the reader chose.
      */}
      <form method="get" className="posts-filters" role="search">
        <div className="posts-filter-field">
          <label htmlFor="media-q">Search</label>
          <input
            id="media-q"
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Filename, key, alt or caption"
            className="posts-filter-input"
          />
        </div>
        <input type="hidden" name="role" value={filter} />
        <button type="submit" className="btn-ghost posts-filter-submit">
          Search
        </button>
        {q ? (
          <Link to={chipHref(filter)} className="btn-ghost posts-filter-clear">
            Clear
          </Link>
        ) : null}
      </form>

      {/* THE FACET ROW, from the ratified mockup: a label, the chips, and a
          hint that says who owns this axis.

          "assigned by the system" is the line the mockup was approved for, and
          it is doing real work: `role` is DERIVED by `roleOf()` from the key,
          so a reader who thinks it is an editable label will look for an editor
          that does not exist and conclude the page is broken. Saying it once
          here costs a phrase and closes that. */}
      <div className="media-facet">
        <span className="media-facet-label" id="media-facet-role">
          Role
        </span>
        <nav aria-labelledby="media-facet-role" className="media-filters">
          <Link
            to={chipHref("all")}
            className={`search-chip${filter === "all" ? " is-active" : ""}`}
            aria-current={filter === "all" ? "page" : undefined}
          >
            All <span className="search-chip-count">{total}</span>
          </Link>
          {FILTERS.map((f) => (
            <Link
              key={f.id}
              to={chipHref(f.id)}
              className={`search-chip${filter === f.id ? " is-active" : ""}`}
              aria-current={filter === f.id ? "page" : undefined}
              title={f.hint}
            >
              {f.label}
              {count(f.id) === undefined ? null : (
                <span className="search-chip-count">{count(f.id)}</span>
              )}
            </Link>
          ))}
        </nav>
        <span className="media-facet-hint">assigned by the system</span>
      </div>

      {/*
        TAG CHIPS, beside the roles rather than inside the Display popover.
        Tags are NAVIGATION: they narrow what you are looking at, exactly as a
        role does. Group, sort and tile size are SETTINGS, which is why they sit
        behind one control instead of competing with these. That split is the
        mockup's own reasoning and it is the reason the toolbar reads calmly.

        Rendered only when tags exist, so an untagged library is not given an
        empty facet to wonder about.
      */}
      {tagCounts.length > 0 ? (
        <div className="media-facet">
          <span className="media-facet-label" id="media-facet-tag">
            Tags
          </span>
          <nav aria-labelledby="media-facet-tag" className="media-filters">
            {tagCounts.map((t) => (
              <Link
                key={t.tag}
                to={tagHref(t.tag)}
                className={`search-chip${view.tag === t.tag ? " is-active" : ""}`}
                aria-current={view.tag === t.tag ? "page" : undefined}
              >
                {t.tag} <span className="search-chip-count">{t.n}</span>
              </Link>
            ))}
          </nav>
          <span className="media-facet-hint">yours, in the inspector</span>
        </div>
      ) : null}

      {/*
        THE DISPLAY BAR: the view toggle, the Display popover, and the Trash
        lens. Every control here is a LINK, so the whole thing works with no
        script and every state is a URL somebody can share or bookmark.

        `<details>` carries the popover rather than a button and a state hook,
        for the same reason the drawer is a real `<dialog>`: the open and close
        behaviour, the Escape key and the summary semantics are the platform's.
      */}
      <div className="media-display-bar">
        <nav className="media-view-toggle" aria-label="Layout">
          {[
            ["list", "List"],
            ["grid", "Grid"],
          ].map(([id, label]) => (
            <Link
              key={id}
              to={linkTo({ view: id })}
              className={`search-chip${view.view === id ? " is-active" : ""}`}
              aria-current={view.view === id ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>

        <details className="media-display">
          <summary className="row-action">Display: {displaySummary(view)}</summary>
          <div className="media-display-panel">
            <MediaDisplayGroup
              label="Group by"
              options={[
                ["flat", "Flat"],
                ["folder", "Folder"],
                ["month", "Month"],
              ]}
              current={view.group}
              hrefFor={(id) => linkTo({ group: id, page: 1 })}
            />
            <MediaDisplayGroup
              label="Sort"
              options={[
                ["added", "Newest"],
                ["name", "A to Z"],
                ["size", "Largest"],
                ["usage", "Usage"],
              ]}
              current={view.sort}
              hrefFor={(id) => linkTo({ sort: id, page: 1 })}
            />
            <MediaDisplayGroup
              label="Direction"
              options={[
                ["desc", "Descending"],
                ["asc", "Ascending"],
              ]}
              current={view.dir}
              hrefFor={(id) => linkTo({ dir: id, page: 1 })}
            />
            <MediaDisplayGroup
              label="Tile size"
              options={[
                ["s", "S"],
                ["m", "M"],
                ["l", "L"],
              ]}
              current={view.size}
              hrefFor={(id) => linkTo({ size: id })}
            />
            {/* A LINK to the bare URL, not a button. Resetting is navigation to
                the default view, and the default view has an address. */}
            {modified ? (
              <Link to="/admin/media" className="row-action">
                Reset to defaults
              </Link>
            ) : null}
          </div>
        </details>

        {/*
          THE TRASH LENS. It says what trash IS, in the title, every time.
          Ruling 3: a trashed file keeps serving, so nothing here may read as a
          takedown.
        */}
        <Link
          to={linkTo({ trash: !view.trash, page: 1, key: "" })}
          className={`search-chip${view.trash ? " is-active" : ""}`}
          aria-current={view.trash ? "page" : undefined}
          title="The bin is a library view. A trashed file keeps its address and any page using it is unchanged."
        >
          Trash <span className="search-chip-count">{trashedCount}</span>
        </Link>
      </div>

      {/*
        THE TRASH EXPLANATION, shown WHENEVER the bin is open rather than only
        when it has rows. An author arriving at an empty bin still needs to know
        what putting something in it would do.
      */}
      {view.trash ? (
        <p className="media-usage-note">
          This is a library view, not a takedown. A trashed file keeps its
          address, and any published page using it is unchanged. Restore puts it
          back in the library.{" "}
          <strong>Only Empty trash deletes anything, and it still refuses
          anything a post cites.</strong>
        </p>
      ) : null}

      {/*
        EMPTY TRASH, the one control on this page that is a real delete, so it
        takes the friction the ladder assigns to a BULK delete: TYPE THE COUNT,
        exactly as bulk post deletion does. Not a plain confirm, because it
        removes many objects at once and the count is the thing a distracted
        person gets wrong.

        The ladder is UNCHANGED by this arc, which is the point: this reuses it
        rather than inventing a fourth level of ceremony.
      */}
      {view.trash && trashedCount > 0 ? (
        <Form
          method="post"
          className="media-empty-trash"
          onSubmit={(event) => {
            const typed = prompt(
              `Permanently delete ${trashedCount} file${trashedCount === 1 ? "" : "s"} from R2? ` +
                `Anything a post cites will be kept. Type ${trashedCount} to confirm.`,
            );
            if (typed === null || typed.trim() !== String(trashedCount)) {
              event.preventDefault();
            }
          }}
        >
          <button type="submit" name="intent" value="empty-trash" className="btn-danger">
            Empty trash
          </button>
          <span className="media-facet-hint">
            Deletes the objects. Anything a post cites is kept and named.
          </span>
        </Form>
      ) : null}

      {/* ONE LINE, in words, and it states ONCE what Unused actually means.
          The chip now carries a number, and a number invites the reading
          "nothing uses these", which is stronger than the query can support:
          media_refs records what the RENDERER emitted, so an asset referenced
          by a route rather than by a post is uncited here. */}
      <p className="muted media-summary">
        {q
          ? `${objects.length} match${objects.length === 1 ? "" : "es"} for "${q}"` +
            `${active ? ` in ${active.label.toLowerCase()}` : " across every group"}.`
          : active
            ? `Showing ${objects.length} ${active.label.toLowerCase()} item` +
              `${objects.length === 1 ? "" : "s"}` +
              `${count(filter) !== undefined && count(filter) !== objects.length ? ` of ${count(filter)}` : ""}. ` +
              `${active.hint}.`
            : `Showing all ${total} items: ${byRole.get("content") ?? 0} content, ` +
              `${byRole.get("generated") ?? 0} generated, ${byRole.get("brand") ?? 0} brand, ` +
              `${byRole.get("icon") ?? 0} icons.`}
      </p>

      {/*
        THE USAGE HONESTY LINE. The Unused chip went; this did not.

        It is the one thing on this page standing between a reader and deleting
        a file the site is serving, and it is now UNCONDITIONAL rather than
        appearing only when the uncited count happened to equal the total. That
        condition was a coincidence of the current corpus: the moment one post
        cites one image, the caveat would have vanished while remaining exactly
        as true, and the roster photographs would still have been invisible to
        the tracker.
      */}
      {scanComplete ? (
        <p className="media-usage-note">
          {usageNote}{" "}
          <strong>Treat not referenced as unknown, not as safe to delete.</strong>
        </p>
      ) : null}

      {actionData?.message ? (
        <p className="editor-notice" role="status">
          {actionData.message}
        </p>
      ) : null}

      {uploaded ? (
        <p className="editor-notice" role="status">
          Uploaded {uploaded}. <Link to={linkTo({ key: uploaded })}>Open it</Link>.
        </p>
      ) : null}
      {uploadError ? (
        <p className="editor-notice" role="status">
          {uploadError}
        </p>
      ) : null}

      {/* The usage column is the whole reason this page exists, so when it
          cannot be trusted the page says so rather than showing "unused"
          everywhere and inviting a delete. */}
      {!scanComplete ? (
        <AdminAlert title="Usage could not be determined" headingId="scan-failed">
          <p>
            The reference scan failed ({scanFailed.join(", ")}), so nothing below is
            labelled unused and every delete will be refused until it succeeds.
          </p>
        </AdminAlert>
      ) : null}

      {detail ? (
        <section className="media-detail" aria-label="Asset detail">
          {detail.found ? (
            <>
              <header className="media-detail-head">
                <h3>{detail.originalName ?? detail.key}</h3>
                <Link to={linkTo({ key: "" })} className="btn-ghost">
                  Close
                </Link>
              </header>

              <div className="media-detail-body">
                <div className="media-detail-preview" data-viewable={detail.viewable}>
                  {detail.viewable ? (
                    <img src={detail.thumb} alt="" width={640} height={427} />
                  ) : (
                    <span className="media-thumb-label" aria-hidden="true">
                      {(detail.mime ?? "file").split("/").pop()?.toUpperCase()}
                    </span>
                  )}
                </div>

                <div className="media-detail-facts">
                  {/* THE NO-SCRIPT PATH FOR THE PAGE'S ONE JOB. A readonly
                      input rather than a <code>: it selects with a click and
                      a keyboard, and it copies with the platform's own
                      shortcut, none of which needs this page to be running. */}
                  <label className="media-detail-address" htmlFor="media-detail-url">
                    Address
                  </label>
                  <div className="media-detail-address-row">
                    <input
                      id="media-detail-url"
                      className="posts-filter-input"
                      readOnly
                      value={detail.url}
                    />
                    <CopyButton value={detail.url} label={detail.originalName ?? detail.key} />
                  </div>

                  {/* DERIVED, and the inspector says so. The mockup made this
                      distinction with a Role row marked "assigned by the
                      system" and a Tags row marked "yours to edit"; this page
                      has no tags column, so the same honesty lands on the two
                      groups it does have. Everything in this list is
                      recomputable from the object by `rebuildMediaIndex`, and
                      an edit here would be overwritten by the next rebuild. */}
                  <p className="media-facet-hint media-detail-owner">
                    assigned by the system
                  </p>
                  <dl className="media-detail-list">
                    <dt>Key</dt>
                    <dd className="media-key">{detail.key}</dd>
                    <dt>Role</dt>
                    <dd>
                      <span className="chip">{detail.role}</span> {detail.storage} · {detail.kind}
                    </dd>
                    <dt>Type</dt>
                    <dd>{detail.mime ?? "unknown"}</dd>
                    <dt>Size</dt>
                    <dd>{formatBytes(detail.bytes)}</dd>
                    <dt>Dimensions</dt>
                    <dd>
                      {detail.width && detail.height
                        ? `${detail.width}×${detail.height}`
                        : "not measured"}
                    </dd>
                    <dt>Uploaded</dt>
                    <dd>{detail.uploadedAt ? detail.uploadedAt.slice(0, 10) : "ships with the repo"}</dd>
                  </dl>

                  {/* AUTHORED, and the only field on this panel that is. A
                      rebuild preserves it precisely because nothing can
                      recompute it. */}
                  <p className="media-facet-hint media-detail-owner">yours to edit</p>
                  <Form method="post" className="media-alt-form">
                    <input type="hidden" name="key" value={detail.key} />
                    <label htmlFor="detail-alt">Alt text</label>
                    <input
                      id="detail-alt"
                      name="alt"
                      defaultValue={detail.alt}
                      placeholder="Describe this image"
                      className="media-alt-input"
                    />
                    <button type="submit" name="intent" value="set-alt" className="btn-ghost">
                      Save alt
                    </button>
                  </Form>

                  {/*
                    TAGS. A comma separated text field, which is the same shape
                    the post editor's tag field submits, so an author who has
                    tagged a post already knows how this behaves.

                    The field carries the PARSED list joined back with commas,
                    never the delimiter-wrapped storage form. Nothing outside
                    `tags.mjs` should ever see `,alpha,beta,`.
                  */}
                  <Form method="post" className="media-alt-form">
                    <input type="hidden" name="key" value={detail.key} />
                    <label htmlFor="detail-tags">Tags</label>
                    <input
                      id="detail-tags"
                      name="tags"
                      defaultValue={detail.tags.join(", ")}
                      placeholder="photo, roster, 2019"
                      className="media-alt-input"
                    />
                    <button type="submit" name="intent" value="set-tags" className="btn-ghost">
                      Save tags
                    </button>
                  </Form>

                  {/*
                    THE ADDRESS, in the three forms an author actually pastes.

                    All THREE are the same string, so there is no second source
                    for the address and no endpoint behind any of them: the
                    markdown and HTML variants are `object.url` wrapped in
                    punctuation, built here. The alt text rides along, because a
                    snippet with an empty alt is a snippet somebody ships with
                    an empty alt.
                  */}
                  <div className="media-detail-copy">
                    <h4>Copy</h4>
                    <CopyButton value={detail.url} label="Address" />
                    <CopyButton
                      value={`![${detail.alt}](${detail.url})`}
                      label="Markdown"
                    />
                    <CopyButton
                      value={`<img src="${detail.url}" alt="${detail.alt}">`}
                      label="HTML"
                    />
                  </div>

                  {/*
                    TWINS: rows carrying IDENTICAL BYTES, found by content hash.
                    Exact identity only, never a similarity score.

                    The copy is careful, because this is the one place the page
                    offers to remove something on the strength of a comparison:
                    trashing a twin hides it from the library and BOTH addresses
                    keep working, so nothing here can cost a published page its
                    image.
                  */}
                  {detail.twins.length > 0 ? (
                    <div className="media-detail-twins">
                      <h4>Identical files</h4>
                      <p className="muted">
                        {detail.twins.length === 1 ? "One other file has" : `${detail.twins.length} other files have`}{" "}
                        exactly these bytes. Trashing one hides it from the
                        library; every address keeps working and no page changes.
                      </p>
                      <ul className="media-detail-refs">
                        {detail.twins.map((twin) => (
                          <li key={twin.key}>
                            <Link to={linkTo({ key: twin.key })}>
                              {twin.originalName ?? twin.key}
                            </Link>
                            <Form method="post" className="media-twin-form">
                              <input type="hidden" name="key" value={twin.key} />
                              <button
                                type="submit"
                                name="intent"
                                value="trash"
                                className="media-destructive"
                              >
                                Keep this one, trash that one
                              </button>
                            </Form>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {/*
                    THE CONTENT HASH, shown and never recomputed: the key already
                    carries it. A static row has a path rather than a hash, so it
                    gets nothing rather than a truncated path dressed as a digest.
                  */}
                  {detail.hash ? (
                    <p className="media-detail-hash">
                      <span className="media-display-label">sha256</span>
                      <code>{detail.hash}</code>
                    </p>
                  ) : null}

                  {/* USAGE, both halves, labelled as what each one is. */}
                  <div className="media-detail-usage">
                    <h4>Usage</h4>
                    {!detail.scanComplete ? (
                      <p className="muted">The reference scan failed, so usage is unknown.</p>
                    ) : detail.refs.length === 0 && detail.citations.length === 0 ? (
                      <p className="muted">
                        Nothing the renderer emitted cites this. An asset a route
                        references in code would look the same here.
                      </p>
                    ) : (
                      <ul className="media-detail-refs">
                        {detail.refs.map((ref) => (
                          <li key={`ref-${ref.sourceId}-${ref.form}-${ref.detail ?? ""}`}>
                            <Link to={`/admin/posts/${ref.sourceId}/edit`}>{ref.sourceId}</Link>{" "}
                            <span className="muted">
                              {ref.form}
                              {ref.detail ? `, ${ref.detail}` : ""}
                            </span>
                          </li>
                        ))}
                        {detail.citations.map((citation) => (
                          <li key={`cite-${citation.id}-${citation.form}-${citation.detail}`}>
                            <Link to={`/admin/posts/${citation.id}/edit`}>{citation.title}</Link>{" "}
                            <span className="muted">
                              {citation.form}, {citation.detail}, from the artifact scan
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/*
                    TRASH AND RESTORE, and NEITHER carries a confirm.

                    That is the friction ladder working, not a gap in it.
                    Trashing is reversible and changes nothing a reader can see,
                    so a confirm on it would be ceremony, and ceremony that is
                    always harmless is ceremony people learn to click through.
                    The confirm is spent where it buys something: on Delete
                    below, which is irreversible.

                    Offered on a static row too, unlike delete. Trashing tidies
                    the library and touches no file, which is exactly the thing a
                    static asset can safely have done to it.
                  */}
                  {detail.trashedAt ? (
                    <Form method="post" className="media-trash-form">
                      <input type="hidden" name="key" value={detail.key} />
                      <button type="submit" name="intent" value="restore" className="btn-ghost">
                        Restore to the library
                      </button>
                    </Form>
                  ) : (
                    <Form method="post" className="media-trash-form">
                      <input type="hidden" name="key" value={detail.key} />
                      <button type="submit" name="intent" value="trash" className="media-destructive">
                        Move to trash
                      </button>
                      <span className="media-facet-hint">
                        Hides it here. The address keeps working.
                      </span>
                    </Form>
                  )}

                  {/* A static asset shows WHY it cannot be deleted rather than
                      simply lacking a button. The action refuses it regardless;
                      this is so the page explains the refusal instead of
                      leaving a gap the operator has to interpret. */}
                  {detail.deletable ? (
                    <Form
                      method="post"
                      onSubmit={(event) => {
                        // The same confirmation discipline the post delete uses.
                        if (!confirm(`Delete ${detail.key}? This removes the object from R2.`)) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="key" value={detail.key} />
                      <button type="submit" name="intent" value="delete" className="btn-danger">
                        Delete
                      </button>
                    </Form>
                  ) : (
                    <p className="muted">Ships with the repo. Remove it with a commit.</p>
                  )}
                </div>
              </div>
            </>
          ) : (
            <p className="muted">
              Nothing in the index has the key {detail.key}. It may have been deleted.{" "}
              <Link to={linkTo({ key: "" })}>Back to the library</Link>.
            </p>
          )}
        </section>
      ) : null}

      {objects.length === 0 ? (
        <p className="muted">
          {q ? (
            <>
              Nothing matches &ldquo;{q}&rdquo; here. Try{" "}
              <Link to={linkTo({ role: "all", page: 1 })}>every group</Link>, or{" "}
              <Link to={chipHref(filter)}>clear the search</Link>.
            </>
          ) : (
            <>
              Nothing in this group. Try <Link to={chipHref("all")}>all media</Link>, or upload
              an image above.
            </>
          )}
        </p>
      ) : (
        // A plain list. NOT role="grid": positional information is meaningless
        // to a screen reader here, because the number of columns depends on the
        // container width, and directional navigation does not help anyone find
        // a specific picture. Semantic elements first; the only ARIA on this
        // page is the nav label above and aria-current on the active chip.
        /*
          ONE MARKUP TREE, TWO LAYOUTS, selected by data attributes.
          The list view is CSS over the same elements rather than a second
          branch of JSX: a second tree is a second place for a control to go
          missing, and check:admin-ui would then have to prove both carry the
          same submissions instead of the layout being unable to change them.
          Tile size is a class exactly as ruled, never an inline style.
        */
        <Form method="post">
      {/*
        THE BULK BAR, and the FORM WRAPS THE GRID so the checkboxes are part of
        the same submission. Nesting this inside the toolbar above would put a
        form inside a form, which the browser drops; the posts index solved it
        the same way and this is that solution, not a new one.

        Rendered only when something is selected, which is also why the two
        bulk intents appear in the fixture only under the seeded-selection
        state: an unselected page genuinely cannot issue them.
      */}
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
                list="media-bulk-tags"
                autoComplete="off"
                placeholder="tag name"
              />
            </label>
            {/* The vocabulary already in use, offered rather than enforced: a
                new tag is legitimate. */}
            <datalist id="media-bulk-tags">
              {tagCounts.map((t) => (
                <option key={t.tag} value={t.tag} />
              ))}
            </datalist>
            <button type="submit" name="intent" value="bulk-add-tag" className="btn">
              Add tag
            </button>
            <button type="submit" name="intent" value="bulk-remove-tag" className="btn">
              Remove tag
            </button>
          </div>
        ) : null}

        {/* SELECT ALL SHOWN. Never the bare word "all" while a filter is
            active: this only ever reaches the rows on screen, and the posts
            index has a ruled assertion about exactly this wording. */}
        {objects.length > 0 ? (
          <label className="media-select-all">
            <input
              type="checkbox"
              checked={allShown}
              onChange={() => setSelected(allShown ? [] : visible)}
            />
            <span>
              {view.tag || q || filter !== "all"
                ? `Select all ${visible.length} shown`
                : `Select all ${visible.length}`}
            </span>
          </label>
        ) : null}

        /*
          GROUPED PAGE-LOCAL. Each page buckets the rows IT HAS; a group never
          spans a page boundary. That is a ruling, not a shortcut, and the
          grounds are on `groupRows`: fetching the whole library to group
          globally is fine at 70 rows and wrong at 700, and letting a group
          resume on page two reads as a bug to everyone who sees it.

          The heading therefore counts THIS PAGE and says so, because a count
          that looked like a library total would be the over-promise again.
        */
        {groupRows(objects, view.group).map((bucket) => (
        <section key={bucket.label || "ungrouped"} className="media-group">
          {bucket.label ? (
            <h3 className="media-group-heading">
              {bucket.label}
              <span className="media-group-count">
                {bucket.rows.length} on this page
              </span>
            </h3>
          ) : null}
        <ul className="media-grid" data-view={view.view} data-size={view.size}>
          {bucket.rows.map((object) => {
            const name = displayName(object);
            const cited = object.citations.length > 0 || object.refCount > 0;
            return (
              <li
                key={object.key}
                className="media-card"
                data-selected={chosen.includes(object.key) || undefined}
              >
                {/* The checkbox carries `key`, which is what the bulk action
                    reads with form.getAll("key"). Same shape as the posts
                    index's `slug`, so the two bulk surfaces are one grammar. */}
                <label className="media-check-label">
                  <input
                    type="checkbox"
                    name="key"
                    value={object.key}
                    checked={chosen.includes(object.key)}
                    onChange={(event) =>
                      selectRange(
                        object.key,
                        // `nativeEvent` carries the modifier a change event
                        // does not expose directly. Keyboard activation reports
                        // shiftKey false, so Space still toggles one row, which
                        // is the behaviour a keyboard reader expects.
                        (event.nativeEvent as MouseEvent | undefined)?.shiftKey === true,
                      )
                    }
                  />
                  <span className="sr-only">Select {name}</span>
                </label>
                {/* A FIXED BOX, declared as aspect-ratio on the wrapper rather
                    than left to the image.

                    The grid was ragged because it mixes 1200x630 cards, 3:2
                    photos and 1:1 icons and nothing constrained them, which also
                    made the cards tall enough to clip the Save button. An
                    explicit ratio on the wrapper reserves the space before the
                    image arrives, so a lazily-loaded tile cannot reflow the rows
                    below it as it lands. */}
                <Link to={linkTo({ key: object.key })} className="media-thumb-link">
                  <span
                    className="media-thumb-box"
                    // LQIP as a CSS background BEHIND the real image. The element
                    // paints immediately and the image covers it on arrival, so
                    // the tile is never empty, the swap needs no script and no
                    // onload, and the box never changes size.
                    //
                    // ELEVEN OF SEVENTY ROWS HAVE NO PLACEHOLDER: the Images
                    // binding does not rasterize vectors, so every SVG has a null
                    // one. Those must degrade to the surface colour rather than
                    // render as a black or empty hole, which is why this is set
                    // conditionally over a token background rather than always
                    // written as `url(null)`.
                    style={
                      object.placeholder
                        ? { backgroundImage: `url("${object.placeholder}")` }
                        : undefined
                    }
                    data-placeholder={object.placeholder ? "lqip" : "none"}
                    // A DOCUMENT GETS A SHORTER BOX. There is nothing to look
                    // at, so it must not claim the same height as a picture:
                    // 31 of the 70 rows are PDFs and at full tile height they
                    // read as a wall of failed loads.
                    data-kind={object.viewable ? "image" : "document"}
                  >
                    {/* A PDF has no thumbnail to show, so it gets a label rather
                        than an <img> pointed at something that cannot render one.
                        31 of the 70 rows are documents; an empty box for each
                        would read as a loading failure. */}
                    {object.viewable ? (
                      <img
                        className="media-thumb"
                        src={object.thumb}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        width={320}
                        height={320}
                      />
                    ) : (
                      <span className="media-thumb-label" aria-hidden="true">
                        {(object.mime ?? "file").split("/").pop()?.toUpperCase()}
                      </span>
                    )}
                  </span>
                </Link>

                <div className="media-card-body">
                  {/* NAME AND COPY ON ONE ROW. The button was a full-width
                      block, which at 24 tiles is 24 stacked slabs competing
                      with the pictures they belong to. It is the page's one
                      job, so it stays visible on every tile, but it is a
                      control beside the name rather than a bar under it. */}
                  <div className="media-name-row">
                    {/* The LAST SEGMENT, linking to the detail view, which is
                        also the no-script route to the address. A
                        content-addressed key is an ADDRESS and reads as noise,
                        so the name the author gave the file identifies it to a
                        human; the full key stays in the title and in the
                        detail view. */}
                    <Link
                      to={linkTo({ key: object.key })}
                      className="media-name"
                      title={object.key}
                    >
                      {/*
                        THE CLAMP IS THE GRID'S, AND ONLY THE GRID'S.

                        Found by LOOKING at the list view rather than by
                        measuring it: with a 13 character middle clamp applied
                        to a full-width row, `microscope-plate-2019.png` and
                        `microscope-plate-2020.png` both render as
                        "mic...-2019.png" style stubs and the reader cannot tell
                        two files apart in a view with 1200px of empty space
                        beside the name.

                        The clamp exists because every truncation cuts the END,
                        which is the half that distinguishes, and a narrow tile
                        genuinely has no room. A list row does. So the clamp is
                        applied per LAYOUT rather than per name, and the list
                        shows the whole thing.
                      */}
                      {view.view === "list" ? name : middleTruncate(name)}
                    </Link>
                    <CopyButton value={object.url} label={name} />
                  </div>
                  <p className="media-meta">
                    <span className="chip">{object.role}</span> {formatBytes(object.size)}
                    {scanComplete ? (cited ? " · used" : " · unused") : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
        </section>
        ))}
        </Form>
      )}

      {/* PAGE NUMBERS, in the URL, so a page of the library is linkable and
          works with scripting off. The opaque R2 cursor went with the R2
          listing: it could only ever move forward one page at a time, because
          a cursor is a position in a key-ordered iterator and not an index.

          The filter AND the search travel with the page number. Dropping the
          filter was how paging out of a filtered view silently reverted to the
          default, and a search dropped the same way would be the same bug
          wearing a different parameter. */}
      {hasMore || page > 1 ? (
        <p className="posts-toolbar">
          {page > 1 ? (
            <Link to={linkTo({ page: page - 1 })} className="btn-ghost">
              Previous
            </Link>
          ) : null}
          <span className="muted">Page {page}</span>
          {hasMore ? (
            <Link to={linkTo({ page: page + 1 })} className="btn-ghost">
              Next
            </Link>
          ) : null}
        </p>
      ) : null}
    </Panel>
  );
}
