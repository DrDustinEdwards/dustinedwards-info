// The dustinedwards.info side of Carrel's site API (the site-api package): the package owns the
// route, the key, the rate limit and every body's shape; this adapter maps its content and preview
// calls onto the site's own save, render and history code. Nothing here writes around savePost.
// Media (v0.2.0) is its own module, over the site's media code.
//
// v0.17.0 on posts: trash and restore (a trashed post is a draft listed only in the trash, content_trash), rename (the
// file and its history move, and the old address of a post ever public answers a 301, post_redirects), a publish under
// a date Carrel names (the post's `date` and `publish_at`), the list's kind, tag and published filters
// (content-kinds.server.ts) and the render version. State the file does not hold is post-state.server.ts.

import { RENDER_VERSION } from "@drdustinedwards/site-helpers/render/nomath";
import { NotFoundError, RefusedError, VersionConflictError, type SiteAdapter } from "@dustinedwards/site-api";
import type { ContentStatus, ContentSummary, WriteResult } from "@dustinedwards/site-api";
import { setTags as setFrontTags } from "@dustinedwards/site-api/frontmatter";
import { d1ScheduledUpdates } from "@dustinedwards/site-api/schedules";
import { getTableColumns } from "drizzle-orm";
import { RouterContextProvider } from "react-router";

import { listAllPostsForAdmin, postSlugsMatching, previewBlogPost, type PostRow } from "~/db";
import { postAuthors } from "~/lib/blog-view";
import { carrelMentionsAdapter } from "~/lib/carrel/mentions-adapter.server";
import { posts } from "~/db/schema";
import { carrelMediaAdapter } from "~/lib/carrel/media-adapter.server";
import { postSchedules } from "~/lib/carrel/schedules-adapter.server";
import { postPath, SLUG_MAX_LENGTH, SLUG_PATTERN } from "~/lib/content/slug.mjs";
import { cloudflareContext, nonceContext, postPreviewContext } from "~/lib/context";
import { contentRegistry, type ContentKindHandler } from "~/lib/carrel/content-kinds.server";
import { publicationHandler } from "~/lib/carrel/publication-handler.server";
import { asSiteApiError } from "~/lib/carrel/errors.server";
import {
  editFront,
  effectivePublishAt,
  forPreview,
  frontKey,
  statusOf,
  withPostFieldKeys,
  withPublication,
  withPublishedAt,
  withSlug,
} from "~/lib/carrel/front-matter-lines";
import {
  dropRedirectsTo,
  dropScheduledPublish,
  dropTrash,
  movePost,
  putScheduledPublish,
  putTrash,
  trashedAt,
  trashedAtOf,
} from "~/lib/carrel/post-state.server";
import { documentHandler } from "~/lib/carrel/document-handler.server";
import { dictionaryHandler } from "~/lib/carrel/dictionary-handler.server";
import { pageHandler } from "~/lib/carrel/page-handler.server";
import { cvHandler } from "~/lib/carrel/cv-handler.server";
import { phageHandler } from "~/lib/carrel/phage-handler.server";
import { rosterHandler } from "~/lib/carrel/roster-handler.server";
import { fileRevisions, fileRevisionSource, readFile } from "~/lib/source/store.server";
import {
  deletePost,
  forgetPostRows,
  renderRecord,
  savePost,
  validateAndRender,
} from "~/lib/editor/publish.server";
import { postColumnValues, type PostRecord } from "~/lib/editor/post-rows.server";
import { readState } from "~/lib/editor/publish-policy.mjs";
import { SITE, SITE_ORIGIN } from "~/lib/seo";

export { withPublication };

type CarrelEnv = Env;

type RenderDocument = (request: Request, context: RouterContextProvider) => Promise<Response>;

/**
 * A revision's version is a commit sha. A post's own version is different: the git blob sha of its file at
 * head, so only a change to that post moves it, and saving another post no longer makes this one look changed.
 */

