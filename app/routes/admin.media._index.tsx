import { Form, Link, useSearchParams } from "react-router";

import { AdminAlert } from "~/components/admin/alert";
import { Panel } from "~/components/admin/panel";
import {
  deleteMediaRecord,
  mediaCounts,
  mediaRefsFor,
  mediaRoleCounts,
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
import type { Route } from "./+types/admin.media._index";

/**
 * The media library. Browses R2, annotates, and deletes with a reference check.
 *
 * The page composes three things that stay separate underneath: the media core
 * (what is in the bucket), the media table (what we know about the image), and
 * the resolver seam (who cites it). Nothing here scans content itself.
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
    page: listed.page,
    hasMore: listed.hasMore,
    /** Which chip is active. Echoed back so the chips render without re-parsing. */
    filter,
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

    await deleteMediaObject(env, key);
    // The row goes with the object, or the table would accumulate annotations
    // for things that no longer exist. The queue consumer would also do this
    // from the delete event; doing it here too is idempotent and means the page
    // the operator lands on is already correct rather than eventually correct.
    await deleteMediaRecord(env, key);
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

export default function AdminMedia({ loaderData, actionData }: Route.ComponentProps) {
  if (loaderData.picker) return null;
  const { objects, page, hasMore, filter, scanComplete, scanFailed, counts, roleCounts } =
    loaderData;
  const total = counts.reduce((sum, row) => sum + Number(row.n), 0);
  const byRole = new Map(roleCounts.map((row) => [row.role, Number(row.n)]));
  const active = FILTERS.find((f) => f.id === filter);

  return (
    <Panel
      title="Media"
      // Written for someone looking for a picture. The old copy described the
      // storage tiers, which is the schema talking: a reader arriving here wants
      // to find an image, and the tiers only matter once they have.
      description="Every picture, card and file the site knows about. Pick a group to narrow it down, then copy the filename into a post."
    >
      {/* FILTER CHIPS AS LINKS, carrying ?role=, exactly as /search does. Links
          and not a dropdown, because a link is navigable, bookmarkable, opens in
          a new tab, and needs no script; a select would need an onchange to do
          anything at all. The whole filter surface is the URL. */}
      {/* `is-active` is the class /search already uses for a selected chip, and
          it is the one the prefers-contrast and forced-colors blocks already
          name. A parallel `aria-current` styling hook would have been a second
          convention that neither accessibility tier covers. `aria-current="page"`
          rides alongside it for the semantics the class cannot carry. */}
      <nav aria-label="Filter media by group" className="media-filters">
        <Link
          to="/admin/media?role=all"
          className={`search-chip${filter === "all" ? " is-active" : ""}`}
          aria-current={filter === "all" ? "page" : undefined}
        >
          All <span className="search-chip-count">{total}</span>
        </Link>
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            to={`/admin/media?role=${f.id}`}
            className={`search-chip${filter === f.id ? " is-active" : ""}`}
            aria-current={filter === f.id ? "page" : undefined}
            title={f.hint}
          >
            {f.label}
            {byRole.has(f.id) ? (
              <span className="search-chip-count">{byRole.get(f.id)}</span>
            ) : null}
          </Link>
        ))}
      </nav>

      {/* ONE LINE, in words. The old line printed a GROUP BY to the screen
          ("1 static/other, 12 r2-derived/image, ..."), which is the shape of the
          query rather than an answer to anything a reader asked. */}
      <p className="muted media-summary">
        {active ? (
          <>
            Showing {objects.length} {active.label.toLowerCase()} item
            {objects.length === 1 ? "" : "s"}
            {byRole.has(filter) && byRole.get(filter) !== objects.length
              ? ` of ${byRole.get(filter)}`
              : ""}
            . {active.hint}.
          </>
        ) : (
          <>
            Showing all {total} items: {byRole.get("content") ?? 0} content,{" "}
            {byRole.get("generated") ?? 0} generated, {byRole.get("brand") ?? 0} brand,{" "}
            {byRole.get("icon") ?? 0} icons.
          </>
        )}
      </p>

      <div className="posts-toolbar">
        {/* Always offered, not conditional on a count. The old backfill button
            appeared only when THIS PAGE held an unannotated object, which meant
            the repair for a drifted index was invisible exactly when the drift
            was somewhere else. A rebuild is idempotent, so there is no state in
            which offering it is wrong. */}
        <Form method="post">
          <button type="submit" name="intent" value="rebuild" className="btn-ghost">
            Rebuild media index
          </button>
        </Form>
        {/* The standing counts, kept because they are what makes a rebuild
            VISIBLE: the action reports the new totals and this already showed
            the old ones. Row count and role split are BOTH here on purpose and
            neither substitutes for the other; the rebuild action says why. */}
        <p className="muted">
          {total} rows indexed · by role:{" "}
          {roleCounts
            .map((row) => `${row.n} ${row.role}`)
            .sort()
            .join(", ")}
        </p>
      </div>

      {actionData?.message ? (
        <p className="editor-notice" role="status">
          {actionData.message}
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

      {objects.length === 0 ? (
        <p className="muted">
          Nothing in this group. Try{" "}
          <Link to="/admin/media?role=all">all media</Link>, or drop an image into a post
          body to upload one.
        </p>
      ) : (
        // A plain list. NOT role="grid": positional information is meaningless
        // to a screen reader here, because the number of columns depends on the
        // container width, and directional navigation does not help anyone find
        // a specific picture. Semantic elements first; the only ARIA on this
        // page is the nav label above and aria-current on the active chip.
        <ul className="media-grid">
          {objects.map((object) => {
            const cited = object.citations.length > 0;
            const name = object.originalName ?? object.key;
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
                <div
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
                </div>

                <div className="media-card-body">
                  {/* The original filename first when there is one. A
                      content-addressed key is an ADDRESS and reads as noise, so
                      the name the author gave the file is what identifies it to
                      a human; the key stays visible underneath because it is
                      what appears in a post's markdown. */}
                  <p className="media-name" title={object.key}>
                    {name}
                  </p>
                  {/* Say what it is before someone commits to it. ONE quiet
                      badge carrying role, not two carrying role and storage:
                      storage is an implementation detail of where the bytes
                      sit, and the reader is choosing a picture. */}
                  <p className="media-meta">
                    <span className="chip">{object.role}</span> {formatBytes(object.size)}
                    {object.width && object.height ? ` · ${object.width}×${object.height}` : ""}
                    {object.uploaded ? ` · ${object.uploaded.slice(0, 10)}` : ""}
                  </p>

                  {/* NATIVE DISCLOSURE, closed by default.

                      Seventy always-open forms was the failure mode that in-page
                      editing patterns exist to avoid, and it is what made the
                      cards tall enough to clip their own buttons. <details> is
                      keyboard accessible, screen-reader announced and needs no
                      script, so this collapses seventy open forms into seventy
                      closed ones without adding a line of JavaScript.

                      The FORM INSIDE IS UNCHANGED: same fields, same intent,
                      same submission. check:admin-ui compares exactly that, so
                      the disclosure is provably presentation only. */}
                  <details className="media-alt">
                    <summary>
                      {object.alt ? "Alt text" : "Add alt text"}
                      {object.alt ? <span className="media-alt-preview">{object.alt}</span> : null}
                    </summary>
                    <Form method="post" className="media-alt-form">
                      <input type="hidden" name="key" value={object.key} />
                      <label className="sr-only" htmlFor={`alt-${object.key}`}>
                        Alt text for {name}
                      </label>
                      <input
                        id={`alt-${object.key}`}
                        name="alt"
                        defaultValue={object.alt}
                        placeholder="Describe this image"
                        className="media-alt-input"
                      />
                      <button type="submit" name="intent" value="set-alt" className="btn-ghost">
                        Save alt
                      </button>
                    </Form>
                  </details>

                  {/* USAGE. Never optimistic: "unused" is only shown when the
                      scan actually completed. */}
                  {!scanComplete ? (
                    <p className="media-usage">Usage unknown</p>
                  ) : cited ? (
                    <p className="media-usage" data-usage="cited">
                      Cited by{" "}
                      {object.citations
                        .map((citation) => citation.id)
                        .filter((id, i, all) => all.indexOf(id) === i)
                        .map((id) => (
                          <Link key={id} to={`/admin/posts/${id}/edit`}>
                            {id}
                          </Link>
                        ))
                        .reduce<React.ReactNode[]>(
                          (acc, node, i) => (i === 0 ? [node] : [...acc, ", ", node]),
                          [],
                        )}
                    </p>
                  ) : (
                    <p className="media-usage" data-usage="unused">
                      Unused
                    </p>
                  )}

                  {/* A static asset shows WHY it cannot be deleted rather than
                      simply lacking a button. The action refuses it regardless;
                      this is so the page explains the refusal instead of
                      leaving a gap the operator has to interpret. */}
                  {object.deletable ? (
                    <Form
                      method="post"
                      onSubmit={(event) => {
                        // The same confirmation discipline the post delete uses.
                        if (!confirm(`Delete ${object.key}? This removes the object from R2.`)) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="key" value={object.key} />
                      <button type="submit" name="intent" value="delete" className="btn-danger">
                        Delete
                      </button>
                    </Form>
                  ) : (
                    <p className="muted media-usage">
                      Ships with the repo. Remove it with a commit.
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* PAGE NUMBERS, in the URL, so a page of the library is linkable and
          works with scripting off. The opaque R2 cursor went with the R2
          listing: it could only ever move forward one page at a time, because
          a cursor is a position in a key-ordered iterator and not an index. */}
      {hasMore || page > 1 ? (
        <p className="posts-toolbar">
          {page > 1 ? (
            <Link to={`/admin/media?role=${filter}&page=${page - 1}`} className="btn-ghost">
              Previous
            </Link>
          ) : null}
          <span className="muted">Page {page}</span>
          {hasMore ? (
            // The filter travels with the page number. Dropping it was how
            // paging out of a filtered view silently reverted to the default.
            <Link to={`/admin/media?role=${filter}&page=${page + 1}`} className="btn-ghost">
              Next
            </Link>
          ) : null}
        </p>
      ) : null}
    </Panel>
  );
}
