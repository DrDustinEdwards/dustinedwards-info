// The dustinedwards.info side of Carrel's site API (carrel/design.md section 4): the package owns the
// route, the key, the rate limit and every body's shape; this adapter maps its content and preview
// calls onto the site's own save, render and history code. Nothing here writes around savePost.
// Media (v0.2.0) is its own module, over the site's media code.

import { RefusedError, VersionConflictError, type SiteAdapter } from "@dustinedwards/site-api";
import type { ContentStatus, ContentSummary, WriteResult } from "@dustinedwards/site-api";
import { getTableColumns } from "drizzle-orm";
import { RouterContextProvider } from "react-router";

import { listAllPostsForAdmin, previewBlogPost, type PostRow } from "~/db";
import { posts } from "~/db/schema";
import { carrelMediaAdapter } from "~/lib/carrel/media-adapter.server";
import { postPath } from "~/lib/content/slug.mjs";
import { cloudflareContext, nonceContext, postPreviewContext } from "~/lib/context";
import { contentRegistry, type ContentKindHandler } from "~/lib/carrel/content-kinds.server";
import { publicationHandler } from "~/lib/carrel/publication-handler.server";
import { asSiteApiError } from "~/lib/carrel/errors.server";
import { withPublication } from "~/lib/carrel/front-matter-lines";
import { documentHandler } from "~/lib/carrel/document-handler.server";
import { dictionaryHandler } from "~/lib/carrel/dictionary-handler.server";
import { pageHandler } from "~/lib/carrel/page-handler.server";
import { cvHandler } from "~/lib/carrel/cv-handler.server";
import { phageHandler } from "~/lib/carrel/phage-handler.server";
import { rosterHandler } from "~/lib/carrel/roster-handler.server";
import { listCommitsForPath, readFile } from "~/lib/editor/github.server";
import { parsePost } from "~/lib/editor/frontmatter";
import {
  GitHubError,
  currentHead,
  postColumnValues,
  renderRecord,
  savePost,
} from "~/lib/editor/publish.server";
import { readState } from "~/lib/editor/publish-policy.mjs";
import { SITE, SITE_ORIGIN } from "~/lib/seo";

export { withPublication };

type CarrelEnv = Env & { GITHUB_TOKEN?: string };

type RenderDocument = (request: Request, context: RouterContextProvider) => Promise<Response>;

/** A version is a commit sha: the repository's head for a write, any commit for a revision. */
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

/** A preview of a post not yet in D1 needs an id no stored row has, for its neighbours' tie-break. */
const PREVIEW_ROW_ID = Number.MAX_SAFE_INTEGER;

/** The slug a preview renders at when Carrel sends no id: a new post that has none yet. */
const UNSAVED_PREVIEW_SLUG = "carrel-preview";

/** Draft, scheduled or published, from the file itself, which is the only authority on status. */
function statusOf(raw: string, now = Date.now()): ContentStatus {
  if (readState(raw).draft) return "draft";
  const at = parsePost(raw).publishAt.trim();
  return at && Date.parse(at) > now ? "scheduled" : "published";
}

/** The effective publication time, as the pipeline computes it: publish_at, else the date. */
function effectivePublishAt(raw: string): number {
  const fields = parsePost(raw);
  return Date.parse(fields.publishAt.trim() || `${fields.date}T00:00:00.000Z`);
}

/**
 * The drizzle row getBlogPost would read once this record were synced: the synced columns decoded
 * through the schema's own column mappers, and the columns the sync does not write kept from the
 * stored row. A column neither supplies is an error, so a new column cannot quietly go missing here.
 */
