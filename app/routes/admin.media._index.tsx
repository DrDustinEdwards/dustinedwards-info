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
  mediaUnusedCount,
  upsertMediaRecord,
} from "~/db";
import { getEnv } from "~/lib/context";
import { storageOf } from "~/lib/media/classify.mjs";
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
  { id: "unused", label: "Unused", hint: "Nothing the renderer emitted cites these" },
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
  const requested = url.searchParams.get("role");
  const filter = requested === "all" || (requested && (ROLE_IDS.has(requested) || requested === "unused"))
    ? requested
    : "content";

  /** Free text. Trimmed once here so every reader downstream sees the same q. */
  const q = (url.searchParams.get("q") ?? "").trim();

  const listed = await listMedia(env, {
    page,
    limit: picker ? 200 : MEDIA_PAGE_SIZE,
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
          ...(ROLE_IDS.has(filter) ? { role: filter } : {}),
          ...(filter === "unused" ? { unusedOnly: true } : {}),
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
  const [resolution, refs] = await Promise.all([
    resolveCitations(env, keys),
    mediaRefsFor(env, keys),
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
     * The Unused chip's number, from the SAME predicate the filter uses, so the
     * chip and the page it leads to cannot disagree. It was the one chip with no
     * count, because the counts came from the role histogram and `unused` is not
     * a role.
     */
    unusedCount: await mediaUnusedCount(env),
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const env = getEnv(context);
  const form = await request.formData();
  const intent = form.get("intent");

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
 * THE PAGE'S ONE JOB, as one button.
 *
 * The clipboard needs script, which is why the filename beside it links to the
 * detail view where the same string sits in a readonly input. Feedback is a data
 * attribute rather than component state: the page holds no client state by
 * ruling, and a copy button with no acknowledgement reads as broken.
 */
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
      Copy<span className="sr-only"> the address for {label}</span>
    </button>
  );
}

export default function AdminMedia({ loaderData, actionData }: Route.ComponentProps) {
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
    unusedCount,
  } = loaderData;
  const total = counts.reduce((sum, row) => sum + Number(row.n), 0);
  const byRole = new Map(roleCounts.map((row) => [row.role, Number(row.n)]));
  const active = FILTERS.find((f) => f.id === filter);

  /**
   * Every link on this page is THIS view with one thing changed.
   *
   * Written once because the alternative is what the old pager did: it carried
   * `role` and would have dropped `q`, so paging out of a search silently
   * widened it back to the whole group. A chip drops the page number, because
   * page 3 of one filter is not page 3 of another.
   */
  const viewParams = (over: Record<string, string | number | null> = {}) => {
    const merged: Record<string, string | number | null> = {
      role: filter,
      q,
      page: page > 1 ? page : null,
      ...over,
    };
    const params = new URLSearchParams();
    for (const [name, value] of Object.entries(merged)) {
      if (value === null || value === undefined || value === "") continue;
      params.set(name, String(value));
    }
    const search = params.toString();
    return search ? `/admin/media?${search}` : "/admin/media";
  };

  /** A chip is its own filter, unfiltered by page, carrying any search. */
  const chipHref = (role: string) => viewParams({ role, page: null, key: null });
  const count = (id: string) => (id === "unused" ? unusedCount : byRole.get(id));

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
          <input id="media-file" type="file" name="file" accept="image/*" />
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

      <nav aria-label="Filter media by group" className="media-filters">
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
              `${byRole.get("icon") ?? 0} icons.`}{" "}
        {unusedCount} of {total} are cited by nothing the renderer emitted.
      </p>

      {actionData?.message ? (
        <p className="editor-notice" role="status">
          {actionData.message}
        </p>
      ) : null}

      {uploaded ? (
        <p className="editor-notice" role="status">
          Uploaded {uploaded}. <Link to={viewParams({ key: uploaded })}>Open it</Link>.
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
                <Link to={viewParams({ key: null })} className="btn-ghost">
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
              <Link to={viewParams({ key: null })}>Back to the library</Link>.
            </p>
          )}
        </section>
      ) : null}

      {objects.length === 0 ? (
        <p className="muted">
          {q ? (
            <>
              Nothing matches &ldquo;{q}&rdquo; here. Try{" "}
              <Link to={viewParams({ role: "all", page: null })}>every group</Link>, or{" "}
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
        <ul className="media-grid">
          {objects.map((object) => {
            const name = object.originalName ?? object.key;
            const cited = object.citations.length > 0 || object.refCount > 0;
            return (
              <li key={object.key} className="media-card">
                {/* A FIXED BOX, declared as aspect-ratio on the wrapper rather
                    than left to the image.

                    The grid was ragged because it mixes 1200x630 cards, 3:2
                    photos and 1:1 icons and nothing constrained them, which also
                    made the cards tall enough to clip the Save button. An
                    explicit ratio on the wrapper reserves the space before the
                    image arrives, so a lazily-loaded tile cannot reflow the rows
                    below it as it lands. */}
                <Link to={viewParams({ key: object.key })} className="media-thumb-link">
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
                  {/* The original filename first when there is one, and it is
                      the LINK to the detail view, which is also the no-script
                      route to the address. A content-addressed key is an
                      ADDRESS and reads as noise, so the name the author gave
                      the file is what identifies it to a human; the key is one
                      click away rather than in a tooltip only. */}
                  <Link
                    to={viewParams({ key: object.key })}
                    className="media-name"
                    title={object.key}
                  >
                    {name}
                  </Link>
                  <p className="media-meta">
                    <span className="chip">{object.role}</span> {formatBytes(object.size)}
                    {scanComplete ? (cited ? " · used" : " · unused") : ""}
                  </p>
                  <CopyButton value={object.url} label={name} />
                </div>
              </li>
            );
          })}
        </ul>
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
            <Link to={viewParams({ page: page - 1 })} className="btn-ghost">
              Previous
            </Link>
          ) : null}
          <span className="muted">Page {page}</span>
          {hasMore ? (
            <Link to={viewParams({ page: page + 1 })} className="btn-ghost">
              Next
            </Link>
          ) : null}
        </p>
      ) : null}
    </Panel>
  );
}
