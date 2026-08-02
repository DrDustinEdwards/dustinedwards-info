import { Form, Link, useSearchParams } from "react-router";

import { AdminAlert } from "~/components/admin/alert";
import { Panel } from "~/components/admin/panel";
import { deleteMediaRecord, mediaCounts, mediaRefsFor, upsertMediaRecord } from "~/db";
import { getEnv } from "~/lib/context";
import { storageOf } from "~/lib/media/classify.mjs";
import {
  MEDIA_PAGE_SIZE,
  deleteMediaObject,
  isManagedKey,
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

export async function loader({ request, context }: Route.LoaderArgs) {
  const env = getEnv(context);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1") || 1;

  // The picker asks for a flatter, bigger payload from this same loader, which
  // is what makes it the same listing rather than a second one.
  const picker = url.searchParams.get("picker") === "1";

  const listed = await listMedia(env, {
    page,
    limit: picker ? 200 : MEDIA_PAGE_SIZE,
    // THE PICKER FILTER, applied in SQL rather than in the map below, so an
    // excluded row never crosses the wire. An OG card is 1200x630 of branded
    // chrome built for a social feed; inserting one into a post body would be
    // nonsense, so `r2-derived` is excluded outright. Documents go too: this
    // picker inserts images.
    insertableOnly: picker,
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
      citations: resolution.citations.get(object.key) ?? [],
      /** Rows the pipeline wrote. The refcount that makes a shared blob safe. */
      refCount: (refs.get(object.key) ?? []).length,
    })),
    page: listed.page,
    hasMore: listed.hasMore,
    /** False when a resolver threw. The page says so and delete refuses. */
    scanComplete: resolution.complete,
    scanFailed: resolution.failed,
    /** What the index holds, so a rebuild's effect is visible on the page. */
    counts: await mediaCounts(env),
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
    const report = await rebuildMediaIndex(env);
    const after = await mediaCounts(env);
    const total = after.reduce((sum, row) => sum + Number(row.n), 0);
    const breakdown = after
      .map((row) => `${row.n} ${row.storage}/${row.kind}`)
      .sort()
      .join(", ");

    const parts = [
      `Rebuilt from ${report.scannedObjects} R2 object(s) and ${report.scannedFiles} static ` +
        `file(s). The index now holds ${total} row(s): ${breakdown}`,
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
  const [params] = useSearchParams();
  if (loaderData.picker) return null;
  const { objects, page, hasMore, scanComplete, scanFailed, counts } = loaderData;
  const total = counts.reduce((sum, row) => sum + Number(row.n), 0);

  return (
    <Panel
      title="Media"
      description="Everything the index knows about: editor uploads in R2, generated cards, and the static assets that ship with the repo. Thumbnails are transforms of the original."
    >
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
        {/* The standing row count. This is what makes a rebuild VISIBLE: the
            action's message reports the new total and this line already
            displayed the old one, so the two can be compared. Pressing the
            button used to change nothing on screen, which read as a no-op. */}
        <p className="muted">
          {total} row(s) indexed:{" "}
          {counts
            .map((row) => `${row.n} ${row.storage}/${row.kind}`)
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
          No objects in the bucket yet. Images arrive here when you drop or paste one
          into a post body, or set a cover image in the editor.
        </p>
      ) : (
        <ul className="media-grid">
          {objects.map((object) => {
            const cited = object.citations.length > 0;
            return (
              <li key={object.key} className="media-card">
                {/* LQIP, as a CSS background BEHIND the real image.

                    An <img> paints nothing until its bytes arrive; the
                    background of that same element paints immediately, and the
                    image covers it when it loads. So the tile is never empty,
                    the swap needs no JavaScript and no onload handler, and there
                    is no layout shift because the element's box is unchanged
                    throughout. That last property is why this is a background
                    rather than a second stacked <img>.

                    A ~300 byte data URI, chosen over ThumbHash and BlurHash for
                    exactly this reason: both of those need client-side script to
                    decode, and the zero-JS rule forbids it. The extra bytes buy
                    the rule. */}
                <img
                  className="media-thumb"
                  src={object.thumb}
                  alt=""
                  loading="lazy"
                  width={320}
                  height={320}
                  style={
                    object.placeholder
                      ? { backgroundImage: `url("${object.placeholder}")` }
                      : undefined
                  }
                />

                <div className="media-card-body">
                  {/* The original filename first when there is one. A
                      content-addressed key is an ADDRESS and reads as noise, so
                      the name the author gave the file is what identifies it to
                      a human; the key stays visible underneath because it is
                      what appears in a post's markdown. */}
                  <p className="media-key">{object.originalName ?? object.key}</p>
                  <p className="media-meta">
                    <span className="chip">{object.storage}</span> {formatBytes(object.size)}
                    {object.width && object.height ? ` · ${object.width}x${object.height}` : ""}
                    {object.uploaded ? ` · ${object.uploaded.slice(0, 10)}` : ""}
                  </p>

                  {/* Alt on the RECORD. Saving it changes what future
                      insertions pre-fill and rewrites no existing post. */}
                  <Form method="post" className="media-alt-form">
                    <input type="hidden" name="key" value={object.key} />
                    <label className="sr-only" htmlFor={`alt-${object.key}`}>
                      Alt text for {object.key}
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
            <Link to={`/admin/media?page=${page - 1}`} className="btn-ghost">
              Previous
            </Link>
          ) : null}
          <span className="muted">Page {page}</span>
          {hasMore ? (
            <Link to={`/admin/media?page=${page + 1}`} className="btn-ghost">
              Next
            </Link>
          ) : null}
        </p>
      ) : null}
    </Panel>
  );
}
