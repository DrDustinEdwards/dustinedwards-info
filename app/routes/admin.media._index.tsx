import { useRef, useState } from "react";

import {
  Link,
  data,
  useLocation,
  useNavigation,
  useSearchParams,
  type ShouldRevalidateFunctionArgs,
} from "react-router";

import { timed, timedLoader } from "~/lib/timing";
import { AdminAlert } from "~/components/admin/alert";
import { MediaConfirmDialogs } from "~/components/admin/media-confirm-dialogs";
import { MediaDisplayBar } from "~/components/admin/media-display-bar";
import { MediaEmptyState } from "~/components/admin/media-empty-state";
import { MediaGrid } from "~/components/admin/media-grid";
import { MediaFacets } from "~/components/admin/media-facets";
import { MediaInspector } from "~/components/admin/media-inspector";
import { LiveNotice } from "~/components/admin/live-notice";
import { MediaSearch } from "~/components/admin/media-search";
import { MediaToast } from "~/components/admin/toast";
import { MediaTrashControls } from "~/components/admin/media-trash-controls";
import { MediaUploadActions } from "~/components/admin/media-upload-actions";
import { Panel } from "~/components/admin/panel";
import {
  mediaRecord,
  mediaRefsFor,
  mediaLensCounts,
  mediaTagCounts,
  mediaTrashedCount,
  mediaTwins,
  trashedMediaKeys,
} from "~/db";
import { readPage } from "~/lib/blog-listing.mjs";
import { getEnv } from "~/lib/context";
import { prefersType } from "~/lib/negotiate.mjs";
import templateRefs from "../../content/generated/template-refs.json";
import { digestFromKey } from "~/lib/media/classify.mjs";
import {
  lensNoteFor,
  suggestedAlt,
  suggestedTags,
  usageStateOf,
} from "~/lib/media/usage.mjs";
import { CONFIRM_FIELD, confirmationSatisfied } from "~/lib/destructive.mjs";
import { parseTags } from "~/lib/media/tags.mjs";
import {
  folderPrefix,
  hrefWith,
  isModified,
  onlyDisplayChanged,
  readDisplayAxes,
  readView,
} from "~/lib/media/view.mjs";
import { rovingKey } from "~/lib/media/tile-nav.mjs";
import { MEDIA_PAGE_SIZE, isViewable, listMedia, thumbUrl } from "~/lib/media/core.server";
import {
  bulkTagMedia,
  bulkTrashMedia,
  deleteMedia,
  emptyMediaTrash,
  mediaRowTotal,
  rebuildMedia,
  restoreMedia,
  setMediaAlt,
  setMediaTagsFromForm,
  trashMedia,
} from "~/lib/media/actions.server";
import { resolveCitations } from "~/lib/media/resolvers.server";
import { uploadErrorSentence } from "~/lib/media/upload-contract.mjs";
import type { Route } from "./+types/admin.media._index";

export function meta() {
  return [{ title: "Media · Admin" }, { name: "robots", content: "noindex" }];
}

const ROLE_IDS = new Set(["content", "generated", "brand", "icon"]);

/** About six rows fit under the search bar before the arrow keys scroll the highlight away. */
const PALETTE_RESULTS = 6;

/** A build-time import: the scan needs a filesystem and the Worker has none. */
const TEMPLATE_REFS: Record<string, string[]> = templateRefs.refs;
const TEMPLATE_REF_KEYS = Object.keys(TEMPLATE_REFS);

/** The one listing query: the page, the picker and the palette each ask it with their own options. */
function listingFor(env: Env, url: URL, picker: boolean) {
  const page = readPage(url.searchParams.get("page"));
  const view = readView(url.searchParams);
  const requested = url.searchParams.get("role");
  const filter = requested === "all" || (requested && ROLE_IDS.has(requested))
    ? requested
    : "content";
  const q = view.q;
  /* A thunk, so the caller's timer brackets the query itself. */
  const list = () => listMedia(env, {
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
  });
  return { page, view, filter, q, list };
}

/**
 * The palette asks for JSON, which a document loader cannot return, so it is answered here, after
 * the admin layout's middleware has authenticated the request. No usage, citations or twins: three
 * more queries per keystroke for nothing the palette shows.
 */
