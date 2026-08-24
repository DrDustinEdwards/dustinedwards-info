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
import { byteSize } from "~/lib/media/byte-size.mjs";
import { timed, timingsContext } from "~/lib/timing";
import { AdminAlert } from "~/components/admin/alert";
import { CopyButton } from "~/components/admin/media-copy-button";
import { MediaConfirm } from "~/components/admin/media-confirm";
import { MediaDisplayGroup } from "~/components/admin/media-display-group";
import { DocumentCard } from "~/components/admin/media-document-card";
import { MediaDrawer } from "~/components/admin/media-drawer";
import { MediaEmptyState } from "~/components/admin/media-empty-state";
import { MediaGrid } from "~/components/admin/media-grid";
import { MediaInspector } from "~/components/admin/media-inspector";
import { DropAnywhere } from "~/components/admin/media-drop-anywhere";
import { MediaListHeader } from "~/components/admin/media-list-header";
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
  displayName,
  displaySummary,
  docTitle,
  folderPrefix,
  formatAdded,
  formatDims,
  groupRows,
  hrefWith,
  isModified,
  middleTruncate,
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

      {detail ? <MediaInspector detail={detail} linkTo={linkTo} /> : null}

      {objects.length === 0 ? (
        <MediaEmptyState q={q} lensCounts={lensCounts} linkTo={linkTo} />
      ) : (
        <MediaGrid
          objects={objects}
          chosen={chosen}
          selectRange={selectRange}
          setSelected={setSelected}
          setConfirmingTrash={setConfirmingTrash}
          linkTo={linkTo}
          view={view}
          pending={pending}
          scanComplete={scanComplete}
          tagCounts={tagCounts}
        />
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