async function previewRow(env: CarrelEnv, record: any): Promise<PostRow> {
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
export async function previewPost(env: CarrelEnv, record: any) {
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
        raw,
        expectedHeadSha: expectedVersion,
        isNew: expectedVersion === null,
        actor: { kind: "carrel", changeId },
      });
      return { id, version: saved.commitSha, status: statusOf(raw), changeId };
    } catch (error) {
      return asSiteApiError(env, error);
    }
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
      const needle = query.q?.toLowerCase();
      const summaries: ContentSummary[] = (await listAllPostsForAdmin(env)).map((row) => {
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
        };
      });
      return summaries
        .filter((s) => !query.status || s.status === query.status)
        .filter((s) => !needle || s.title.toLowerCase().includes(needle) || s.id.includes(needle));
    },

    async get(id) {
      const file = await readFile(env, postPath(id));
      if (!file) return null;
      const [version, updated] = await Promise.all([
        currentHead(env),
        env.DB.prepare(`SELECT updated_at FROM posts WHERE slug = ?1`)
          .bind(id)
          .first<{ updated_at: number }>(),
      ]);
      const fields = parsePost(file.content);
      const { firstPublished } = readState(file.content);
      const status = statusOf(file.content);
      return {
        id,
        kind: "post",
        title: fields.title || id,
        status,
        path: firstPublished ? `/writing/${id}` : null,
        publishAt: status === "scheduled" ? new Date(Date.parse(fields.publishAt)).toISOString() : null,
        publishedAt: firstPublished ? `${firstPublished}T00:00:00.000Z` : null,
        updatedAt: updated ? new Date(updated.updated_at * 1000).toISOString() : null,
        format: "markdown",
        source: file.content,
        version,
      };
    },

    // Keeps the stored status, as the contract's reference adapter does: a save to a live post
    // edits it live, and a new post starts as a draft.
    async saveDraft(id, input) {
      const file = await readFile(env, postPath(id));
      if (input.expectedVersion === null && file) throw new VersionConflictError(await currentHead(env));
      if (input.expectedVersion !== null && !file) throw new VersionConflictError(null);
      const raw = file
        ? withPublication(input.source, {
            draft: readState(file.content).draft,
            publishAt: parsePost(file.content).publishAt.trim() || null,
          })
        : withPublication(input.source, { draft: true });
      return write(id, input.changeId, raw, input.expectedVersion);
    },

    async publish(id, input) {
      // Read even when source is sent: a version for an id that does not exist is a conflict.
      const stored = await existing(id);
      const source = input.source ?? stored;
      // A post whose time is still ahead would publish invisible, so publishing now means now.
      const due = effectivePublishAt(source) > Date.now() ? new Date().toISOString() : undefined;
      return write(id, input.changeId, withPublication(source, { draft: false, publishAt: due }), input.expectedVersion);
    },

    async schedule(id, input) {
      const at = Date.parse(input.publishAt);
      if (!(at > Date.now())) {
        throw new RefusedError("publishAt is not in the future; publish it now instead.");
      }
      const stored = await existing(id);
      const source = input.source ?? stored;
      return write(
        id,
        input.changeId,
        withPublication(source, { draft: false, publishAt: new Date(at).toISOString() }),
        input.expectedVersion,
      );
    },

    async unpublish(id, input) {
      const source = await existing(id);
      return write(id, input.changeId, withPublication(source, { draft: true }), input.expectedVersion);
    },

    async revisions(id) {
      if (!(await readFile(env, postPath(id)))) return null;
      const commits = await listCommitsForPath(env, postPath(id), 50);
      return commits.map((c) => ({
        version: c.sha,
        at: new Date(c.date).toISOString(),
        author: c.author.slice(0, 200),
        message: c.message.slice(0, 2000),
      }));
    },

    async revisionSource(id, version) {
      if (!COMMIT_SHA.test(version)) return null;
      try {
        return (await readFile(env, postPath(id), version))?.content ?? null;
      } catch (error) {
        // An unknown ref is a missing version, not a failure of the site.
        if (error instanceof GitHubError && error.status === 422) return null;
        throw error;
      }
    },

    // The page the save would publish: the same record renderAndWrite builds, rendered through the
    // blog route and the root layout in-process, so nothing is written and nothing is cached.
    async preview(previewSlug, input) {
      if (!renderDocument) throw new Error("the document handler is not on this request's context");
      const slug = previewSlug ?? UNSAVED_PREVIEW_SLUG;
      let record: any;
      try {
        record = await renderRecord(env, slug, input.source);
      } catch (error) {
        return asSiteApiError(env, error);
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

    media: carrelMediaAdapter(env),
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
  ]);

  return {
    site: { id: "dustinedwards-info", name: SITE.name, origin: SITE_ORIGIN },
    content: registry.adapter,
    preview: { render: registry.render },
  };
}
