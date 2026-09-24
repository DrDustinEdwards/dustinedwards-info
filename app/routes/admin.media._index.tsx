import { useRef, useState } from "react";

import {
  Form,
  Link,
  data,
  useLocation,
  useNavigation,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";

import { timed, timingsContext } from "~/lib/timing";
import { AdminAlert } from "~/components/admin/alert";
import { MediaConfirm } from "~/components/admin/media-confirm";
import { MediaDisplayGroup } from "~/components/admin/media-display-group";
import { MediaEmptyState } from "~/components/admin/media-empty-state";
import { MediaGrid } from "~/components/admin/media-grid";
import { MediaInspector } from "~/components/admin/media-inspector";
import { DropAnywhere } from "~/components/admin/media-drop-anywhere";
import { MediaKeyboard, MediaToast } from "~/components/admin/media-keyboard";
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
import { digestFromKey, storageOf } from "~/lib/media/classify.mjs";
import {
  lensNoteFor,
  suggestedAlt,
  suggestedTags,
  usageStateOf,
} from "~/lib/media/usage.mjs";
import { CONFIRM_FIELD, confirmationSatisfied } from "~/lib/destructive.mjs";
import { normaliseTags, parseTags } from "~/lib/media/tags.mjs";
import {
  displaySummary,
  folderPrefix,
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

export function meta() {
  return [{ title: "Media · Admin" }, { name: "robots", content: "noindex" }];
}

const ROLE_IDS = new Set(["content", "generated", "brand", "icon"]);

/** About six rows fit under the search bar before the arrow keys scroll the highlight away. */
const PALETTE_RESULTS = 6;

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

/** A build-time import: the scan needs a filesystem and the Worker has none. */
const TEMPLATE_REFS: Record<string, string[]> = templateRefs.refs;
const TEMPLATE_REF_KEYS = Object.keys(TEMPLATE_REFS);

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const timings = context.get(timingsContext).timings;
  const loaderStart = performance.now();
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1") || 1;

  const picker = url.searchParams.get("picker") === "1";

  const palette = url.searchParams.get("palette") === "1";

  const view = readView(url.searchParams);

  const requested = url.searchParams.get("role");
  const filter = requested === "all" || (requested && ROLE_IDS.has(requested))
    ? requested
    : "content";

  const q = view.q;

  const listed = await timed(timings, "d1_list_media", () =>
    listMedia(env, {
    page,
    limit: picker ? 200 : MEDIA_PAGE_SIZE,
    ...(picker
      ? {}
      : {
          sort: view.sort,
          dir: view.dir,
          tag: view.tag,
          trashed: view.trash,
          lens: view.lens,
          templateKeys: TEMPLATE_REF_KEYS,
        }),
    // In SQL, never merged with `role`: a `?role=` must not widen what may be inserted.
    insertableOnly: picker,
    ...(picker
      ? {}
      : {
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

  /* No usage, citations or twins: three more queries per keystroke for nothing a picker needs. */
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

  /* Starts here, not at the loader top: earlier branches return and would leave a promise unawaited. */
  const [resolution, refs, twins, trashedCount, tagCounts, lensCounts] = await timed(
    timings,
    "group_listing",
    () =>
      Promise.all([
        timed(timings, "resolve_citations", () => resolveCitations(env, keys)),
        timed(timings, "d1_media_refs", () => mediaRefsFor(env, keys)),
        timed(timings, "d1_media_twins", () => mediaTwins(env)),
        timed(timings, "d1_trashed_count", () => mediaTrashedCount(env)),
        timed(timings, "d1_tag_counts", () => mediaTagCounts(env)),
        timed(timings, "d1_lens_counts", () => mediaLensCounts(env, TEMPLATE_REF_KEYS)),
      ]),
  );

  /* A parameter, not a route: static keys contain `/`. */
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
        refs: (detailRefs.get(row.key) ?? []).map((ref) => ({
          sourceType: ref.sourceType,
          sourceId: ref.sourceId,
          form: ref.form,
          detail: ref.detail,
        })),
        citations: detailResolution.citations.get(row.key) ?? [],
        scanComplete: detailResolution.complete,
        tags: parseTags(row.tags ?? ""),
        trashedAt: row.trashedAt,
        hash: digestFromKey(row.key),
        twins: twins.get(row.key) ?? [],
        usage: usageStateOf({
          postRefs: (detailRefs.get(row.key) ?? []).length,
          citations: (detailResolution.citations.get(row.key) ?? []).length,
          templateRefs: (TEMPLATE_REFS[row.key] ?? []).length,
        }),
        templateRefs: TEMPLATE_REFS[row.key] ?? [],
        /** Suggested, never applied: a filename posing as alt hides a defect an empty field shows. */
        altSuggestion: suggestedAlt(row.originalName ?? row.key.split("/").pop() ?? row.key),
        tagSuggestions: suggestedTags(row.key).filter(
          (t) => !parseTags(row.tags ?? "").includes(t),
        ),
      };
    } else {
      detail = { found: false as const, key: detailKey };
    }
  }

  const uploaded = url.searchParams.get("uploaded");
  const uploadError = uploadErrorSentence(url.searchParams.get("upload-error"));

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
      viewable: isViewable(object.kind),
      citations: resolution.citations.get(object.key) ?? [],
      refCount: (refs.get(object.key) ?? []).length,
      tags: parseTags(object.tags ?? ""),
      twinCount: (twins.get(object.key) ?? []).length,
      usage: usageStateOf({
        postRefs: (refs.get(object.key) ?? []).length,
        citations: (resolution.citations.get(object.key) ?? []).length,
        templateRefs: (TEMPLATE_REFS[object.key] ?? []).length,
      }),
      templateRefs: TEMPLATE_REFS[object.key] ?? [],
    })),
    page,
    hasMore: listed.hasMore,
    filter,
    q,
    detail,
    uploaded,
    uploadError,
    scanComplete: resolution.complete,
    scanFailed: resolution.failed,
    view,
    modified: isModified(view),
    trashedCount,
    tagCounts,

    lensCounts: {
      ...lensCounts,
      duplicates: twins.size,
    },

    /* The scan sees only literal paths and no external links, hence unattached, not unused. */
    usageNote:
      "Usage is asked three ways: what a post cites, what the artifact scan " +
      "finds, and what repository code references. A file none of them names is " +
      "unattached rather than unused, because a path the code builds at runtime " +
      "is invisible to the scan and an external site can link anything.",
  };

  /* Not timing serialization: the framework encodes turbo-stream, so a stringify would mislead. */
  timings?.push({ name: "loader_total", ms: performance.now() - loaderStart });

  return data(payload);
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "bulk-add-tag" || intent === "bulk-remove-tag") {
    const keys = form.getAll("key").map(String).filter(Boolean);
    if (keys.length === 0) return { message: "Nothing selected." };

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
        // Rows already in the target state are skipped, so updated_at is not touched for nothing.
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

    /* An empty field does not clear; clearing needs `clear`, so an accident cannot wipe every tag. */
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

  /* Iterates the guarded delete per key, so `claimMediaKeyForDelete` still refuses a cited asset. */
  if (intent === "empty-trash") {
    const keys = await trashedMediaKeys(env);

    /* Checked here: the confirm button renders enabled without script. */
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
      // Static rows have no object to remove, so emptying leaves them binned.
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
    // Saving alt rewrites no post: alt is contextual, so only future insertions pick it up.
    await upsertMediaRecord(env, { key, alt: String(form.get("alt") ?? "") });
    return { message: `Alt text saved for ${key}. Existing posts are unchanged.` };
  }

  if (intent === "rebuild") {
    /* A rebuild prunes rows whose source is gone. Count 1: the rows at risk are unknowable beforehand. */
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
      `By role: ${roleBreakdown}`,
    ];
    if (report.removed > 0) {
      parts.push(`${report.removed} row(s) removed for sources that no longer exist`);
    }
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

    /* Checked here, not in `onSubmit`, so it holds without script; an uncited object passes the rest. */
    const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();
    if (!confirmationSatisfied(typed, 1)) {
      return { confirmDelete: key };
    }

    // Refused in the action, not by hiding a button: a deleted row would return on the next rebuild.
    if (storageOf(key) === "static") {
      return {
        message:
          `Delete refused: ${key} is a static asset, served from the repo rather than R2. ` +
          `Remove it with a commit that deletes the file, then rebuild the index.`,
      };
    }

    if (!isManagedKey(key)) return { message: "Not a managed media key." };

    // Server side on a fresh read: a post may have cited the object since the page rendered.
    const [resolution, refs] = await Promise.all([
      resolveCitations(env, [key]),
      mediaRefsFor(env, [key]),
    ]);

    // Fail closed: a failed scan is not "nothing cites it".
    if (!resolution.complete) {
      return {
        message: `Delete refused: the reference scan failed (${resolution.failed.join(", ")}), so it cannot be confirmed that nothing cites this object.`,
      };
    }

    // The refcount: content-addressed keys let posts share a blob, so any citation blocks the delete.
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

    /* One statement claims the row only if nothing cites it now. Row first: an orphan object backfills. */
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

function describeCitations(citations: MediaCitation[]) {
  const byItem = new Map<string, MediaCitation[]>();
  for (const citation of citations) {
    const list = byItem.get(citation.id);
    if (list) list.push(citation);
    else byItem.set(citation.id, [citation]);
  }
  const parts = [...byItem.entries()].map(([id, list]) => {
    const forms = [...new Set(list.map((c) => c.form))].join(", ");
    return `${list[0]?.title ?? ""} (${id}: ${forms}, ${list.map((c) => c.detail).join("; ")})`;
  });
  return `Still cited by ${parts.length} post${parts.length === 1 ? "" : "s"}: ${parts.join(" and ")}.`;
}

export function shouldRevalidate({
  currentUrl,
  nextUrl,
  formMethod,
  defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
  // A submission always revalidates, so no later edit can make a write invisible.
  if (formMethod && formMethod !== "GET") return defaultShouldRevalidate;
  if (onlyDisplayChanged(currentUrl, nextUrl)) return false;
  return defaultShouldRevalidate;
}

export default function AdminMedia({
  loaderData,
  actionData,
  initialSelection = [],
  initialConfirmingTrash = false,
}: Route.ComponentProps & {
  initialSelection?: string[];
  initialConfirmingTrash?: boolean;
}) {
  /* Every hook before the early return: the JSON branches below return null. */
  const [displayParams] = useSearchParams();
  const navigation = useNavigation();
  const here = useLocation();
  const [selected, setSelected] = useState<string[]>(initialSelection);
  const [confirmingTrash, setConfirmingTrash] = useState(initialConfirmingTrash);
  const anchor = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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

  /* From the URL: `shouldRevalidate` skips the loader for these, so its copy is stale. */
  const view = { ...loadedView, ...readDisplayAxes(displayParams) };

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

  const visible = objects.map((o) => o.key);
  const chosen = selected.filter((key) => visible.includes(key));
  const allShown = visible.length > 0 && chosen.length === visible.length;
  const toggle = (key: string) =>
    setSelected((was) => (was.includes(key) ? was.filter((k) => k !== key) : [...was, key]));

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
    setSelected((was) => [...new Set([...was, ...span])]);
  };


  const linkTo = (over: Parameters<typeof hrefWith>[1] = {}) => hrefWith(view, over);

  const tagHref = (tag: string) => linkTo({ tag: view.tag === tag ? "" : tag, page: 1 });

  return (
    <Panel
      title="Media"
      description={`${loaderData.lensCounts.all} file${loaderData.lensCounts.all === 1 ? "" : "s"}, ${loaderData.trashedCount} in trash`}
      actions={
        <>
        {/* The hidden `intent` alone selects the upload redirect branch. Images only. */}
        <Form
          method="post"
          action="/admin/media/upload"
          encType="multipart/form-data"
          className="media-upload"
        >
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
          <button type="submit" name="intent" value={UPLOAD_FORM_INTENT} className="btn">
            Upload
          </button>
        </Form>

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
        {/* Other axes ride as hidden fields, or searching would drop the lens and folder. */}
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
        <span className="media-search-kbd" aria-hidden="true">
          {"⌘K"}
        </span>
      </Form>
      <MediaPalette inputId="media-q" />

      <div className="media-facet">
        <span className="media-facet-label" id="media-facet-lens">
          Show
        </span>
        <nav aria-labelledby="media-facet-lens" className="media-filters">
          <Link
            to={linkTo({ lens: "", trash: false, page: 1 })}
            className={`admin-chip${!view.lens && !view.trash ? " is-active" : ""}`}
            aria-current={!view.lens && !view.trash ? "page" : undefined}
          >
            All <span className="admin-chip-count">{lensCounts.all}</span>
          </Link>
          {LENS_CHIPS.map((lens) => {
            const n = lensCounts[lens.id === "no-alt" ? "noAlt" : lens.id];
            return (
              <Link
                key={lens.id}
                to={linkTo({ lens: lens.id, trash: false, page: 1 })}
                className={`admin-chip${view.lens === lens.id ? " is-active" : ""}`}
                aria-current={view.lens === lens.id ? "page" : undefined}
                title={lens.hint}
              >
                {n > 0 ? (
                  <span className="media-lens-dot" data-lens={lens.id} aria-hidden="true" />
                ) : null}
                {lens.label} <span className="admin-chip-count">{n}</span>
              </Link>
            );
          })}
          <Link
            to={linkTo({ trash: !view.trash, lens: "", page: 1, key: "" })}
            className={`admin-chip${view.trash ? " is-active" : ""}`}
            aria-current={view.trash ? "page" : undefined}
            title="A library view, not a takedown. A trashed file keeps its address and any page using it is unchanged."
          >
            Trash <span className="admin-chip-count">{trashedCount}</span>
          </Link>
        </nav>
        <span className="media-facet-hint">
          {activeLens ? activeLens.hint : "everything the library knows about"}
        </span>
      </div>

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
                className={`admin-chip${view.tag === t.tag ? " is-active" : ""}`}
                aria-current={view.tag === t.tag ? "page" : undefined}
              >
                {t.tag} <span className="admin-chip-count">{t.n}</span>
              </Link>
            ))}
          </nav>
          <span className="media-facet-hint">yours, in the inspector</span>
        </div>
      ) : null}

      <div className="media-display-bar">
        {/* No `name`, so it stays out of the bulk form's submission. */}
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
              className={`admin-chip${view.view === id ? " is-active" : ""}`}
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
            {modified ? (
              <Link to="/admin/media" className="row-action">
                Reset to defaults
              </Link>
            ) : null}
          </div>
        </details>

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
      </div>

      {!view.trash && lensNoteFor(view.lens) ? (
        <div className="media-lens-note">
          <p>{lensNoteFor(view.lens)}</p>
          <Link to={linkTo({ lens: "", page: 1 })} className="media-lens-clear">
            Show everything
          </Link>
        </div>
      ) : null}

      {view.trash ? (
        <p className="media-usage-note">
          This is a library view, not a takedown. A trashed file keeps its
          address, and any published page using it is unchanged. Restore puts it
          back in the library.{" "}
          <strong>Only Empty trash deletes anything, and it still refuses
          anything a post cites.</strong>
        </p>
      ) : null}

      {view.trash && trashedCount > 0 ? (
        <p className="media-empty-trash">
          {/* A link, not `prompt()`, so the confirmation holds without script. */}
          <Link to={linkTo({ confirm: "empty-trash" })} className="btn-danger">
            Empty trash
          </Link>
          <span className="media-facet-hint">
            Deletes the objects. Anything a post cites is kept and named.
          </span>
        </p>
      ) : null}

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

      {/* Usage is what the renderer emitted, so a route-referenced asset reads as uncited. */}

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

      {!scanComplete ? (
        <AdminAlert title="Usage could not be determined" headingId="scan-failed">
          <p>
            The reference scan failed ({scanFailed.join(", ")}), so nothing below is
            labeled unused and every delete will be refused until it succeeds.
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