/** A preview of a post not yet in D1 needs an id no stored row has, for its neighbors' tie-break. */
const PREVIEW_ROW_ID = Number.MAX_SAFE_INTEGER;

/** The slug a preview renders at when Carrel sends no id: a new post that has none yet. */
const UNSAVED_PREVIEW_SLUG = "carrel-preview";

/**
 * The drizzle row getBlogPost would read once this record were synced: the synced columns decoded
 * through the schema's own column mappers, and the columns the sync does not write kept from the
 * stored row. A column neither supplies is an error, so a new column cannot quietly go missing here.
 */
async function previewRow(env: CarrelEnv, record: PostRecord): Promise<PostRow> {
  const stored = await env.DB.prepare(
    `SELECT id, excerpt, og_image, created_at, updated_at FROM posts WHERE slug = ?1`,
  )
    .bind(record.slug)
    .first<{
      id: number;
      excerpt: string | null;
      og_image: string | null;
      created_at: number;
      updated_at: number;
    }>();
  const now = Math.floor(Date.now() / 1000);

  const raw: Record<string, unknown> = {
    id: stored?.id ?? PREVIEW_ROW_ID,
    kind: "post",
    excerpt: stored?.excerpt ?? null,
    og_image: stored?.og_image ?? null,
    created_at: stored?.created_at ?? now,
    ...postColumnValues(record),
  };
  // postColumnValues' `updated_at` is NULL when the post has no frontmatter `updated`: the stored one stands.
  raw.updated_at ??= stored?.updated_at ?? now;

  const row: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(getTableColumns(posts))) {
    if (!(column.name in raw)) {
      throw new Error(`the Carrel preview has no value for posts.${column.name}; add it to postColumnValues`);
    }
    const value = raw[column.name];
    row[key] = value === null || value === undefined ? null : column.mapFromDriverValue(value as never);
  }
  return row as PostRow;
}

/** What the blog loader reads for a preview: getBlogPost's shape, for a record not yet in D1. */
export async function previewPost(env: CarrelEnv, record: PostRecord) {
  return previewBlogPost(env, await previewRow(env, record), record.tags);
}

