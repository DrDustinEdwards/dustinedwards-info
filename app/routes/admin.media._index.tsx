import { Form, Link, useSearchParams } from "react-router";

import { AdminAlert } from "~/components/admin/alert";
import { Panel } from "~/components/admin/panel";
import {
  deleteMediaRecord,
  existingMediaKeys,
  mediaRecordsFor,
  upsertMediaRecord,
} from "~/db";
import { getEnv } from "~/lib/context";
import {
  MEDIA_PAGE_SIZE,
  deleteMediaObject,
  isManagedKey,
  listMedia,
  readDimensions,
  thumbUrl,
} from "~/lib/media/core.server";
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
  const cursor = url.searchParams.get("cursor");

  // The picker asks for a flatter, bigger payload from this same loader, which
  // is what makes it the same listing rather than a second one.
  const picker = url.searchParams.get("picker") === "1";

  const page = await listMedia(env, {
    cursor,
    limit: picker ? 200 : MEDIA_PAGE_SIZE,
  });
  const keys = page.objects.map((object) => object.key);
  const records = await mediaRecordsFor(env, keys);

  if (picker) {
    return {
      picker: true as const,
      objects: page.objects.map((object) => ({
        key: object.key,
        url: object.url,
        thumb: thumbUrl(object.key, 320),
        alt: records.get(object.key)?.alt ?? "",
      })),
      truncated: page.truncated,
    };
  }

  // Usage is DERIVED, every time. No row is consulted for it, so a stale
  // annotation can never authorise a delete a fresh scan would refuse.
  const resolution = await resolveCitations(env, keys);

  return {
    picker: false as const,
    objects: page.objects.map((object) => {
      const record = records.get(object.key);
      return {
        ...object,
        thumb: thumbUrl(object.key, 320),
        alt: record?.alt ?? "",
        caption: record?.caption ?? "",
        width: record?.width ?? null,
        height: record?.height ?? null,
        hasRecord: Boolean(record),
        citations: resolution.citations.get(object.key) ?? [],
      };
    }),
    cursor: page.cursor,
    truncated: page.truncated,
    /** False when a resolver threw. The page says so and delete refuses. */
    scanComplete: resolution.complete,
    scanFailed: resolution.failed,
    /** Objects on this page with no annotation row yet, for the backfill. */
    unannotated: keys.filter((key) => !records.has(key)).length,
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
    await upsertMediaRecord(env, { r2Key: key, alt: String(form.get("alt") ?? "") });
    return { message: `Alt text saved for ${key}. Existing posts are unchanged.` };
  }

  if (intent === "backfill") {
    // Idempotent: rows that exist are skipped, so this can be re-run safely
    // after any upload that predates the table.
    const existing = await existingMediaKeys(env);
    let created = 0;
    let cursor: string | null = null;
    do {
      const page = await listMedia(env, { cursor, limit: 100 });
      for (const object of page.objects) {
        if (existing.has(object.key)) continue;
        const dimensions = await readDimensions(env, object.key);
        await upsertMediaRecord(env, {
          r2Key: object.key,
          alt: "",
          uploaded: object.uploaded,
          width: dimensions?.width ?? null,
          height: dimensions?.height ?? null,
        });
        created += 1;
      }
      cursor = page.cursor;
    } while (cursor);
    return {
      message: `Backfilled ${created} media record(s) with empty alt. Rows that already existed were left alone.`,
    };
  }

  if (intent === "delete") {
    const key = String(form.get("key") ?? "");
    if (!isManagedKey(key)) return { message: "Not a managed media key." };

    // THE CHECK RUNS HERE, SERVER SIDE, ON A FRESH SCAN. The page the operator
    // is looking at may be minutes old and a post may have started citing this
    // object since it rendered, so the UI's opinion is never the authority.
    const resolution = await resolveCitations(env, [key]);

    // Ruling 4: FAIL CLOSED. "We could not check" is not "nothing cites it".
    if (!resolution.complete) {
      return {
        message: `Delete refused: the reference scan failed (${resolution.failed.join(", ")}), so it cannot be confirmed that nothing cites this object.`,
      };
    }

    const citations = resolution.citations.get(key) ?? [];
    if (citations.length > 0) {
      return {
        message: `Delete refused. ${describeCitations(citations)}`,
      };
    }

    await deleteMediaObject(env, key);
    // The row goes with the object, or the table would accumulate annotations
    // for things that no longer exist.
    await deleteMediaRecord(env, key);
    return { message: `Deleted ${key} and its record.` };
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
  const { objects, cursor, scanComplete, scanFailed, unannotated } = loaderData;

  return (
    <Panel
      title="Media"
      description="Everything the editor has uploaded. Thumbnails are transforms of the original; the bucket stores one copy of each image."
    >
      <div className="posts-toolbar">
        {unannotated > 0 ? (
          <Form method="post">
            <button type="submit" name="intent" value="backfill" className="btn-ghost">
              Backfill {unannotated} missing record{unannotated === 1 ? "" : "s"}
            </button>
          </Form>
        ) : null}
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
                <img
                  className="media-thumb"
                  src={object.thumb}
                  alt=""
                  loading="lazy"
                  width={320}
                  height={320}
                />

                <div className="media-card-body">
                  <p className="media-key">{object.key.replace(/^posts\//, "")}</p>
                  <p className="media-meta">
                    {formatBytes(object.size)}
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
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Cursor pagination, in the URL, so a page of the library is linkable
          and works with scripting off. */}
      {cursor ? (
        <p className="posts-toolbar">
          <Link
            to={`/admin/media?cursor=${encodeURIComponent(cursor)}`}
            className="btn-ghost"
          >
            Next page
          </Link>
        </p>
      ) : params.get("cursor") ? (
        <p className="posts-toolbar">
          <Link to="/admin/media" className="btn-ghost">
            Back to the first page
          </Link>
        </p>
      ) : null}
    </Panel>
  );
}