export const middleware: Route.MiddlewareFunction[] = [
  async ({ request, context }, next) => {
    const url = new URL(request.url);
    if (url.searchParams.get("palette") !== "1" || !prefersType(request, "application/json")) {
      return next();
    }
    const listed = await listingFor(getEnv(context), url, false).list();
    return Response.json(
      {
        results: listed.objects.slice(0, PALETTE_RESULTS).map((object) => ({
          key: object.key,
          url: object.url,
          name: object.originalName ?? object.key.split("/").pop() ?? object.key,
          dir: folderPrefix(object.key),
          size: object.size,
          viewable: isViewable(object.kind),
        })),
        hasMore: listed.objects.length > PALETTE_RESULTS || listed.hasMore,
      },
      { headers: { "cache-control": "private, no-store" } },
    );
  },
];

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  return timedLoader(context, async (timings) => {
    const url = new URL(request.url);
    const picker = url.searchParams.get("picker") === "1";

    const { page, view, filter, q, list } = listingFor(env, url, picker);
    const listed = await timed(timings, "d1_list_media", list);
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

    const payload = {
      picker: false as const,
      /* The duplicates lens is filtered in SQL before the page is cut, so every row here belongs. */
      objects: listed.objects.map((object) => ({
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
    return data(payload);
  });
}

/*
 * The dispatch stays here and each intent's work is in lib/media/actions.server.ts. The three
 * destructive intents check the typed confirmation in their own branch, where check:destructive
 * reads it, before the handler runs.
 */
export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "bulk-add-tag" || intent === "bulk-remove-tag") {
    return bulkTagMedia(env, form, intent);
  }

  if (intent === "set-tags") return setMediaTagsFromForm(env, form);

  if (intent === "bulk-trash") return bulkTrashMedia(env, form);

  if (intent === "trash") return trashMedia(env, form);

  if (intent === "restore") return restoreMedia(env, form);

  /* Runs the single delete's citation scan, fails closed on it, then claims per key, so a cited asset is kept. */
  if (intent === "empty-trash") {
    const keys = await trashedMediaKeys(env);

    /* Checked here: the confirm button renders enabled without script. */
    const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();
    if (!confirmationSatisfied(typed, keys.length)) {
      return {
        message:
          `Nothing was deleted. The trash holds ${keys.length} file(s) and the ` +
          `confirmation read ${typed || "(blank)"}. Type the count exactly to confirm.`,
        refused: true,
      };
    }
    return emptyMediaTrash(env, keys);
  }

  if (intent === "set-alt") return setMediaAlt(env, form);

  if (intent === "rebuild") {
    /* A rebuild prunes rows whose source is gone. Count 1: the rows at risk are unknowable beforehand. */
    const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();
    if (!confirmationSatisfied(typed, 1)) {
      return { confirmRebuild: await mediaRowTotal(env) };
    }
    return rebuildMedia(env);
  }

  if (intent === "delete") {
    const key = String(form.get("key") ?? "");

    /* Checked here, not in `onSubmit`, so it holds without script; an uncited object passes the rest. */
    const typed = String(form.get(CONFIRM_FIELD) ?? "").trim();
    if (!confirmationSatisfied(typed, 1)) {
      return { confirmDelete: key };
    }
    return deleteMedia(env, key);
  }

  return data(
    {
      message: `Nothing was done: ${String(intent ?? "(none)")} is not an action this page knows.`,
      refused: true,
    },
    { status: 400 },
  );
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
}: Route.ComponentProps) {
  /* Every hook before the early return: the JSON branches below return null. */
  const [displayParams] = useSearchParams();
  const navigation = useNavigation();
  const here = useLocation();
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmingTrash, setConfirmingTrash] = useState(false);
  /* The grid tile focus was last on: the roving tab stop follows it. */
  const [activeTile, setActiveTile] = useState("");
  const anchor = useRef<string | null>(null);

  /* Narrowed by key: the 400 answer carries only `message`, so the union no longer has these on every arm. */
  const confirmRebuild =
    actionData && "confirmRebuild" in actionData ? actionData.confirmRebuild : undefined;
  const confirmDelete =
    actionData && "confirmDelete" in actionData ? actionData.confirmDelete : undefined;
  const message = actionData && "message" in actionData ? actionData.message : undefined;
  const refused = !!actionData && "refused" in actionData && actionData.refused === true;

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

  return (
    <Panel
      title="Media"
      description={`${loaderData.lensCounts.all} file${loaderData.lensCounts.all === 1 ? "" : "s"}, ${loaderData.trashedCount} in trash`}
      actions={<MediaUploadActions />}
    >

      <MediaSearch q={q} total={lensCounts.all} view={view} linkTo={linkTo} />

      <MediaFacets
        view={view}
        lensCounts={lensCounts}
        trashedCount={trashedCount}
        tagCounts={tagCounts}
        linkTo={linkTo}
      />

      <MediaDisplayBar
        visible={visible}
        allShown={allShown}
        setSelected={setSelected}
        q={q}
        filter={filter}
        modified={modified}
        view={view}
        linkTo={linkTo}
      />

      {!view.trash && lensNoteFor(view.lens) ? (
        <div className="media-lens-note">
          <p>{lensNoteFor(view.lens)}</p>
          <Link to={linkTo({ lens: "", page: 1 })} className="media-lens-clear">
            Show everything
          </Link>
        </div>
      ) : null}

      <MediaTrashControls view={view} trashedCount={trashedCount} linkTo={linkTo} />

      {/* Usage is what the renderer emitted, so a route-referenced asset reads as uncited. */}

      {scanComplete ? (
        <p className="media-usage-note">
          {usageNote}{" "}
          <strong>Treat not referenced as unknown, not as safe to delete.</strong>
        </p>
      ) : null}

      {/* With the inspector open the result is announced inside it: the page behind a modal is inert. */}
      <LiveNotice
        status={
          uploaded ? (
            <>
              Uploaded {uploaded}. <Link to={linkTo({ key: uploaded })}>Open it</Link>.
            </>
          ) : message && !refused && !detail ? (
            message
          ) : undefined
        }
        alert={uploadError ? uploadError : message && refused && !detail ? message : undefined}
      />

      {!scanComplete ? (
        <AdminAlert tone="warning" title="Usage could not be determined" headingId="scan-failed">
          <p>
            The reference scan failed ({scanFailed.join(", ")}), so nothing below is
            labeled unused and every delete will be refused until it succeeds.
          </p>
        </AdminAlert>
      ) : null}

      {detail ? (
        <MediaInspector detail={detail} linkTo={linkTo} message={message} refused={refused} />
      ) : null}

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
          tabStop={rovingKey(visible, activeTile, view.key)}
          setActive={setActiveTile}
        />
      )}

      <MediaConfirmDialogs
        chosen={chosen}
        confirmingTrash={confirmingTrash}
        setConfirmingTrash={setConfirmingTrash}
        confirmRebuild={confirmRebuild}
        confirmDelete={confirmDelete}
        linkTo={linkTo}
      />

      <MediaToast />

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