export function carrelSiteAdapter(options: {
  env: CarrelEnv;
  ctx: ExecutionContext;
  /** The origin the preview's page request is made against: the request's own. */
  origin: string;
  renderDocument: RenderDocument | null;
}): SiteAdapter {
  const { env, ctx, origin, renderDocument } = options;

  /** One write through savePost as the Carrel actor, answered in the package's terms. */
  async function write(
    id: string,
    changeId: string,
    raw: string,
    expectedVersion: string | null,
  ): Promise<WriteResult> {
    try {
      const saved = await savePost(env, {
        slug: id,
        // Carrel's post fields under their own keys (front-matter-lines.ts withPostFieldKeys).
        raw: withPostFieldKeys(raw),
        // A create (null) is guarded by isNew; every other write by the post's own blob sha.
        expectedBlobSha: expectedVersion ?? undefined,
        isNew: expectedVersion === null,
        actor: { kind: "carrel", changeId },
      });
      // The record was rendered from the stamped file that was committed, so this is that file's blob sha.
      return { id, version: saved.record.sourceBlobSha, status: statusOf(raw), changeId };
    } catch (error) {
      return asSiteApiError(env, error, postPath(id));
    }
  }

  /**
   * A publish, an unpublish, a trash or a delete of a post drops the update waiting on it (site-api v0.10.0), and the
   * first publish the cron would otherwise announce (post-state.server.ts).
   */
  const waiting = d1ScheduledUpdates(env.DB);
  /** The package's statements are D1's own, typed by the part it uses. */
  const batch = (...statements: unknown[]) => env.DB.batch(statements as D1PreparedStatement[]);
  async function dropWaiting<T>(id: string, result: T): Promise<T> {
    await batch(waiting.remove(id), dropScheduledPublish(env, id));
    return result;
  }

  /** The stored file at the version the caller loaded: 404 when there is none, 409 when it moved on. */
  async function current(id: string, expectedVersion: string) {
    const file = await readFile(env, postPath(id));
    if (!file) throw new NotFoundError(`No post "${id}" exists.`);
    if (file.sha !== expectedVersion) throw new VersionConflictError(file.sha);
    return file;
  }

  /** A trashed post is restored before anything puts it on the site. */
  async function refuseTrashed(id: string) {
    if (await trashedAtOf(env, id)) throw new RefusedError("This post is in the trash; restore it first.");
  }

  /** The stored file for a write that names a version; a version for a missing id is a conflict. */
  async function existing(id: string): Promise<string> {
    const file = await readFile(env, postPath(id));
    if (!file) throw new VersionConflictError(null);
    return file.content;
  }

  const postHandler: ContentKindHandler = {
    kind: "post",

    async list(query) {
      const now = Date.now();
      // The title, the slug and the body (site-api's q), matched in D1.
      const matched = query.q ? await postSlugsMatching(env, query.q) : null;
      const trash = await trashedAt(env);
      const rows = (await listAllPostsForAdmin(env))
        .filter((row) => trash.has(row.slug) === (query.trashed === true))
        .filter((row) => !matched || matched.has(row.slug));
      const summaries: ContentSummary[] = rows.map((row) => {
        const at = row.publishAt ? row.publishAt.getTime() : null;
        const status: ContentStatus =
          row.status === "draft" ? "draft" : at !== null && at > now ? "scheduled" : "published";
        return {
          id: row.slug,
          kind: "post",
          title: row.title,
          status,
          // D1 cannot tell a withdrawn post from one never published, so a draft has no public path.
          path: status === "draft" ? null : `/writing/${row.slug}`,
          publishAt: status === "scheduled" && at !== null ? new Date(at).toISOString() : null,
          publishedAt: status === "published" && at !== null ? new Date(at).toISOString() : null,
          updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
          tags: row.tags,
          authors: postAuthors(row.slug, row.authors),
          ...(row.description ? { excerpt: row.description } : {}),
          trashedAt: trash.get(row.slug) ?? null,
        };
      });
      // The trash names each post's version, which site-api's cron deletes it at once it has been there 30 days.
      if (query.trashed) {
        for (const summary of summaries) summary.version = (await readFile(env, postPath(summary.id)))?.sha;
      }
      return summaries.filter((s) => !query.status || s.status === query.status);
    },

    async get(id) {
      const file = await readFile(env, postPath(id));
      if (!file) return null;
      const row = await env.DB.prepare(`SELECT updated_at, description, authors FROM posts WHERE slug = ?1`)
        .bind(id)
        .first<{ updated_at: number; description: string | null; authors: string | null }>();
      const { firstPublished } = readState(file.content);
      const status = statusOf(file.content);
      const at = new Date(effectivePublishAt(file.content)).toISOString();
      return {
        id,
        kind: "post",
        title: frontKey(file.content, "title") || id,
        status,
        path: firstPublished ? `/writing/${id}` : null,
        publishAt: status === "scheduled" ? at : null,
        // The date the post is published under, as the list and the page read it (a backdated first publish keeps its
        // date, where first_published is the day it first went out), and kept on a withdrawn post, which was public.
        // A post scheduled again ahead has only its first day to name.
        publishedAt: firstPublished ? (status === "scheduled" ? `${firstPublished}T00:00:00.000Z` : at) : null,
        updatedAt: row ? new Date(row.updated_at * 1000).toISOString() : null,
        authors: postAuthors(id, row?.authors ?? null),
        ...(row?.description ? { excerpt: row.description } : {}),
        trashedAt: await trashedAtOf(env, id),
        format: "markdown",
        // Under site-api's post field keys, so Carrel's boxes read this site's older `description` and `part`.
        source: withPostFieldKeys(file.content),
        version: file.sha,
      };
    },

    // Keeps the stored status, as the contract's reference adapter does: a save to a live post
    // edits it live, and a new post starts as a draft.
    async saveDraft(id, input) {
      const file = await readFile(env, postPath(id));
      if (input.expectedVersion === null && file) throw new VersionConflictError(file.sha);
      if (input.expectedVersion !== null && !file) throw new VersionConflictError(null);
      const raw = file
        ? withPublication(input.source, {
            draft: readState(file.content).draft,
            publishAt: frontKey(file.content, "publish_at").trim() || null,
          })
        : withPublication(input.source, { draft: true });
      return write(id, input.changeId, raw, input.expectedVersion);
    },

    publishedAtSettable: true,

    async publish(id, input) {
      // Read even when source is sent: a version for an id that does not exist is a conflict.
      const stored = await existing(id);
      await refuseTrashed(id);
      let source = input.source ?? stored;
      // Under the date Carrel names (never later than now: the package allows a minute's grace for a clock).
      if (input.publishedAt) {
        source = withPublishedAt(source, new Date(Math.min(Date.parse(input.publishedAt), Date.now())).toISOString());
      }
      // A post whose time is still ahead would publish invisible, so publishing now means now.
      const due = effectivePublishAt(source) > Date.now() ? new Date().toISOString() : undefined;
      return dropWaiting(
        id,
        await write(id, input.changeId, withPublication(source, { draft: false, publishAt: due }), input.expectedVersion),
      );
    },

    async schedule(id, input) {
      const at = Date.parse(input.publishAt);
      if (!(at > Date.now())) {
        throw new RefusedError("publishAt is not in the future; publish it now instead.");
      }
      const stored = await existing(id);
      await refuseTrashed(id);
      const source = input.source ?? stored;
      const publishAt = new Date(at).toISOString();
      const result = await write(id, input.changeId, withPublication(source, { draft: false, publishAt }), input.expectedVersion);
      // It goes live by its publish_at with no write; this is how the cron hears it, once, to run the publish hooks.
      await putScheduledPublish(env, id, publishAt, input.changeId).run();
      return result;
    },

    async unpublish(id, input) {
      const source = await existing(id);
      return dropWaiting(id, await write(id, input.changeId, withPublication(source, { draft: true }), input.expectedVersion));
    },

    // The whole tag set, written into the front matter and saved like any edit: a live post stays live.
    async setTags(id, input) {
      const file = await readFile(env, postPath(id));
      if (!file) throw new NotFoundError(`No post "${id}" exists.`);
      if (file.sha !== input.expectedVersion) throw new VersionConflictError(file.sha);
      return write(id, input.changeId, editFront(file.content, (front) => setFrontTags(front, input.tags)), file.sha);
    },

    revisions(id) {
      return fileRevisions(env, postPath(id));
    },

    revisionSource(id, version) {
      return fileRevisionSource(env, postPath(id), version);
    },

    // The post's own delete, the one the admin uses: the source, the D1 rows, the cache purge and the Ask index
    // as one unit. The version is checked here for a clean answer and again inside the write, so a check that
    // cannot run throws and nothing is deleted.
    async delete(id, input) {
      const file = await readFile(env, postPath(id));
      if (!file) throw new NotFoundError(`No post "${id}" exists.`);
      if (file.sha !== input.expectedVersion) throw new VersionConflictError(file.sha);
      try {
        await deletePost(env, {
          slug: id,
          expectedBlobSha: input.expectedVersion,
          actor: { kind: "carrel", changeId: input.changeId },
        });
      } catch (error) {
        return asSiteApiError(env, error, postPath(id));
      }
      // A redirect to a post that is gone would answer a 301 to a 404.
      await batch(waiting.remove(id), dropScheduledPublish(env, id), dropTrash(env, id), dropRedirectsTo(env, id));
    },

    // A live or scheduled post is written as a draft first, so it leaves the site before it enters the trash.
    async trash(id, input) {
      const file = await current(id, input.expectedVersion);
      const result =
        statusOf(file.content) === "draft"
          ? { id, version: file.sha, status: "draft" as const, changeId: input.changeId }
          : await write(id, input.changeId, withPublication(file.content, { draft: true }), file.sha);
      await batch(putTrash(env, id, input.changeId), waiting.remove(id), dropScheduledPublish(env, id));
      return result;
    },

    async restore(id, input) {
      const file = await current(id, input.expectedVersion);
      if (!(await trashedAtOf(env, id))) throw new RefusedError("This post is not in the trash.");
      await dropTrash(env, id).run();
      return { id, version: file.sha, status: statusOf(file.content), changeId: input.changeId };
    },

    // The file and every revision move to the new slug, then the post is saved there (its rows, search and Ask records
    // follow) and its old rows go. Rendered under the new slug first, so a source the new slug refuses moves nothing.
    async rename(id, input) {
      const file = await current(id, input.expectedVersion);
      const to = input.newSlug;
      if (!SLUG_PATTERN.test(to) || to.length > SLUG_MAX_LENGTH) {
        throw new RefusedError(`"${to}" is not a post slug: lower case letters and digits joined by single hyphens.`);
      }
      if (await readFile(env, postPath(to))) throw new RefusedError(`A post with the slug "${to}" already exists.`);
      const raw = withSlug(file.content, to);
      try {
        await validateAndRender(env, to, raw);
      } catch (error) {
        return asSiteApiError(env, error, postPath(id));
      }
      const everPublic = readState(file.content).firstPublished !== null;
      const moved = await movePost(env, {
        from: id,
        to,
        fromPath: postPath(id),
        toPath: postPath(to),
        sha: file.sha,
        redirect: everPublic,
      });
      if (!moved) throw new VersionConflictError((await readFile(env, postPath(id)))?.sha ?? null);
      await forgetPostRows(env, id);
      const result = await write(to, input.changeId, raw, file.sha);
      return { ...result, previousPath: everPublic ? `/writing/${id}` : null };
    },

    // The page the save would publish: the same record renderAndWrite builds, rendered through the
    // blog route and the root layout in-process, so nothing is written and nothing is cached.
    async preview(previewSlug, input) {
      if (!renderDocument) throw new Error("the document handler is not on this request's context");
      const slug = previewSlug ?? UNSAVED_PREVIEW_SLUG;
      let record: PostRecord;
      try {
        record = await renderRecord(env, slug, forPreview(input.source, slug));
      } catch (error) {
        return asSiteApiError(env, error, postPath(slug));
      }
      const post = await previewPost(env, record);

      // Every context the Renderer sets for a public path: the nonce is undefined there, as a
      // public page carries none (workers/csp.mjs).
      const context = new RouterContextProvider();
      context.set(cloudflareContext, { env, ctx });
      context.set(nonceContext, undefined);
      context.set(postPreviewContext, post);
      const response = await renderDocument(
        new Request(`${origin}/writing/${slug}`, { headers: { accept: "text/html" } }),
        context,
      );
      if (!response.ok) {
        throw new RefusedError(`The page did not render: the blog route answered ${response.status}.`);
      }
      return response.text();
    },
  };

  const registry = contentRegistry([
    postHandler,
    publicationHandler(env),
    pageHandler(env),
    documentHandler(env),
    cvHandler(env, ctx),
    dictionaryHandler(env),
    rosterHandler(env),
    phageHandler(env),
    // No procedure or registry kinds: the Knowledge Base is edited in the site's own admin
    // (docs/KNOWLEDGE-BASE.md, Carrel).
  ]);

  return {
    site: { id: "dustinedwards-info", name: SITE.name, origin: SITE_ORIGIN },
    // Every deploy renders the whole corpus again (docs/PUBLISHING.md), so the stored HTML is this Prelum's.
    renderVersion: RENDER_VERSION,
    content: registry.adapter,
    preview: { render: registry.render },
    media: carrelMediaAdapter(env),
    mentions: carrelMentionsAdapter(env),
    schedules: postSchedules(env, write),
  };
}
