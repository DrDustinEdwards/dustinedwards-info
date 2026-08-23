import { useEffect, useRef, useState } from "react";

import {
  Form,
  Link,
  data,
  useLocation,
  useNavigation,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";

import { artifactContext } from "~/lib/editor/publish.server";
import { timed, timingsContext } from "~/lib/timing";
import { AdminAlert } from "~/components/admin/alert";
import { MediaConfirm } from "~/components/admin/media-confirm";
import { MediaDrawer } from "~/components/admin/media-drawer";
import { MediaKeyboard, MediaToast, toast } from "~/components/admin/media-keyboard";
import { MediaPalette } from "~/components/admin/media-palette";
import { OverflowMenu } from "~/components/admin/overflow-menu";
import { Panel } from "~/components/admin/panel";
import {
  claimMediaKeyForDelete,
  mediaCounts,
  mediaRecord,
  mediaRefsFor,
  mediaRoleCounts,
  mediaLensCounts,
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
import templateRefs from "../../content/generated/template-refs.json";
import { storageOf } from "~/lib/media/classify.mjs";
import {
  copySnippetsFor,
  flagsFor,
  lensNoteFor,
  suggestedAlt,
  suggestedTags,
  tileFlagFor,
  usageDescriptor,
  usageStateOf,
} from "~/lib/media/usage.mjs";
import { CONFIRM_FIELD, confirmationSatisfied } from "~/lib/destructive.mjs";
import { normaliseTags, parseTags } from "~/lib/media/tags.mjs";
import {
  displaySummary,
  docTitle,
  groupRows,
  hrefWith,
  isModified,
  onlyDisplayChanged,
  readDisplayAxes,
  readView,
  sortHref,
} from "~/lib/media/view.mjs";
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
import {
  ACCEPT_ATTRIBUTE,
  UPLOAD_FORM_INTENT,
  uploadErrorSentence,
} from "~/lib/media/upload-contract.mjs";
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

/**
 * How many rows the command palette returns.
 *
 * SIX, the mockup's own cap, and a real constraint rather than a round number: a
 * dropdown under a search bar has about six rows before the highlighted one can
 * leave the viewport, and a list the arrow keys cannot walk is a list with no
 * keyboard navigation. The count line says "6+" when there are more, so the cap
 * never reads as the whole answer.
 */
const PALETTE_RESULTS = 6;

/**
 * THE KEYBOARD SHORTCUTS, as data, so the popover cannot document one that does
 * not exist.
 *
 * The previous ruling on this page was that an absent shortcut must not be
 * advertised, which is why the Cmd+K badge was held back for a whole session
 * after the mockup drew it. The same rule applies to this list: every row here
 * is wired, the two global ones in `MediaPalette` and the rest in
 * `MediaKeyboard`, and `check:admin-ui` asserts the rendered panel and this
 * table name the same set.
 *
 * WRITTEN IN WORDS, not glyphs. The mockup uses the arrow, return and delete
 * SYMBOLS, which a screen reader reads as punctuation or skips entirely, and
 * which several fonts render as tofu. A `<kbd>` saying "shift enter" is legible
 * to everything.
 *
 * **`evidence` NAMES THE SOURCE TOKEN THAT IMPLEMENTS THE BINDING, and it is
 * there because a plant proved the first version of this gate was a tautology.**
 * Adding a fake row ("ctrl D, delete everything instantly") left check:admin-ui
 * green: it compared the number of rows DECLARED against the number RENDERED,
 * and a fake row increments both. It could only ever catch the panel failing to
 * render, which is not what the rule is about.
 *
 * The rule is that this page must not advertise a shortcut nobody wired, which
 * is why the Cmd+K badge was held back for an entire session. So each row now
 * points at the expression in `media-palette.tsx` or `media-keyboard.tsx` that
 * handles it, and the gate greps for it. A fake row has no expression to name.
 */
const MEDIA_SHORTCUTS = [
  { keys: "cmd K", what: "Focus search from anywhere", evidence: "metaKey" },
  { keys: "/", what: "Focus search", evidence: 'event.key === "/"' },
  { keys: "up down", what: "Move through results", evidence: 'event.key === "ArrowDown"' },
  { keys: "enter", what: "Copy the address", evidence: 'event.key === "Enter"' },
  { keys: "shift enter", what: "Open details", evidence: "event.shiftKey" },
  { keys: "arrows", what: "Move through the grid", evidence: 'event.key === "ArrowRight"' },
  { keys: "x", what: "Select the tile under the cursor", evidence: 'event.key === "x"' },
  {
    keys: "c",
    what: "Copy the address of the tile under the cursor",
    evidence: 'event.key === "c"',
  },
  { keys: "escape", what: "Clear the search or the selection", evidence: 'event.key === "Escape"' },
] as const;

/**
 * THE QUALITY LENSES, with the sentence each one is asking.
 *
 * The hints are the mockup's own framing carried over: a lens is a question,
 * and the answer needs a caveat more often than not. `unattached` gets the
 * longest one because it is the lens most likely to be read as permission to
 * delete, and the mockup says so in as many words.
 */
const LENS_CHIPS = [
  {
    id: "unattached",
    label: "Unattached",
    hint:
      "No post cites these. Not the same as unused: an asset placed by page code, " +
      "like the roster photographs, is unattached by this measure and is live. " +
      "Verify before deleting.",
  },
  {
    id: "duplicates",
    label: "Duplicates",
    hint: "Files with byte-identical twins, matched on content hash alone.",
  },
  { id: "no-alt", label: "No alt text", hint: "Images with no alt text written yet." },
  { id: "large", label: "Over 1 MB", hint: "Files over one mebibyte." },
] as const;

/**
 * WHICH ASSETS THE REPOSITORY ITSELF PLACES, read once at module scope.
 *
 * A BUILD-TIME IMPORT, exactly as the colophon reads `stack.json`, and the only
 * shape that works: the scan needs a filesystem, and neither a request nor
 * `rebuildMediaIndex` has one, because both run inside the Worker. The artifact
 * ships in the bundle, so the answer cannot drift from the code that produced
 * it, and `check:content` byte-compares it against a fresh scan in the offline
 * tier and again inside ship.
 *
 * `TEMPLATE_REF_KEYS` is the SQL side of it: the `unattached` lens has to
 * exclude these rows, and it excludes them in the query rather than after the
 * read so pagination and the chip count stay honest.
 */
const TEMPLATE_REFS: Record<string, string[]> = templateRefs.refs;
const TEMPLATE_REF_KEYS = Object.keys(TEMPLATE_REFS);

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  /*
   * INSTRUMENTATION, OFF BY DEFAULT. The collector is created by the /admin
   * middleware on `?timing=1` and already holds the auth marks by the time this
   * runs, so the header this loader emits accounts for the WHOLE request rather
   * than for the part one file can see.
   *
   * Undefined on every other request, and every `timed` call below then
   * degrades to a plain call.
   */
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1") || 1;

  // The picker asks for a flatter, bigger payload from this same loader, which
  // is what makes it the same listing rather than a second one.
  const picker = url.searchParams.get("picker") === "1";

  /*
   * THE COMMAND PALETTE, ON THIS LOADER, for the reason the picker is.
   *
   * It could have been a route of its own, or the client could have filtered a
   * copy of the library shipped into the page. Both are second answers to "what
   * matches this query", and this page has already paid for a second answer
   * once: the Unused chip counted with one predicate and filtered with another.
   *
   * Reaching the SAME `matchesQuery` in SQL means the palette and the plain GET
   * form cannot disagree about what a query matches, which matters because the
   * form is what the palette degrades to. Shipping the corpus to the browser
   * would also stop being viable at exactly the size where search starts to
   * matter, and this page paginates precisely because that size is coming.
   */
  const palette = url.searchParams.get("palette") === "1";

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

  const listed = await timed(timings, "d1_list_media", () =>
    listMedia(env, {
    page,
    limit: picker ? 200 : MEDIA_PAGE_SIZE,
    // The reader's Display choices, straight through. The picker branch below
    // ignores them, because the picker is a fixed insertion surface rather than
    // a view somebody configured.
    ...(picker
      ? {}
      : {
          sort: view.sort,
          dir: view.dir,
          tag: view.tag,
          trashed: view.trash,
          lens: view.lens,
          // The unattached lens means "no post cites it AND no repository code
          // references it". Applied in SQL, so a page of 24 is 24 genuinely
          // unattached rows rather than 24 minus however many the roster places.
          templateKeys: TEMPLATE_REF_KEYS,
        }),
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
    }),
  );
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

  /*
   * THE PALETTE PAYLOAD: small, flat, and capped.
   *
   * SIX, which is the mockup's own cap and a real constraint rather than a
   * round number: the dropdown sits under a search bar with a viewport beneath
   * it, and a list long enough to scroll is a list the arrow keys cannot walk
   * without the highlighted row leaving the screen. `hasMore` is reported so the
   * count can say "6+ matches" rather than claiming six is all there is.
   *
   * NO usage, NO citations, NO twins. Those cost three more queries per
   * keystroke and answer nothing a reader picking a file needs; the palette
   * exists to find an address, and the inspector is one keystroke away for the
   * rest.
   */
  if (palette) {
    return {
      palette: true as const,
      results: listed.objects.slice(0, PALETTE_RESULTS).map((object) => ({
        key: object.key,
        url: object.url,
        name: object.originalName ?? object.key.split("/").pop() ?? object.key,
        dir: folderPrefix(object.key),
        size: object.size,
        viewable: isViewable(object.kind),
      })),
      hasMore: listed.objects.length > PALETTE_RESULTS || listed.hasMore,
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
  // NAMED PER LEG AS WELL AS AS A GROUP. The group time is the wall clock the
  // request actually pays; the legs are what says which one is the long pole.
  // Reporting only the group would leave the next session unable to tell three
  // fast queries from one slow one hiding behind two.
  // NOT a d1_ mark, and the old name is why a whole session went looking for a
  // query plan. `resolveCitations` touches no database: it reads the committed
  // artifact over the GitHub Contents API and scans it in memory. The prefix
  // named the wrong subsystem and sent the search to the wrong place.
  /*
   * SIX CALLS, ONE WALL CLOCK. The three counts below used to be `await`s
   * inside the returned object literal, which evaluates its properties in
   * order, so they ran three round trips deep AFTER this group had finished:
   * five sequential steps where two would do.
   *
   * None of them depends on `keys`, or on each other, or on anything this
   * group produces. They were serial because of where the lines sat, which is
   * the same defect the admin layout loader had.
   *
   * **They join THIS group rather than starting at the top of the loader**, and
   * that is deliberate. The picker and palette branches return before this
   * point; a promise created above them would be created on paths that never
   * await it, which is a wasted query on the picker path and an unhandled
   * rejection waiting to happen on any of them.
   *
   * Named per leg as well as as a group, so the next reading says which of the
   * six is the long pole rather than only how long the slowest was.
   */
  const [resolution, refs, twins, trashedCount, tagCounts, lensCounts] = await timed(
    timings,
    "group_listing",
    () =>
      Promise.all([
        timed(timings, "resolve_citations", () =>
          resolveCitations(env, keys, context.get(artifactContext).load ?? undefined),
        ),
        timed(timings, "d1_media_refs", () => mediaRefsFor(env, keys)),
        // Exact content identity only. See `mediaTwins` for why nothing perceptual
        // is coming.
        timed(timings, "d1_media_twins", () => mediaTwins(env)),
        timed(timings, "d1_trashed_count", () => mediaTrashedCount(env)),
        timed(timings, "d1_tag_counts", () => mediaTagCounts(env)),
        timed(timings, "d1_lens_counts", () => mediaLensCounts(env, TEMPLATE_REF_KEYS)),
      ]),
  );

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
      /*
       * THE SHARED READER, and its absence here was a live second read.
       *
       * This branch runs INSIDE the loader, after the listing above has already
       * resolved citations for the page. Without the reader, `postsResolver`
       * falls back to its own `loadArtifact`, so `/admin/media?key=...` fetched
       * 601,683 bytes from the GitHub Contents API TWICE in one request: once
       * for the grid and once for the drawer. Measured at 283 to 632ms per read.
       *
       * Found by grepping the call sites while writing the gate that now
       * enforces this, not by measurement, because the detail view was never
       * sampled.
       */
      const [detailResolution, detailRefs] = await Promise.all([
        resolveCitations(env, [row.key], context.get(artifactContext).load ?? undefined),
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
        twins: twins.get(row.key) ?? [],
        /** The third state, from the same three pieces of evidence as a tile. */
        usage: usageStateOf({
          postRefs: (detailRefs.get(row.key) ?? []).length,
          citations: (detailResolution.citations.get(row.key) ?? []).length,
          templateRefs: (TEMPLATE_REFS[row.key] ?? []).length,
        }),
        /** The source files that place it, repo-relative. */
        templateRefs: TEMPLATE_REFS[row.key] ?? [],
        /**
         * SUGGESTED ALT TEXT, computed here and never applied.
         *
         * The loader offers it; a button accepts it. Writing it automatically
         * would fill the corpus with alt text nobody read, which is worse than
         * an empty field because an empty field is visibly a defect and a
         * filename dressed as a description is not.
         */
        altSuggestion: suggestedAlt(row.originalName ?? row.key.split("/").pop() ?? row.key),
        /** Tags the path implies, minus the ones already applied. */
        tagSuggestions: suggestedTags(row.key).filter(
          (t) => !parseTags(row.tags ?? "").includes(t),
        ),
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

  /*
   * THE DUPLICATES LENS IS APPLIED HERE, after the read, and deliberately.
   *
   * Exact content identity is read off the content-addressed key by
   * `mediaTwins`, in JS. Approximating it in SQL to keep the filter uniform
   * with the other three lenses would be a SECOND definition of twin, and this
   * table has already been bitten once by two definitions of one join rule.
   *
   * The cost, stated: this filters the page AFTER pagination, so a duplicates
   * page can hold fewer rows than the page size. At 70 rows and 0 twins that is
   * invisible; it is the first thing to fix if the corpus grows.
   */
  const shown =
    view.lens === "duplicates"
      ? listed.objects.filter((o) => (twins.get(o.key) ?? []).length > 0)
      : listed.objects;

  const payload = {
    picker: false as const,
    palette: false as const,
    objects: shown.map((object) => ({
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
      /**
       * THE THIRD STATE, decided in the loader from three pieces of evidence.
       *
       * Two of them are per-post and already here; the third is the repository
       * scan. `usageStateOf` owns the precedence so the tile, the row, the lens
       * and the inspector cannot each decide it slightly differently, which is
       * how a page ends up saying "unattached" in one place and "used" in
       * another about one file.
       */
      usage: usageStateOf({
        postRefs: (refs.get(object.key) ?? []).length,
        citations: (resolution.citations.get(object.key) ?? []).length,
        templateRefs: (TEMPLATE_REFS[object.key] ?? []).length,
      }),
      /**
       * WHICH SOURCE FILES PLACE IT. Empty for everything but the seventeen the
       * scan found. The inspector prints these rather than the mockup's prose
       * labels ("Phage Hunters roster, page template"), because those were
       * authored strings in a fixture and a repo-relative path is a fact the
       * reader can open.
       */
      templateRefs: TEMPLATE_REFS[object.key] ?? [],
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
    trashedCount,
    /**
     * Tags in use, with counts, for the filter chips.
     *
     * From `mediaTagCounts`, which excludes trashed rows, so a tag carried only
     * by binned assets does not offer a chip leading to an empty grid.
     */
    tagCounts,

    /**
     * THE LENS COUNTS, one query, sharing the filters' own predicates.
     *
     * `duplicates` is added HERE from `mediaTwins` rather than in SQL, because
     * exact content identity is read off the content-addressed key in JS and a
     * SQL approximation would be a second definition of twin.
     */
    lensCounts: {
      // THE SAME LIST THE LISTING GOT. The chip and the grid disagreeing is the
      // exact defect the Unused chip shipped with, and passing one array to both
      // readers is what makes agreement structural rather than remembered.
      ...lensCounts,
      duplicates: twins.size,
    },

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
    /*
     * THE STANDING USAGE NOTE, REWRITTEN, because the old one became false in
     * this commit.
     *
     * It said: "An asset referenced only by route code, like the roster photos,
     * has no citation here and is not therefore unused." Every word of that was
     * true while the page had two states, and it was the honest confession of a
     * tracker that could not see route code. The repository scan can, so the
     * roster photographs now read "in template" and the sentence describes a
     * limitation that no longer exists.
     *
     * What survives is the limitation that DOES still exist, and it is a
     * narrower and more useful one: the scan matches literal paths, so a path
     * the code builds at runtime is invisible to it, and nothing here can see an
     * external site linking a file. That is why the third state is called
     * unattached and not unused.
     */
    usageNote:
      "Usage is asked three ways: what a post cites, what the artifact scan " +
      "finds, and what repository code references. A file none of them names is " +
      "unattached rather than unused, because a path the code builds at runtime " +
      "is invisible to the scan and an external site can link anything.",
  };

  /*
   * SERIALIZATION IS NOT MEASURED HERE, and saying so is the point.
   *
   * What the framework does after this returns is a turbo-stream encode, not a
   * `JSON.stringify`, so timing a stringify of the same object would produce a
   * number that looks like serialization and is not. `payload_build` below is
   * the honest measurement available from inside a loader: everything from the
   * first query to the assembled object.
   *
   * The two costs this instrument still cannot see are the framework's encode
   * and React's render. Both are derivable without touching entry.server.tsx:
   * request the same route as a document and as a `.data` request, and the
   * difference between their totals, with loader_total identical, is the render.
   */
  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });

  // No header at all unless it was asked for, so the default response is
  // byte-identical to what it was before any of this instrumentation existed.
  return data(payload);
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
    const tags = String(form.get("tags") ?? "").trim();

    /*
     * **AN EMPTY FIELD IS NOT AN INSTRUCTION TO CLEAR.**
     *
     * This used to pass whatever arrived straight to `setMediaTags`, so blanking
     * the text box and pressing Save wiped every tag on the key and reported
     * "Tags cleared" as though that had been asked for. The destructive outcome
     * was the DEFAULT of an empty field, which is the wrong way round: the
     * common accident and the deliberate act produced the same request.
     *
     * Clearing is now its own act, marked by `clear`. Nothing else changes:
     * `setMediaTags` stays the one writer and the one author of the delimiter
     * rule, so a chip still cannot become a second way to format a tag.
     *
     * Not a confirmation ceremony. Tags are retypable, so the fix is to stop
     * the accident being expressible, not to ask twice about it.
     */
    const clearing = form.get("clear") !== null;
    if (!tags && !clearing) {
      return {
        message:
          `Nothing changed for ${key}. The tag field was empty, and an empty ` +
          `field does not clear tags. Remove them one at a time, or press ` +
          `Clear all.`,
      };
    }

    const saved = await setMediaTags(env, key, clearing ? "" : tags);
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
  /*
   * BULK TRASH. The per-row ruling applied unchanged to many rows.
   *
   * Trashing is REVERSIBLE and touches neither R2 nor any public URL, which is
   * why it takes a plain confirmation rather than the type-the-count ceremony
   * that `empty-trash` owes. The friction ladder is unchanged: the count is
   * spent where the action is irreversible.
   *
   * It ITERATES `trashMediaRecord`, the same per-row writer the inspector uses,
   * and reports per key, exactly as the bulk-tagging ruling requires. There is
   * no bulk SQL path and there must not be: a second writer would be a second
   * author of a rule this table has already been bitten by.
   */
  if (intent === "bulk-trash") {
    const keys = form.getAll("key").map(String).filter(Boolean);
    if (keys.length === 0) return { message: "Nothing selected." };
    let moved = 0;
    let already = 0;
    const failed: string[] = [];
    for (const key of keys) {
      try {
        const result = await trashMediaRecord(env, key);
        if (result.moved) moved += 1;
        else already += 1;
      } catch (error) {
        failed.push(`${key}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return {
      message:
        `Moved ${moved} of ${keys.length} to the trash` +
        (already > 0 ? `, ${already} already there` : "") +
        ". Every address still works and no published page changes." +
        (failed.length > 0 ? ` Failed on ${failed.join("; ")}` : ""),
    };
  }

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

    /*
     * **THE TYPE-THE-COUNT LADDER, ENFORCED HERE AND NOT ONLY IN THE UI.**
     *
     * It lived in an `onSubmit` handler calling `prompt()`, so with scripting
     * off the handler never ran and this action deleted every trashed object
     * with no confirmation at all. The ceremony was script-only while the
     * destruction was not.
     *
     * The modal now renders its confirm button ENABLED on the server, precisely
     * so a reader without script can reach it, which means the check has to be
     * here. The disabled button is earlier feedback; this is the gate.
     *
     * Compared against the count read in THIS request rather than one the form
     * carried, so a stale page cannot authorise a delete of a different size
     * than the operator was shown.
     */
    const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();
    if (!confirmationSatisfied(typed, keys.length)) {
      return {
        message:
          `Nothing was deleted. The trash holds ${keys.length} file(s) and the ` +
          `confirmation read ${typed || "(blank)"}. Type the count exactly to confirm.`,
      };
    }
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
    /*
     * **THE CONFIRMATION, CHECKED HERE. Ruled 2026-08-17.**
     *
     * A rebuild is idempotent for rows whose source still exists, and that is
     * what made it look harmless. It is not: `report.removed` DELETES rows
     * whose source is gone, so a rebuild run against a half-populated bucket,
     * or while R2 is returning an error, prunes the index down to whatever it
     * managed to see. Nothing asked before doing that.
     *
     * The count is 1, not the number of rows at risk, and the reason is honest
     * rather than lazy: how many rows a rebuild removes cannot be known without
     * running it, so a typed count would be a number invented to look precise.
     * The confirmation step states the CURRENT size instead, which is the
     * quantity actually at stake.
     */
    const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();
    if (!confirmationSatisfied(typed, 1)) {
      const before = await mediaCounts(env);
      return {
        confirmRebuild: before.reduce((sum, row) => sum + Number(row.n), 0),
      };
    }

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

    /*
     * **THE CONFIRMATION IS CHECKED HERE, NOT IN THE FORM'S onSubmit.**
     *
     * It was a `confirm()` in an `onSubmit` handler, so with scripting off the
     * handler never ran and the R2 object went with no confirmation at all.
     * The refcount, static and claim checks below were always server-side and
     * stay exactly as they were; what was missing is the only one that asks
     * whether a HUMAN meant this, and those other checks cannot stand in for it
     * because an uncited object passes every one of them.
     *
     * The key is content-addressed, so a deleted object cannot be restored by
     * re-uploading the same bytes under the same URL. One object, so the count
     * is 1, using the same predicate and field name as empty-trash beside it.
     */
    const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();
    if (!confirmationSatisfied(typed, 1)) {
      return { confirmDelete: key };
    }

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
      // The shared reader, for uniformity rather than for a saving: this action
      // is its own request and reads the artifact once either way. Threading it
      // anyway means every call site in this file looks the same, so the next
      // one written by copy is threaded by default.
      resolveCitations(env, [key], context.get(artifactContext).load ?? undefined),
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

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * The Added column, as a date a person reads.
 *
 * UTC, for the same reason the month HEADINGS are UTC: a file uploaded at 23:30
 * UTC must not show one date here and a different month in the heading directly
 * above it. The two would disagree on the same screen.
 *
 * NO CLOCK IS READ. This formats a string the loader supplied; it never asks
 * what today is, which is the rule the scheduled-post fixture exists to hold.
 *
 * A static asset has no upload event, and NULL is the honest value, so it says
 * where the file comes from instead of borrowing a date from somewhere.
 */
function formatAdded(uploaded: string | null | undefined) {
  if (!uploaded) return "in repo";
  const at = Date.parse(uploaded);
  if (Number.isNaN(at)) return "in repo";
  const d = new Date(at);
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTH_ABBR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/**
 * The Dims column, and an EM DASH IS NOT AVAILABLE, so an unmeasured row says
 * so in a character that is allowed here.
 *
 * A document has no pixel dimensions and never will; a vector may have none
 * recorded. Both are "not measured" rather than zero, and printing 0x0 would be
 * a claim.
 */
function formatDims(width: number | null | undefined, height: number | null | undefined) {
  return width && height ? `${width}×${height}` : "not measured";
}

/**
 * The file extension, uppercased, off the key. PDF, SVG, PNG.
 *
 * Read from the KEY rather than from the mime type, because the key is what the
 * reader sees everywhere else on this page and a mime type disagreeing with a
 * filename is a distinction nobody wants explained on a tile. Falls back to the
 * mime subtype when a key genuinely carries no extension.
 */
function extensionOf(object: { key: string; mime: string | null }) {
  const fromKey = /\.([a-z0-9]{1,5})$/i.exec(object.key.split("/").pop() ?? "")?.[1];
  if (fromKey) return fromKey.toUpperCase();
  return (object.mime ?? "file").split("/").pop()?.toUpperCase() ?? "FILE";
}

/**
 * WHAT A DOCUMENT TILE SHOWS INSTEAD OF A PICTURE.
 *
 * **31 of the 70 rows are documents and they currently read as damage.** The
 * tile was a label floating in an empty band, so a folder of five papers
 * rendered as five identical grey boxes whose only distinguishing text was
 * `edw...omics.pdf` against `edw...lysis.pdf`: the middle-elision working
 * correctly on a string that should never have been the identifying one.
 *
 * The mockup's answer, verified in its source rather than in a description of
 * it: a small extension label top left, the TITLE in words, a few faint ruled
 * lines standing in for the text of the page, and one fact along the bottom.
 * A reader scanning that grid sees five different papers.
 *
 * **THERE IS NO BOTTOM LINE, BECAUSE THE FACT IT WOULD CARRY DOES NOT EXIST.**
 *
 * The mockup's card ends with "24 pages". In the mockup that string is FIXTURE
 * DATA, typed into its row table beside the size, and nothing computes it.
 * Nothing in this system stores a page count either: `media` carries bytes,
 * mime, width and height, and width and height are null for every PDF. Getting
 * one would mean fetching the object out of R2 and parsing it, per row, per
 * render, which is a network read for a decoration.
 *
 * The SIZE was put there instead for one render and it was worse, which is why
 * this note is longer than the code it explains. The mockup's tile has NO BODY:
 * the card IS the whole tile. This page's tile has always had a body, and that
 * body's meta line already prints the size, so a card foot carrying it too
 * rendered `1.4 MB` twice inside sixty pixels. A fact repeated is not a fact
 * confirmed; it reads as a bug, and it read as one on a screenshot.
 *
 * So the space is left empty, and the card is the extension, the title and the
 * suggestion of text. A page count goes in when a column holds one.
 * `check:admin-ui` holds both halves meanwhile: no invented page count, and the
 * size stated exactly ONCE per tile.
 *
 * THE RULED LINES ARE DECORATION and are marked so: `aria-hidden`, no text, no
 * meaning carried. They are the one thing here that suggests rather than states.
 */
function DocumentCard({
  object,
}: {
  object: { key: string; mime: string | null; originalName: string | null };
}) {
  const base = object.originalName ?? object.key.split("/").pop() ?? object.key;
  return (
    <span className="media-doc">
      <span className="media-doc-ext">{extensionOf(object)}</span>
      <span className="media-doc-main">
        <span className="media-doc-title">{docTitle(base)}</span>
        {/* Three rules, the last one short, which is what a paragraph of text
            looks like from across a room. Decoration only: it says nothing, so
            it is hidden from anything that reads rather than looks. */}
        <span className="media-doc-rules" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </span>
    </span>
  );
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
/**
 * The directory a key sits in, with its trailing slash, for the list row.
 *
 * The COUNTERPART to `displayName` dropping it. A content-addressed key has no
 * directory, and saying "Uploads" here would invent a folder that does not
 * exist in the key; the empty string is the honest answer and the cell simply
 * carries nothing. `folderOf` is not reused because it substitutes that word
 * deliberately, for a HEADING, where a bucket does need a name.
 */
function folderPrefix(key: string) {
  const at = key.lastIndexOf("/");
  return at > 0 ? `${key.slice(0, at)}/` : "";
}

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

/**
 * THE LIST'S HEADER ROW, and every cell in it is a LINK.
 *
 * The whole display state is a URL on this page, so a sort control has an
 * address and must be an anchor: it is shareable, bookmarkable, restored by the
 * back button and works with scripting off, which a click handler on a `<th>`
 * is none of. That is the same reasoning the Display popover's segmented
 * controls were built on, applied to the other control that changes a sort.
 *
 * **BOTH CONTROLS CALL `sortHref`, WHICH IS THE POINT.** A header and a popover
 * that build their own URLs are two implementations of one destination, and
 * they drift the way `q` and `role` drifted off their links. One builder means
 * choosing Size in the popover and pressing the Size header land on the same
 * page by construction; `check:admin-ui` asserts the two hrefs are byte-equal
 * per column over the rendered markup, and `test/media-view.test.mjs` asserts
 * the same property on the function.
 *
 * DIMS IS NOT SORTABLE AND SAYS SO BY BEING A SPAN. There is no `dims` sort
 * key, because half the library has no dimensions at all: 31 documents and
 * every SVG would collapse into one undifferentiated block at whichever end of
 * the order nulls land. So the column is a label rather than a dead link, which
 * is the mockup's own choice (its Dims entry carries no arrow and a no-op
 * handler) expressed in markup instead of in a disabled state.
 */
/**
 * The columns, in track order, and whether each one sorts.
 *
 * ONE LIST, so the header cannot grow a column the row does not have or lose
 * one the row still renders. `null` is Dims, which is a label rather than a
 * link; see the note above for why there is no `dims` sort key to point it at.
 */
const LIST_COLUMNS: Array<[sortKey: string | null, label: string, align: "start" | "end"]> = [
  ["name", "Name", "start"],
  ["usage", "Usage", "start"],
  [null, "Dims", "end"],
  ["size", "Size", "end"],
  ["added", "Added", "end"],
];

function MediaListHeader({
  view,
}: {
  view: Parameters<typeof sortHref>[0];
}) {
  /** The arrow the ACTIVE column carries, and no other column carries one. */
  const arrow = view.dir === "asc" ? "↑" : "↓";

  return (
    <div className="media-list-head" role="row">
      {/* Two empty leading cells, matching the checkbox and thumbnail tracks.
          They head nothing, so they say nothing. */}
      <span />
      <span />
      {LIST_COLUMNS.map(([key, label, align]) =>
        key === null ? (
          <span key={label} className="media-col-head is-unsortable" data-align={align}>
            {label}
          </span>
        ) : (
          <Link
            key={key}
            to={sortHref(view, key, { toggle: true })}
            className={`media-col-head${view.sort === key ? " is-active" : ""}`}
            /* ALIGNMENT AS DATA, never as `nth-of-type`. It was positional for
               one render and it was already wrong: `nth-of-type` counts among
               siblings of the SAME ELEMENT TYPE, and this row mixes anchors
               with spans, so "the fourth heading" and "the fourth anchor" are
               different cells. Size sat at the left of its track against a
               right-aligned Dims and the two headings collided. A column
               declares its own alignment beside its own label. */
            data-align={align}
            /* The key, so the narrow-viewport query can drop a heading BY NAME
               alongside the cell it labels, rather than by counting. */
            data-sort={key}
            // The SORT STATE, as the property assistive technology reads for a
            // sortable column. `none` on the others is not noise: it is what
            // says this column can be sorted and currently is not.
            aria-sort={
              view.sort === key ? (view.dir === "asc" ? "ascending" : "descending") : "none"
            }
          >
            {label}
            {/* The glyph is decoration over a state already announced above, so
                it is hidden rather than read out as an arrow. */}
            <span aria-hidden="true" className="media-col-arrow">
              {view.sort === key ? arrow : ""}
            </span>
          </Link>
        ),
      )}
      <span />
    </div>
  );
}

function CopyButton({
  value,
  label,
  /**
   * The accessible name, when the visible label is not a sentence.
   *
   * Defaults to the old shape, which is right for a tile whose label is a
   * filename ("Copy the address for plate-2019.png"). The inspector passes one
   * explicitly, because there the label is already an imperative and the default
   * produced "Copy the address for Copy address".
   */
  name,
  /**
   * Render the label as TEXT beside the glyph.
   *
   * **THE DEFAULT IS GLYPH-ONLY AND THAT IS MEASURED**: on a tile the word
   * "Copy" cost 41px of a 131px row and pushed the filename back into the
   * end-truncation this design exists to avoid. The inspector has the room, and
   * more importantly it NEEDS the words: three identical glyphs in a row are
   * three controls a reader has to press to tell apart, and the whole point of
   * the adaptive labels is that "HTML link" and "HTML tag" warn you which one
   * you are about to copy. A label only a screen reader can hear cannot do that.
   *
   * Found by `check:admin-ui`: the labels were computed, passed in, and rendered
   * nowhere, so the adaptive naming shipped invisible for one commit.
   */
  showLabel,
}: { value: string; label: string; name?: string; showLabel?: boolean }) {
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
            // ANNOUNCED as well as drawn. The data attribute drives a `::after`,
            // which is invisible to assistive technology; the toast is a live
            // region, so this is the half a screen reader actually gets.
            toast(`Copied ${value}`);
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
      {showLabel ? <span className="media-copy-label">{label}</span> : null}
      {/* The accessible name always, because the visible label is absent on a
          tile and is a fragment ("Markdown") even where it is present. */}
      <span className="sr-only">{name ?? `Copy the address for ${label}`}</span>
    </button>
  );
}

/**
 * DISPLAY CHANGES DO NOT TOUCH THE SERVER.
 *
 * Standing ruling, 2026-08-16: a control that does not change which data comes
 * back must not make a request. `view`, `size` and `group` decide how the
 * fetched page is drawn and never which rows it holds, so flipping one is a URL
 * change and a re-render and nothing else.
 *
 * The URL still updates, which is the half that is easy to lose: the state stays
 * shareable, the back button still walks the display history, and with scripting
 * off the same link is an ordinary link the server honours by parsing the same
 * parameter. Nothing here is built the slow way to preserve that.
 *
 * MEASURED on production 2026-08-16, before this existed: flipping List to Grid
 * fetched 17,889 bytes of loader data in a median 1629ms to redraw rows the
 * browser already had. The admin plane is never edge cached, so that was a full
 * round trip to the origin plus a D1 query for a CSS class change.
 *
 * Anything mixed falls through to the default: a URL that changes `view` AND
 * `sort` revalidates, because `sort` changes which rows page one holds.
 */
export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  // A submission always revalidates. `onlyDisplayChanged` already returns false
  // for identical URLs, which is the shape an after-action revalidation arrives
  // in, but stating it here means a later edit cannot make a write invisible.
  if (formMethod && formMethod !== "GET") return defaultShouldRevalidate;
  if (onlyDisplayChanged(currentUrl, nextUrl)) return false;
  return defaultShouldRevalidate;
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
  /*
   * THE THIRD AND LAST HARNESS SEAM, at the ruled ceiling of three.
   *
   * The bulk-trash confirmation opens from client state, so a single static
   * render can never reach it and the gate would be asserting the absence of
   * something structurally unreachable. Same shape as `initialSelection`: an
   * optional prop with a production default, never supplied by React Router.
   *
   * This is the surface that permanently hides files from the library in one
   * press, so leaving it outside the fixture is exactly the mistake the posts
   * index made with its bulk bar for a whole session.
   */
  initialConfirmingTrash = false,
}: Route.ComponentProps & {
  initialSelection?: string[];
  initialConfirmingTrash?: boolean;
}) {
  // Both JSON branches render nothing: they are data for a fetch, not a page.
  if (loaderData.picker || loaderData.palette) return null;
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
    view: loadedView,
    modified,
    trashedCount,
    tagCounts,
    lensCounts,
    usageNote,
  } = loaderData;

  /*
   * THE DISPLAY AXES COME FROM THE URL, not from the loader.
   *
   * `shouldRevalidate` below refuses to refetch when only these three changed,
   * so the loader's copy of them is deliberately stale on that path and the
   * live URL is the only thing that knows. Everything else on `view` is the
   * loader's, because everything else describes rows it actually fetched.
   *
   * On the server both sides read the same request URL, so this overlay is a
   * no-op in the no-script render and the markup is unchanged.
   */
  const [displayParams] = useSearchParams();
  const view = { ...loadedView, ...readDisplayAxes(displayParams) };

  /*
   * PENDING STATE, from the router and nothing else.
   *
   * A data-changing control on this plane costs a round trip to the origin plus
   * a D1 query: 1629ms median, MEASURED on production 2026-08-16. Without a
   * signal the page simply sits there, and the second press is the one that
   * makes a bulk action run twice.
   *
   * `useNavigation` already knows. There is no spinner, no timer and no state
   * of our own: one attribute the stylesheet dims, plus `aria-busy` so the
   * announcement is not a visual-only affordance.
   *
   * DISPLAY CHANGES ARE EXCLUDED. They resolve without the loader, so flagging
   * them would flash pending over a re-render that already happened, and would
   * teach the reader the indicator means nothing.
   */
  const navigation = useNavigation();
  const here = useLocation();
  const pending =
    navigation.state === "loading" &&
    navigation.location != null &&
    !onlyDisplayChanged(
      new URL(`${here.pathname}${here.search}`, "https://admin.local"),
      new URL(
        `${navigation.location.pathname}${navigation.location.search}`,
        "https://admin.local",
      ),
    );
  const activeLens = LENS_CHIPS.find((l) => l.id === view.lens);

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
  /** Whether the bulk-trash confirmation is open. Transient by nature. */
  const [confirmingTrash, setConfirmingTrash] = useState(initialConfirmingTrash);
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

  /** A tag chip toggles: pressing the active one clears it. */
  const tagHref = (tag: string) => linkTo({ tag: view.tag === tag ? "" : tag, page: 1 });

  return (
    <Panel
      title="Media"
      // Written for someone looking for a picture, and it now describes the
      // control the page actually has. The previous line told the reader to copy
      // a filename beside tiles that showed a name and offered no copy button.
      /*
        A COUNT LINE, which is what the mockup has, not a sentence of prose.
        "31 files, 0 in trash" tells the reader the size of the thing they are
        about to search; the old sentence told them what a media library is,
        which they knew.
      */
      description={`${loaderData.lensCounts.all} file${loaderData.lensCounts.all === 1 ? "" : "s"}, ${loaderData.trashedCount} in trash`}
      /*
        UPLOAD AND MAINTENANCE MOVE BESIDE THE TITLE.

        They were a full-width row of their own directly under the head,
        which cost a whole band of vertical space to say "upload" and was
        one of the seven rows standing between the top of the page and the
        grid, where the design has four. An action belongs on the heading of
        the thing it acts on.
      */
      actions={
        <>
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
          {/*
            ONE BUTTON, top right, not a bare file input in the content flow.

            The label IS the affordance and it names the enhancement that
            already exists: "Drop files anywhere, or browse". The file input is
            still there and still the keyboard path; it is visually folded into
            the label so the control reads as one thing.
          */}
          {/*
            ONE CONTROL. The label is the button and the file input is folded
            inside it, so the head shows a single affordance that names the
            enhancement rather than a bare "Choose File" widget in the content
            flow. The input is still a real input and still the keyboard path.
          */}
          <label className="media-upload-label" htmlFor="media-file">
            Drop files anywhere, or browse
          </label>
          <input
            ref={fileRef}
            id="media-file"
            type="file"
            name="file"
            accept={ACCEPT_ATTRIBUTE}
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
        </>
      }
    >

      {/*
        SEARCH AND FILTER, as a GET form, borrowed from the posts list.

        The filter state lives in the URL, so it survives a reload, is linkable,
        is what the back button restores, and works with scripting off with no
        enhancement at all. A plain <form>, not react-router's <Form>, because
        the browser's own submission already produces the navigation wanted.

        The role rides along as a hidden field so searching does not silently
        widen the group the reader chose.
      */}
      {/*
        ONE WIDE BAR. No separate SEARCH label block and no adjacent Search
        button, because the mockup has neither and both were noise: a search
        input needs no label when its placeholder is the instruction, and Enter
        already submits.

        THE PLACEHOLDER CARRIES THE COUNT, which is the mockup's move and a good
        one: it tells you how big the haystack is before you type. The count is
        the library's, from the loader, not a guess.

        NO Cmd+K AFFORDANCE IS RENDERED. The mockup shows one; this page has no
        such shortcut, and the earlier ruling against documenting absent
        shortcuts applies unchanged. It goes in when the shortcut does.
      */}
      <Form method="get" action="/admin/media" className="media-search" role="search">
        <input
          id="media-q"
          type="search"
          name="q"
          defaultValue={q}
          placeholder={`Search ${lensCounts.all} files`}
          aria-label={`Search ${lensCounts.all} files by name, address, alt text or caption`}
          className="media-search-input"
        />
        {/* Every other axis rides along as hidden fields, or searching would
            silently drop the reader out of the lens and folder they chose. This
            is the evaporation rule applied to a form rather than a link. */}
        <input type="hidden" name="lens" value={view.lens} />
        <input type="hidden" name="group" value={view.group} />
        <input type="hidden" name="view" value={view.view} />
        <input type="hidden" name="sort" value={view.sort} />
        <input type="hidden" name="dir" value={view.dir} />
        <input type="hidden" name="size" value={view.size} />
        <input type="hidden" name="role" value={view.role} />
        <input type="hidden" name="tag" value={view.tag} />
        <input type="hidden" name="trash" value={view.trash ? "1" : ""} />
        {q ? (
          <Link to={linkTo({ q: "", page: 1 })} className="btn-ghost">
            Clear
          </Link>
        ) : null}
        {/*
          THE Cmd+K AFFORDANCE, WHICH MAY NOW BE RENDERED.

          The v6.4 pass deliberately left it out with a note: "NO Cmd+K
          AFFORDANCE IS RENDERED. The mockup shows one; this page has no such
          shortcut, and the earlier ruling against documenting absent shortcuts
          applies unchanged. It goes in when the shortcut does." The shortcut
          went in with the palette below, so the badge goes in with it. The
          ruling is satisfied rather than waived.

          aria-hidden: it is a picture of a key combination, and a screen reader
          announcing "command K" beside a search field it can already reach adds
          nothing. The binding itself is listed in the shortcuts popover.
        */}
        <span className="media-search-kbd" aria-hidden="true">
          {"⌘K"}
        </span>
      </Form>
      {/*
        THE PALETTE, mounted AFTER the form and rendering nothing on the server.

        It attaches to the input above by id rather than owning it, so with
        scripting off the form is untouched and still navigates. Everything the
        palette adds is additive: live results, arrow keys, Enter to copy.
      */}
      <MediaPalette inputId="media-q" />

      {/* THE FACET ROW, from the ratified mockup: a label, the chips, and a
          hint that says who owns this axis.

          "assigned by the system" is the line the mockup was approved for, and
          it is doing real work: `role` is DERIVED by `roleOf()` from the key,
          so a reader who thinks it is an editable label will look for an editor
          that does not exist and conclude the page is broken. Saying it once
          here costs a phrase and closes that. */}
      <div className="media-facet">
        {/*
          THE QUALITY LENSES, which replaced the role chips as the primary row.

          Role was the SYSTEM'S classification (Content / Generated / Brand /
          Icons), and once every section carries a folder heading it says the
          same thing twice. A lens says what a heading cannot: which files
          nothing references, which duplicate each other, which have no alt
          text, which are large. Those are the questions somebody actually has.

          Role stays reachable by URL (?role=brand) and is no longer a row.
        */}
        <span className="media-facet-label" id="media-facet-lens">
          Show
        </span>
        <nav aria-labelledby="media-facet-lens" className="media-filters">
          <Link
            to={linkTo({ lens: "", trash: false, page: 1 })}
            className={`search-chip${!view.lens && !view.trash ? " is-active" : ""}`}
            aria-current={!view.lens && !view.trash ? "page" : undefined}
          >
            All <span className="search-chip-count">{lensCounts.all}</span>
          </Link>
          {LENS_CHIPS.map((lens) => {
            const n = lensCounts[lens.id === "no-alt" ? "noAlt" : lens.id];
            return (
              <Link
                key={lens.id}
                to={linkTo({ lens: lens.id, trash: false, page: 1 })}
                className={`search-chip${view.lens === lens.id ? " is-active" : ""}`}
                aria-current={view.lens === lens.id ? "page" : undefined}
                title={lens.hint}
              >
                {/* THE DOT, only when the count is non-zero, which is the
                    mockup's own rule and a good one: a coloured dot beside a
                    zero is an alarm about nothing. Decoration over a number and
                    a word that both already say it, so it is hidden. */}
                {n > 0 ? (
                  <span className="media-lens-dot" data-lens={lens.id} aria-hidden="true" />
                ) : null}
                {lens.label} <span className="search-chip-count">{n}</span>
              </Link>
            );
          })}
          {/* Trash sits in the same row in the mockup, because it is the same
              kind of question: which files are in which state. */}
          <Link
            to={linkTo({ trash: !view.trash, lens: "", page: 1, key: "" })}
            className={`search-chip${view.trash ? " is-active" : ""}`}
            aria-current={view.trash ? "page" : undefined}
            title="A library view, not a takedown. A trashed file keeps its address and any page using it is unchanged."
          >
            Trash <span className="search-chip-count">{trashedCount}</span>
          </Link>
        </nav>
        <span className="media-facet-hint">
          {activeLens ? activeLens.hint : "everything the library knows about"}
        </span>
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
        {/*
          SELECT ALL SHOWN, IN THE CONTROLS ROW where the mockup has it.

          It was a row of its own between the notes and the grid, which is a
          whole band of vertical space for one checkbox and was one of the seven
          rows above the grid where the design has four. It is a view control
          like the layout toggle beside it, so it belongs in the row of view
          controls.

          Moved OUT of the wrapping bulk form deliberately and safely: it is a
          client-side toggle with no `name`, so it contributed nothing to that
          submission and `check:admin-ui` records no change for it. The
          checkboxes it toggles are still inside the form, which is what the
          bulk action actually reads.

          The ruled wording is unchanged: never the bare word "all" while a
          filter is active, because this only ever reaches the rows on screen.
        */}
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
              hrefFor={(id) => linkTo({ group: id })}
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
              /*
                THROUGH `sortHref`, the SAME builder the list header uses.
                It used to be `linkTo({ sort: id, page: 1 })`, which set the key
                and left `dir` at whatever the URL already carried: choosing
                Largest while ascending gave you the SMALLEST file, from a
                control labelled Largest. A sort key is not direction-neutral,
                so the choice carries its direction, and both controls read that
                pairing from one table. No toggle here: a popover option is a
                destination, and reversing is what the Direction group and the
                header press are for.
              */
              hrefFor={(id) => sortHref(view, id)}
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
          THE KEYBOARD SHORTCUTS, behind the mockup's "?" control.

          A `<details>` like the Display popover beside it, for the same reason:
          the open and close behaviour, the Escape key and the summary semantics
          are the platform's, and this needs no script at all. That matters more
          here than anywhere else on the page, because a panel documenting
          keyboard access that itself requires a mouse would be a joke at the
          reader's expense.

          THE LIST IS DERIVED FROM `MEDIA_SHORTCUTS`, not typed here, so a
          binding cannot be documented without existing. Everything in that
          table is implemented: the two global ones by the palette, the rest by
          the grid navigator.
        */}
        <details className="media-display media-shortcuts">
          <summary className="row-action" title="Keyboard shortcuts" aria-label="Keyboard shortcuts">
            ?
          </summary>
          <div className="media-display-panel media-shortcuts-panel">
            <span className="media-display-label">Keyboard</span>
            <dl className="media-shortcut-list">
              {MEDIA_SHORTCUTS.map((s) => (
                <div key={s.keys} className="media-shortcut">
                  <dt>
                    <kbd>{s.keys}</kbd>
                  </dt>
                  <dd>{s.what}</dd>
                </div>
              ))}
            </dl>
          </div>
        </details>

        {/* Trash MOVED to the lens row, where the mockup has it: it is the
            same kind of question as the other lenses, which files are in which
            state. Two Trash chips on one page was the duplicate this pass
            found by looking. */}
      </div>

      {/*
        THE LENS NOTE, as its own banner, and it is the thing that stops a lens
        being read as an accusation.

        A narrowed view makes a CLAIM: these files are unattached, these are
        duplicates. Each claim has a boundary, and the boundary is what the
        reader needs before acting on it. The unattached note is the one that
        matters most and the one that could only be written truthfully once the
        repository scan existed: before this session, "no reference was found in
        posts or in repository code" would have described a check nothing ran.

        `Show everything` is a LINK to the unnarrowed view, not a button. The
        lens is a URL, so leaving it is navigation.
      */}
      {!view.trash && lensNoteFor(view.lens) ? (
        <div className="media-lens-note">
          <p>{lensNoteFor(view.lens)}</p>
          <Link to={linkTo({ lens: "", page: 1 })} className="media-lens-clear">
            Show everything
          </Link>
        </div>
      ) : null}

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
        <p className="media-empty-trash">
          {/*
            A LINK TO THE CONFIRMATION, not a form with a prompt() handler.

            The old control called `prompt()` from `onSubmit`, so with scripting
            off the handler never ran and the form submitted straight through:
            the ceremony was script-only while the destruction was not. The
            confirmation is a URL now, so it is server-rendered and the ladder
            holds either way.
          */}
          <Link to={linkTo({ confirm: "empty-trash" })} className="btn-danger">
            Empty trash
          </Link>
          <span className="media-facet-hint">
            Deletes the objects. Anything a post cites is kept and named.
          </span>
        </p>
      ) : null}

      {/*
        THE EMPTY-TRASH CONFIRMATION, opened by `?confirm=empty-trash`.

        Server-rendered, so it exists with no script; cancel is a link back to
        the same view with the parameter cleared, and confirm is a real submit
        whose typed count the ACTION checks. The disabled button is earlier
        feedback once hydrated, never the gate.
      */}
      <MediaConfirm
        open={view.confirm === "empty-trash" && trashedCount > 0}
        title={`Permanently delete ${trashedCount} file${trashedCount === 1 ? "" : "s"}`}
        body={
          <>
            <p>
              Addresses are content hashes, so a deleted file cannot be restored
              by re-uploading it under the same URL. Anything a post cites is
              kept and named.
            </p>
            <p>
              Type <strong>{trashedCount}</strong> to confirm.
            </p>
          </>
        }
        requireTyped={String(trashedCount)}
        confirmLabel="Delete permanently"
        cancelHref={linkTo({ confirm: "" })}
      >
        <input type="hidden" name="intent" value="empty-trash" />
      </MediaConfirm>

      {/* ONE LINE, in words, and it states ONCE what Unused actually means.
          The chip now carries a number, and a number invites the reading
          "nothing uses these", which is stronger than the query can support:
          media_refs records what the RENDERER emitted, so an asset referenced
          by a route rather than by a post is uncited here. */}
      {/*
        THE ROLE-SHAPED SUMMARY LINE IS GONE. It read "Showing 20 content items
        of 16" and described an axis that is no longer the primary one, using
        counts that no longer agree with the lens row. The count line in the
        page head says the true thing once, and the section headings say the
        rest.
      */}

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
        <>
        {/*
          THE SCRIM, and it is a LINK rather than a div with a handler.

          Clicking outside a drawer closes it, and that expectation does not
          depend on script, so the mechanism must not either. A link to the same
          view with `key` cleared is the whole implementation, it works with
          scripting off, and it is the same URL the Close control uses, so there
          is one way to close and not two.

          `preventScrollReset` because closing is not a new place to be: the
          reader was looking at a grid and should still be looking at the same
          part of it.
        */}
        <Link
          to={linkTo({ key: "" })}
          className="media-detail-scrim"
          preventScrollReset
          aria-label="Close the inspector"
        />
        <section
          className="media-detail"
          /*
            A DIALOG in role, because that is what a scrim plus a focus trap
            makes it. Not a `<dialog>` element: that would need `showModal()` to
            behave, which is script, and this panel is server-rendered and has to
            work without any. The role and the label are what assistive
            technology reads either way, and `MediaDrawer` supplies the trap.
          */
          role="dialog"
          aria-modal="true"
          aria-label={`Details for ${detail.found ? (detail.originalName ?? detail.key) : detail.key}`}
          tabIndex={-1}
        >
          {detail.found ? (
            <>
              {/*
                THE STICKY HEAD, which the mockup has and which a scrolling
                drawer needs: the name of the thing you are reading about must
                not scroll away from the facts about it, and Close must stay
                reachable without scrolling back up.

                The name ELLIPSISES rather than wrapping. A content-addressed key
                is 20 characters of hash and a static one is a path; either can
                wrap to three lines and push the whole panel down. The full
                string is in the `title` and in the Address field below.

                The usage pill repeats the state the panel explains further down.
                That is deliberate: it is the one fact somebody opens this panel
                to check, and it belongs where the eye lands first.
              */}
              <header className="media-detail-head">
                <h3 title={detail.key}>{detail.originalName ?? detail.key}</h3>
                <span className="media-detail-usage-pill">
                  <span
                    className="media-usage-dot"
                    data-usage={detail.usage}
                    aria-hidden="true"
                  />
                  {usageDescriptor(detail.usage).label}
                </span>
                <Link
                  to={linkTo({ key: "" })}
                  className="media-detail-close"
                  preventScrollReset
                  aria-label="Close the inspector"
                  title="Close, or press escape"
                >
                  <span aria-hidden="true">&times;</span>
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
                  {/*
                    ALT TEXT, FOR IMAGES ONLY.

                    A document does not take alt text, so offering the field on
                    one invents an obligation the author cannot discharge. 31 of
                    the 70 rows are documents, and the field was on all of them.
                  */}
                  {detail.viewable ? (
                    <Form method="post" className="media-alt-form">
                      <input type="hidden" name="key" value={detail.key} />
                      <label htmlFor="detail-alt">Alt text</label>
                      <input
                        id="detail-alt"
                        name="alt"
                        defaultValue={detail.alt}
                        placeholder="Describe this image"
                        className="media-alt-input"
                        data-missing={detail.alt.trim() ? undefined : "yes"}
                      />
                      <button type="submit" name="intent" value="set-alt" className="btn-ghost">
                        Save alt
                      </button>
                      {/*
                        THE SUGGESTION, AS A SUBMIT BUTTON CARRYING ITS VALUE.

                        One press writes it, through the SAME `set-alt` intent
                        the field above submits, so the server keeps one writer
                        and check:admin-ui sees no new payload shape. The value
                        rides on the button rather than in a hidden field for the
                        reason the upload intent does: a button name and value
                        pin the token, a hidden field lands in the field list as
                        a bare name.

                        Offered only while the field is EMPTY. A suggestion
                        beside text somebody has already written is an invitation
                        to overwrite their sentence with a filename.

                        A FORM, not a click handler that fills the input, so it
                        works with scripting off like everything else here.
                      */}
                      {!detail.alt.trim() && detail.altSuggestion ? (
                        <button
                          type="submit"
                          name="alt"
                          value={detail.altSuggestion}
                          className="media-suggestion"
                          aria-label={`Use suggested alt text: ${detail.altSuggestion}`}
                        >
                          Use suggested: {detail.altSuggestion}
                        </button>
                      ) : null}
                    </Form>
                  ) : (
                    <p className="muted">
                      A document takes no alt text. Its link text is what a
                      reader hears, and that lives in the post.
                    </p>
                  )}

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
                    THE APPLIED TAGS AS CHIPS, each with a remove control, and
                    the SUGGESTIONS the path implies beside them.

                    Every one of these is a submit button on the SAME `set-tags`
                    intent, carrying the WHOLE resulting list as its value, with
                    ONE exception: the chip whose removal would leave nothing
                    submits `clear` instead, because an empty `tags` value is no
                    longer an instruction to clear. A button carries exactly one
                    name and value, so the marker replaces the list rather than
                    accompanying it. That
                    is deliberate: `setMediaTags` stays the one writer and the one
                    author of the delimiter rule, so a chip cannot become a second
                    way to write a tag that formats it differently. This table has
                    already been bitten once by two writers disagreeing about a
                    join character.

                    It also means every chip works with scripting off, which a
                    click handler mutating a text field would not.

                    A dashed outline on a suggestion and a solid one on an applied
                    tag, so the two differ by SHAPE and not only by a plus sign.
                  */}
                  {detail.tags.length > 0 || detail.tagSuggestions.length > 0 ? (
                    <Form method="post" className="media-tag-chips">
                      <input type="hidden" name="key" value={detail.key} />
                      <input type="hidden" name="intent" value="set-tags" />
                      {detail.tags.map((tag) => (
                        <button
                          key={`applied-${tag}`}
                          type="submit"
                          {...(detail.tags.length === 1
                            ? { name: "clear", value: "1" }
                            : {
                                name: "tags",
                                value: detail.tags.filter((t) => t !== tag).join(", "),
                              })}
                          className="media-tag-chip"
                          aria-label={`Remove tag ${tag}`}
                          title={`Remove tag ${tag}`}
                        >
                          {tag} <span aria-hidden="true">&times;</span>
                        </button>
                      ))}
                      {/*
                        CLEAR ALL, an explicit act with its own control.

                        Without it the only way to empty a long list would be to
                        remove chips one at a time, which is the kind of friction
                        that gets routed around. The point of the fix is that
                        clearing is DELIBERATE, not that it is tedious. Shown
                        only above one tag, because at exactly one tag the chip
                        beside it already does this and two controls for one act
                        is noise.
                      */}
                      {detail.tags.length > 1 ? (
                        <button
                          type="submit"
                          name="clear"
                          value="1"
                          className="media-tag-chip media-tag-clear"
                          title={`Remove all ${detail.tags.length} tags`}
                        >
                          Clear all
                        </button>
                      ) : null}
                      {detail.tagSuggestions.map((tag) => (
                        <button
                          key={`suggested-${tag}`}
                          type="submit"
                          name="tags"
                          value={[...detail.tags, tag].join(", ")}
                          className="media-tag-suggestion"
                          aria-label={`Add suggested tag ${tag}`}
                        >
                          <span aria-hidden="true">+</span> {tag}
                        </button>
                      ))}
                    </Form>
                  ) : null}

                  {/*
                    THE ADDRESS, in the three forms an author actually pastes,
                    and THE LABELS CHANGE WITH THE FILE.

                    An image goes into a post as `![alt](src)` and a document
                    goes in as `[title](href)`, so a control labelled HTML has to
                    produce a different thing for each. It produced an `<img>`
                    tag for all seventy rows, which for the 31 documents is a
                    snippet that renders a broken image where a link was wanted.
                    The label is what stops somebody pressing it: "HTML tag" for a
                    picture, "HTML link" for a paper.

                    `copySnippetsFor` owns both the label and the value, so the
                    two cannot disagree, and it is unit tested with the document
                    case asserting that no `<img>` ever reaches one.
                  */}
                  <div className="media-detail-copy">
                    <h4>Copy</h4>
                    {copySnippetsFor({
                      url: detail.url,
                      viewable: detail.viewable,
                      alt: detail.alt,
                      base: detail.originalName ?? detail.key.split("/").pop() ?? detail.key,
                    }).map((snippet) => (
                      <CopyButton
                        key={snippet.id}
                        value={snippet.value}
                        label={snippet.label}
                        name={snippet.name}
                        showLabel
                      />
                    ))}
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
                      <ul className="media-detail-refs">
                        {detail.twins.map((twin) => (
                          <li key={twin.key}>
                            {/*
                              THE SENTENCE THE MOCKUP WRITES, per twin, because
                              it is the one that makes the offer safe to accept.

                              "Byte-identical" says the comparison was exact, not
                              a similarity score. "Both addresses resolve to the
                              same content" says what a reader most needs before
                              trashing one: the surviving address serves the same
                              bytes, so no published page changes. Naming the twin
                              in the button is the other half; "trash that one"
                              was ambiguous on a panel showing two files.
                            */}
                            <p className="media-twin-note">
                              Byte-identical to{" "}
                              <Link to={linkTo({ key: twin.key })}>{twin.key}</Link>, both
                              addresses resolve to the same content.
                            </p>
                            <Form method="post" className="media-twin-form">
                              <input type="hidden" name="key" value={twin.key} />
                              <button
                                type="submit"
                                name="intent"
                                value="trash"
                                className="media-destructive"
                              >
                                Keep this, trash {twin.originalName ?? twin.key.split("/").pop() ?? twin.key}
                              </button>
                            </Form>
                          </li>
                        ))}
                      </ul>
                      <p className="muted">
                        Trashing one hides it from the library. Every address
                        keeps working and no page changes.
                      </p>
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

                  {/*
                    USAGE, IN THREE STATES, each with its title, its sentence and
                    the evidence behind it.

                    This section used to have two outcomes and the second one was
                    a confession: "an asset a route references in code would look
                    the same here". It was true, it was written by somebody who
                    knew the answer was incomplete, and it appeared on nine
                    photographs the site serves on every visit.

                    Now the third state has evidence of its own and the panel
                    names it. The heading is the CLAIM, the sentence is its
                    BOUNDARY, and the list underneath is what was actually found:
                    posts for `used`, source files for `in template`.
                  */}
                  <div className="media-detail-usage" data-usage={detail.usage}>
                    <h4>Usage</h4>
                    {!detail.scanComplete ? (
                      <p className="muted">The reference scan failed, so usage is unknown.</p>
                    ) : (
                      <>
                        <p className="media-usage-claim">
                          <span
                            className="media-usage-dot"
                            data-usage={detail.usage}
                            aria-hidden="true"
                          />
                          <strong>{usageDescriptor(detail.usage).title}.</strong>{" "}
                          {usageDescriptor(detail.usage).note}
                        </p>

                        {/* THE POSTS, which is what `used` is evidence of. */}
                        {detail.refs.length > 0 || detail.citations.length > 0 ? (
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
                        ) : null}

                        {/*
                          THE SOURCE FILES, which is what `in template` is
                          evidence of, and the whole reason the state exists.

                          Repo-relative paths rather than the mockup prose labels
                          ("Phage Hunters roster, page template"): those were
                          authored strings in a fixture, and a path is a fact the
                          reader can open and check. Not links, because the admin
                          has no source browser and a link to nothing is worse
                          than text.
                        */}
                        {detail.templateRefs.length > 0 ? (
                          <ul className="media-detail-refs media-template-refs">
                            {detail.templateRefs.map((file) => (
                              <li key={`tpl-${file}`}>
                                <code>{file}</code>{" "}
                                <span className="muted">references this address</span>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
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
                        /*
                         * EARLIER FEEDBACK, NOT THE GATE. The action checks the
                         * same thing server-side, because this handler does not
                         * run for a reader without JavaScript and the R2 delete
                         * did. On accept it fills the field the server reads, so
                         * a scripted operator is asked once rather than twice.
                         */
                        if (!confirm(`Delete ${detail.key}? This removes the object from R2.`)) {
                          event.preventDefault();
                          return;
                        }
                        const field =
                          event.currentTarget.elements.namedItem(CONFIRM_FIELD);
                        if (field instanceof HTMLInputElement) field.value = "1";
                      }}
                    >
                      <input type="hidden" name="key" value={detail.key} />
                      {/* Empty with scripting off, which is what makes the action
                          refuse and open the confirmation below. */}
                      <input type="hidden" name={CONFIRM_FIELD} defaultValue="" />
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
              <Link to={linkTo({ key: "" })} preventScrollReset>
                Back to the library
              </Link>
              .
            </p>
          )}
        </section>
        {/* Escape, the focus trap and focus return. Renders nothing; with no
            script the drawer still opens, works and closes by its own links. */}
        <MediaDrawer activeKey={detail.key} closeHref={linkTo({ key: "" })} />
        </>
      ) : null}

      {objects.length === 0 ? (
        /*
          THREE EMPTY STATES, NOT ONE, because they mean three different things
          and the reader needs a different next step from each.

          The page had one muted sentence for all of them, which is the shape
          that tells somebody with an empty library to "try all media" and
          somebody with a typo to do the same thing.

            LIBRARY EMPTY   nothing has ever been here. Explain what the library
                            is FOR and offer the one action that fills it. This
                            is the only state that gets a heading and a button,
                            because it is the only one where the reader has
                            nothing to undo.

            SEARCH MISS     the query matched nothing. Name the query back, say
                            what was searched so the reader can tell a typo from
                            a wrong assumption, and offer to clear it.

            LENS EMPTY      the lens found nothing, which is GOOD NEWS and reads
                            as an error unless it says so. "Every file passes
                            this check" is the mockup's line and it is the right
                            one.
        */
        <div className="media-empty" data-empty={q ? "search" : lensCounts.all === 0 ? "library" : "lens"}>
          {lensCounts.all === 0 && !q ? (
            <>
              <p className="media-empty-title">Nothing here yet</p>
              <p className="media-empty-body">
                Files you upload get a content-hashed address you can paste into
                any post. Anything committed to the repository shows up
                automatically after a deploy.
              </p>
              <label className="btn media-empty-action" htmlFor="media-file">
                Upload the first file
              </label>
            </>
          ) : q ? (
            <>
              <p className="media-empty-title">
                Nothing matches &ldquo;{q}&rdquo;
              </p>
              <p className="media-empty-body">
                Searched paths, names, alt text and tags.{" "}
                <Link to={linkTo({ q: "", page: 1 })}>Clear the search</Link>, or
                look in <Link to={linkTo({ q: "", role: "all", lens: "", page: 1 })}>every group</Link>.
              </p>
            </>
          ) : (
            <>
              <p className="media-empty-title">Nothing in this view</p>
              <p className="media-empty-body">
                Every file passes this check.{" "}
                <Link to={linkTo({ lens: "", role: "all", page: 1 })}>Show everything</Link>.
              </p>
            </>
          )}
        </div>
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
              {/*
                THE SIZE OF WHAT IS SELECTED, which is the number the mockup puts
                beside the count and the one that answers the question somebody
                selecting a dozen files is actually asking: how much is this.
                A count of twelve says nothing about whether they are thumbnails
                or a conference poster.
              */}
              <span className="posts-bulk-size">
                {formatBytes(
                  objects
                    .filter((o) => chosen.includes(o.key))
                    .reduce((sum, o) => sum + o.size, 0),
                )}
              </span>
            </p>
            {/*
              COPY ADDRESSES, one per line, for the selection.

              `type="button"` so it never submits the form it sits inside, and
              the only client-side control in this bar: everything beside it is a
              real submission. One address per line because that is what pastes
              usefully into a document, and a comma-separated list is not
              something anybody wants.
            */}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                const addresses = objects
                  .filter((o) => chosen.includes(o.key))
                  .map((o) => o.url)
                  .join("\n");
                navigator.clipboard
                  .writeText(addresses)
                  .then(() =>
                    toast(
                      `Copied ${chosen.length} address${chosen.length === 1 ? "" : "es"}`,
                    ),
                  )
                  .catch(() => toast("The clipboard refused. Open a file to copy its address."));
              }}
            >
              Copy addresses
            </button>
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
            {/*
              MOVE TO TRASH, for the selection. Reversible, touches no object and
              no public URL, so it takes a plain confirmation rather than the
              type-the-count ceremony reserved for the irreversible delete.

              A `type="button"` that opens the confirmation, because the confirm
              lives in the modal and submitting from here would skip it. The
              modal's own submit carries the same form's selected keys.
            */}
            <button
              type="button"
              className="btn"
              onClick={() => setConfirmingTrash(true)}
            >
              Move to trash
            </button>
            {/* Escape clears too, and nobody discovers Escape. */}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setSelected([])}
            >
              Clear
            </button>
          </div>
        ) : null}

        {/*
          GROUPED PAGE-LOCAL. Each page buckets the rows IT HAS; a group never
          spans a page boundary. That is a ruling, not a shortcut, and the
          grounds are on `groupRows`: fetching the whole library to group
          globally is fine at 70 rows and wrong at 700, and letting a group
          resume on page two reads as a bug to everyone who sees it.

          The heading therefore counts THIS PAGE and says so, because a count
          that looked like a library total would be the over-promise again.

          BRACED. Without the braces this is JSX CHILDREN TEXT, not a comment,
          and the whole paragraph renders on the page. It did, and it was
          caught by looking rather than by any gate: check:admin-ui reads
          submissions and structure, and a comment leaking into the document
          changes neither.
        */}
        {/*
          THE HEADER ROW, ONCE, above every group rather than once per group.

          Column headings describe the TABLE, and a heading repeated above each
          folder would say the same five words four times while making each
          group look like a table of its own. The grouping is still real: the
          folder headings sit below this, and the columns line up across all of
          them because every row is laid out on the same fixed track list rather
          than on a shared grid.
        */}
        {view.view === "list" && objects.length > 0 ? (
          <MediaListHeader view={view} />
        ) : null}

        {groupRows(objects, view.group).map((bucket) => (
        <section key={bucket.label || "ungrouped"} className="media-group">
          {bucket.label ? (
            <h3 className="media-group-heading">
              <span className="media-group-title">{bucket.label}</span>
              <span className="media-group-count">
                {bucket.rows.length} on this page
              </span>
              {/*
                THE NOTE, right-aligned and quiet, and it is the reason this
                grouping exists. "Placed by the roster page template" is the
                sentence that stops somebody deleting nine photographs because
                a post-level tracker called them unreferenced.

                Quiet by SIZE and WEIGHT, never by an unreadable grey: the
                mockup's #A79C8A measures 2.34 to 1 and does not ship. This
                resolves to --text-muted.
              */}
              {bucket.note ? (
                <span className="media-group-note">{bucket.note}</span>
              ) : null}
            </h3>
          ) : null}
        <ul
          className="media-grid"
          data-view={view.view}
          data-size={view.size}
          data-pending={pending || undefined}
          aria-busy={pending || undefined}
        >
          {bucket.rows.map((object) => {
            const name = displayName(object);
            /* `cited` was here and is gone with the two-state meta line that
               was its only reader. Usage is a three-state descriptor now. */
            /*
             * THE THREE-STATE DESCRIPTOR AND THE PER-ROW FLAGS, from the pure
             * module. The row does not decide either: `usage` arrives from the
             * loader, and `flagsFor` is the one definition of what a flag is, so
             * the lens that selects rows and the badge that labels them cannot
             * drift.
             */
            const usage = usageDescriptor(object.usage);
            const flags = flagsFor({
              viewable: object.viewable,
              alt: object.alt,
              size: object.size,
              twinCount: object.twinCount,
            });
            const tileFlag = tileFlagFor({
              flags,
              usage: object.usage,
              twin: object.twinCount > 0 ? name : null,
            });
            /*
             * WHETHER THIS TILE WEARS THE CAPTION BAR.
             *
             * **NO NEW CLIENT STATE.** Both halves already exist and neither is
             * invented here: `chosen` is the selection this page has carried
             * since bulk actions landed, and `view.key` is the inspector, which
             * is a URL parameter like every other. So the caption is a function
             * of state the page already holds, which is why it costs nothing.
             *
             * GRID ONLY. In the list a row already has columns for the size and
             * the dimensions, so a bar laid over a 44px thumbnail would be the
             * same three facts a second time, in less room.
             *
             * Deliberately NOT on hover. Hover is not a state the server can
             * render, and reaching it would mean either script or a CSS rule
             * that reveals a control the keyboard cannot get to first. The
             * mockup shows it on hover AND on the active tile; this page keeps
             * the half that has an address.
             */
            const showCaption =
              view.view === "grid" && (chosen.includes(object.key) || view.key === object.key);
            return (
              <li
                key={object.key}
                className="media-card"
                /* The keyboard navigator addresses tiles by this attribute and
                   reads their rendered boxes for the grid geometry. It is the
                   only thing tying the island to the markup, and it is the key
                   rather than an index so a reflow cannot change what it means. */
                data-tile={object.key}
                data-selected={chosen.includes(object.key) || undefined}
                data-active={view.key === object.key || undefined}
                data-kind={object.viewable ? "image" : "document"}
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
                {/*
                  THE FRAME EXISTS SO THE CAPTION CAN BE A SIBLING OF THE LINK
                  RATHER THAN A CHILD OF IT.
                  The caption carries the copy control, and a <button> inside an
                  <a> is invalid HTML that browsers resolve differently: the
                  press either navigates or copies depending on who you ask.
                  Wrapping both in one positioned box is what lets the bar sit
                  over the picture while staying outside the anchor.
                */}
                <span className="media-thumb-frame">
                {/*
                  `preventScrollReset` is what stops opening a file throwing the
                  reader back to the top of the library.

                  `<Link>` is a CLIENT-SIDE transition, so there is no document
                  reload, but `<ScrollRestoration>` in root treats every new
                  location as a new place and scrolls to top. Opening an
                  inspector is not going somewhere else, it is looking closer at
                  where you already are, and the grid behind the drawer must
                  still be showing the tile you clicked.
                */}
                <Link
                  to={linkTo({ key: object.key })}
                  className="media-thumb-link"
                  preventScrollReset
                  /*
                    SHIFT OR META CLICK SELECTS INSTEAD OF OPENING.

                    This is the mockup's behaviour and it is what every file
                    manager does: a modified click extends or toggles a
                    selection rather than navigating. Without it, building a
                    selection in the grid means hunting for 31 small checkboxes,
                    and shift-clicking a range is impossible because the first
                    click navigates away.

                    `preventDefault` only inside the branch, so an UNMODIFIED
                    click is untouched and still a plain link: with no script it
                    navigates as it always did, and ctrl-click to open in a new
                    tab still works because that is meta on this platform and
                    lands on the same guard the mockup uses.

                    The range logic is `selectRange`, already written for the
                    checkbox, so shift-click in the grid and shift-click on a
                    checkbox extend the same way from the same anchor.
                  */
                  onClick={(event) => {
                    if (!event.shiftKey && !event.metaKey && !event.ctrlKey) return;
                    event.preventDefault();
                    selectRange(object.key, event.shiftKey);
                  }}
                >
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
                    /*
                     * A DOCUMENT USED TO GET A SHORTER BOX, and it no longer
                     * does. The old reason was written down and was true at the
                     * time: "there is nothing to look at, so it must not claim
                     * the same height as a picture", and 5:2 kept a wall of
                     * empty bands from claiming a picture's canvas.
                     *
                     * THERE IS SOMETHING TO LOOK AT NOW. `DocumentCard` puts a
                     * title, a suggestion of text and a size in that space, so
                     * the premise the squash was built on is gone, and a squashed
                     * card would crush the thing that fixed it. Back to 3:2,
                     * which is also the ratio every tile has in the mockup.
                     */
                    data-kind={object.viewable ? "image" : "document"}
                  >
                    {/* A document has no thumbnail the Images binding can ever
                        produce, so it gets a CARD rather than an <img> pointed
                        at something that cannot render one. 31 of the 70 rows
                        are documents; an empty box for each read as 31 loading
                        failures, which is what this replaces. */}
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
                      <DocumentCard object={object} />
                    )}
                  </span>
                </Link>

                {/*
                  THE CORNER FLAG, one dot, on the tile.

                  `tileFlagFor` picks the single most urgent of the row's flags
                  rather than stacking three on a 150px tile. Its `title` is the
                  sentence; the dot is the glance. Rendered outside the caption
                  so a selected tile shows both.
                */}
                {tileFlag ? (
                  <span
                    className="media-tile-flag"
                    data-flag={tileFlag.id}
                    title={tileFlag.title}
                  >
                    <span className="sr-only">{tileFlag.title}</span>
                  </span>
                ) : null}

                {/*
                  THE CAPTION BAR, over the picture, on the tile the reader has
                  picked out. Filename, size and dimensions, and the page's one
                  job in the corner of it.

                  It is the tile's ONLY copy control when it renders: the body's
                  copy button is suppressed below rather than drawn twice. Two
                  buttons with the same accessible name on one card is a thing
                  a screen reader reads twice and a pointer picks between for no
                  reason, and the payload is identical either way, so there is
                  nothing to trade off.
                */}
                {showCaption ? (
                  <span className="media-caption">
                    <span className="media-caption-text">
                      <span className="media-caption-name">{name}</span>
                      {/* Size, then the dimensions WHEN THERE ARE ANY. A
                          document has none and never will, and "1.4 MB · not
                          measured" spends the caption's second line saying that
                          a PDF is not a picture. The list has a Dims column
                          where an absence belongs, because there a blank cell
                          is a value; here it is just a phrase in the way. */}
                      <span className="media-caption-meta">
                        {formatBytes(object.size)}
                        {object.width && object.height
                          ? ` · ${formatDims(object.width, object.height)}`
                          : ""}
                      </span>
                    </span>
                    <CopyButton value={object.url} label={name} />
                  </span>
                ) : null}
                </span>

                {/*
                  THE BODY IS `display: contents` IN BOTH LAYOUTS, so its
                  children are laid out by the CARD rather than by it.

                  That is what keeps this ONE MARKUP TREE while the list becomes
                  a real eight-column table. A row's cells have to be grid items
                  of the row, and they cannot be if a wrapper sits between them;
                  a second JSX branch for the list would be a second place for a
                  control to go missing, which is exactly what this page's
                  layout rule forbids. The wrapper stays because it names the
                  group, and it stops laying anything out.
                */}
                <div className="media-card-body">
                  {/* THE NAME CELL. In the grid it is the line under the
                      picture; in the list it is column three, and it carries
                      the directory underneath, which is the half the grid
                      cannot afford to show. */}
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
                      preventScrollReset
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
                    {/* THE DIRECTORY, under the name, LIST ONLY.

                        `displayName` drops the directory because nine roster
                        photographs share every character of theirs and the tile
                        had 109px to spend. A list row is not a tile: it has the
                        width, and without the folder two files with the same
                        basename in different directories are one row printed
                        twice. So the half the grid throws away comes back
                        exactly where there is room for it. */}
                    <span className="media-name-dir">{folderPrefix(object.key)}</span>
                  </div>
                  {/*
                    The grid's meta line. Hidden in the list, where the same
                    facts have columns of their own.

                    **IT SAID "unused" AND THAT WORD IS FORBIDDEN HERE.** The
                    line was written when the page had two states and it
                    survived the three-state model landing, so a tile could read
                    `content 189 kB · unused` while the row beneath it in the
                    list view said `in template` about the same file. Worse than
                    inconsistent: "unused" is the exact claim the usage ruling
                    says this page may never make, because the repository scan
                    cannot see a constructed path and nothing here can see an
                    external site linking a file. Nine roster photographs the
                    site serves on every visit were labelled unused.

                    It now reads the SAME descriptor every other surface reads,
                    so the tile, the row and the inspector cannot disagree.
                  */}
                  <p className="media-meta">
                    <span className="chip">{object.role}</span> {formatBytes(object.size)}
                    {scanComplete ? ` · ${usage.label}` : ""}
                  </p>
                </div>

                {/*
                  THE LIST'S REMAINING COLUMNS. Hidden in the grid by CSS rather
                  than omitted from the markup, per the one-tree rule above.

                  A cell that reads "not measured" is doing work: 31 documents
                  and every SVG have no dimensions, and printing 0x0 or an empty
                  cell would both read as a value rather than as an absence.
                */}
                {/*
                  THE USAGE CELL, three states rather than two, with its flags
                  underneath. `used` and `unattached` were the whole vocabulary
                  and it could not express the roster photographs, which the site
                  places on every visit and no post cites.

                  The dot is a SECOND CHANNEL beside a word, never the signal
                  itself, so a reader who cannot separate the hues loses nothing.
                */}
                <span className="media-col media-col-usage">
                  <span className="media-usage-line">
                    <span
                      className="media-usage-dot"
                      data-usage={scanComplete ? object.usage : "unknown"}
                      aria-hidden="true"
                    />
                    <span title={scanComplete ? usage.title : undefined}>
                      {scanComplete ? usage.label : "unknown"}
                    </span>
                  </span>
                  {/* duplicate, no alt, over 1 MB. A file can carry all three,
                      which is why this is a list and not a badge. */}
                  {flags.length > 0 ? (
                    <span className="media-row-flags">
                      {flags.map((f) => f.label).join(" · ")}
                    </span>
                  ) : null}
                </span>
                <span className="media-col media-col-dims">
                  {formatDims(object.width, object.height)}
                </span>
                <span className="media-col media-col-size">{formatBytes(object.size)}</span>
                <span className="media-col media-col-added">{formatAdded(object.uploaded)}</span>

                {/*
                  THE COPY CONTROL, ONE PER CARD, as the card's last child.

                  It was inside the name row, which made the name row two cells
                  wide and left the list with no eighth column to put it in.
                  Explicit grid placement puts it back beside the name in the
                  grid view, so the tile is unchanged to look at while the row
                  gains its column. It renders here only when the caption bar is
                  not already carrying it.
                */}
                {showCaption ? null : (
                  <span className="media-col-copy">
                    <CopyButton value={object.url} label={name} />
                  </span>
                )}
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
      {/*
        THE TWO PAGE-LEVEL ISLANDS. Both render nothing on the server: the toast
        is an empty live region until something speaks, and the navigator draws
        no markup at all. With scripting off neither exists and the page is
        exactly what it was.
      */}
      {/*
        THE BULK-TRASH CONFIRMATION, opened from CLIENT STATE rather than a URL.

        That asymmetry with the empty-trash modal is deliberate and is the
        honest one: this acts on the SELECTION, which is client state, inside a
        bulk bar that does not render without script at all. A URL cannot carry
        the selection, and pretending it could would be a no-script path that
        silently acts on nothing.

        The keys are re-rendered as hidden fields here rather than read from the
        grid's checkboxes, because this form is its own submission.
      */}
      <MediaConfirm
        open={confirmingTrash && chosen.length > 0}
        title={`Move ${chosen.length} file${chosen.length === 1 ? "" : "s"} to the trash`}
        body={
          <p>
            They stop showing in the library. Every address keeps working and no
            published page changes, so nothing here can cost a post its image.
            Restore puts them back.
          </p>
        }
        confirmLabel="Move to trash"
        onCancel={() => setConfirmingTrash(false)}
      >
        <input type="hidden" name="intent" value="bulk-trash" />
        {chosen.map((key) => (
          <input key={key} type="hidden" name="key" value={key} />
        ))}
      </MediaConfirm>

      {/*
        THE SINGLE-DELETE CONFIRMATION, opened by the ACTION refusing an
        unconfirmed delete rather than by a URL.

        Empty-trash next door is opened by `?confirm=`, because its target is
        the whole bin and needs no identifying. This one's target is a key the
        action already has in hand, and routing it through the URL would mean a
        second confirm vocabulary and a loader change for no gain. Both end at
        the same place: a server-rendered step whose typed count the action
        checks.

        Cancel is a Link, so it works with no script: it is an ordinary GET back
        to this view, which discards the action result.
      */}
      {/*
        THE REBUILD CONFIRMATION, opened by the action refusing an unconfirmed
        rebuild. Same shape as the single delete beside it: an unconfirmed
        destructive POST is the confirmation step, not an error.
      */}
      <MediaConfirm
        open={Boolean(actionData?.confirmRebuild !== undefined)}
        title="Re-derive the whole media index"
        body={
          <>
            <p>
              Every derived column is recomputed from the buckets and every
              authored one is preserved. Rows whose source object is GONE are
              removed, so running this against a bucket that is only partly
              readable prunes the index to whatever it managed to see.
            </p>
            <p>
              The index currently holds{" "}
              <strong>{actionData?.confirmRebuild ?? 0}</strong> row(s). Type{" "}
              <strong>1</strong> to confirm.
            </p>
          </>
        }
        requireTyped="1"
        confirmLabel="Rebuild the index"
        cancelHref={linkTo({})}
      >
        <input type="hidden" name="intent" value="rebuild" />
      </MediaConfirm>

      <MediaConfirm
        open={Boolean(actionData?.confirmDelete)}
        title={`Permanently delete ${actionData?.confirmDelete ?? ""}`}
        body={
          <>
            <p>
              This removes the object from R2. Addresses are content hashes, so a
              deleted file cannot be restored by re-uploading it under the same
              URL.
            </p>
            <p>
              Type <strong>1</strong> to confirm.
            </p>
          </>
        }
        requireTyped="1"
        confirmLabel="Delete permanently"
        cancelHref={linkTo({ key: actionData?.confirmDelete ?? "" })}
      >
        <input type="hidden" name="intent" value="delete" />
        <input type="hidden" name="key" value={actionData?.confirmDelete ?? ""} />
      </MediaConfirm>

      <MediaToast />
      {view.view === "grid" ? <MediaKeyboard /> : null}

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
