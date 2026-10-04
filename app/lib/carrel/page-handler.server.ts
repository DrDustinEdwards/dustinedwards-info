// The "page" kind of Carrel's content group (docs/PAGES.md): the Research, Teaching and Software prose
// pages. The id is `page.<slug>`, the slug being the file key (`research-phages` for /research/phages).
// Every write is savePage, the one page save, so a page saved through Carrel is validated by the code
// CI runs, committed, written to D1 and live on the next request with no deploy. A page cannot be
// created here: its address is structure and lives in CONTENT_PAGE_PATHS, so an id no registered path
// names is refused, and a save that names a missing file is a conflict like a post's.

import { RefusedError, VersionConflictError } from "@dustinedwards/site-api";
import type { ContentStatus, ContentSummary, WriteResult } from "@dustinedwards/site-api";
import matter from "gray-matter";

import { listPageRows } from "~/db/pages";
import type { ContentKindHandler } from "~/lib/carrel/content-kinds.server";
import { asSiteApiError } from "~/lib/carrel/errors.server";
import { withPublication } from "~/lib/carrel/front-matter-lines";
import { GitHubError, listCommitsForPath, readFile } from "~/lib/editor/github.server";
import { PAGES_DIR, pagePathForSlug, pageSourcePath } from "~/lib/pages/compile.mjs";
import { savePage } from "~/lib/pages/save.server";

type PageEnv = Env & { GITHUB_TOKEN?: string };

/** A revision's version is a commit sha; an item's own version is the blob sha of its file. */
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

const isDraft = (raw: string) => matter(raw).data.draft === true;
const statusOf = (raw: string): ContentStatus => (isDraft(raw) ? "draft" : "published");

export function pageHandler(env: PageEnv): ContentKindHandler {
  /** The path and file of a registered slug, or null: an id no registered path names owns nothing. */
  function registered(slug: string) {
    const path = pagePathForSlug(slug);
    return path ? { path, file: pageSourcePath(slug) } : null;
  }

  /** The same, for a write: a missing registration is a refusal that says why. */
  function target(slug: string) {
    const found = registered(slug);
    if (!found) {
      throw new RefusedError(
        `"${slug}" names no registered page. A save cannot create a page: its address is added to ` +
          `CONTENT_PAGE_PATHS (app/lib/content-pages.mjs) in code first. The files are in ${PAGES_DIR}/.`,
      );
    }
    return found;
  }

  /** One write through savePage as the Carrel actor, answered in the package's terms. */
  async function write(slug: string, changeId: string, raw: string, expectedVersion: string | null): Promise<WriteResult> {
    const { path } = target(slug);
    try {
      const saved = await savePage(env, {
        path,
        raw,
        expectedBlobSha: expectedVersion ?? undefined,
        isNew: false,
        actor: { kind: "carrel", changeId },
      });
      return { id: slug, version: saved.sourceBlobSha, status: saved.draft ? "draft" : "published", changeId };
    } catch (error) {
      // A PageInvalid carries every message the validator gave; asSiteApiError passes them on.
      return asSiteApiError(env, error, target(slug).file);
    }
  }

  /** The stored file for a write that names a version; a version for a missing file is a conflict. */
  async function existing(slug: string): Promise<string> {
    const file = await readFile(env, target(slug).file);
    if (!file) throw new VersionConflictError(null);
    return file.content;
  }

  /** The source with its draft flag set to `draft`, touching no line when it already says so. */
  const withDraft = (raw: string, draft: boolean) =>
    isDraft(raw) === draft ? raw : withPublication(raw, { draft });

  return {
    kind: "page",

    async list(query) {
      const needle = query.q?.toLowerCase();
      const summaries: ContentSummary[] = (await listPageRows(env)).map((row) => {
        const status: ContentStatus = row.draft ? "draft" : "published";
        return {
          id: row.slug,
          kind: "page",
          title: row.title,
          status,
          path: row.draft ? null : row.path,
          publishAt: null,
          publishedAt: null,
          updatedAt: row.syncedAt.toISOString(),
        };
      });
      return summaries
        .filter((s) => !query.status || s.status === query.status)
        .filter((s) => !needle || s.title.toLowerCase().includes(needle) || s.id.includes(needle));
    },

    async get(slug) {
      const found = registered(slug);
      if (!found) return null;
      const file = await readFile(env, found.file);
      if (!file) return null;
      const row = await env.DB.prepare(`SELECT synced_at FROM pages WHERE slug = ?1`).bind(slug).first<{ synced_at: number }>();
      const fields = matter(file.content).data;
      return {
        id: slug,
        kind: "page",
        title: String(fields.title ?? slug),
        status: statusOf(file.content),
        path: isDraft(file.content) ? null : found.path,
        publishAt: null,
        publishedAt: null,
        updatedAt: row ? new Date(row.synced_at * 1000).toISOString() : null,
        format: "markdown",
        source: file.content,
        version: file.sha,
      };
    },

    // Keeps the stored status, as a post does: a save to a live page edits it live. A page always has its
    // file, so a save that names no version is a conflict.
    async saveDraft(slug, input) {
      const found = target(slug);
      const file = await readFile(env, found.file);
      if (input.expectedVersion === null && file) throw new VersionConflictError(file.sha);
      if (input.expectedVersion !== null && !file) throw new VersionConflictError(null);
      if (!file) throw new RefusedError(`The file for ${found.path} is missing from the repository, so it cannot be saved.`);
      return write(slug, input.changeId, withDraft(input.source, isDraft(file.content)), input.expectedVersion);
    },

    async publish(slug, input) {
      const stored = await existing(slug);
      return write(slug, input.changeId, withDraft(input.source ?? stored, false), input.expectedVersion);
    },

    async unpublish(slug, input) {
      const stored = await existing(slug);
      return write(slug, input.changeId, withDraft(stored, true), input.expectedVersion);
    },

    async revisions(slug) {
      const found = registered(slug);
      if (!found || !(await readFile(env, found.file))) return null;
      const commits = await listCommitsForPath(env, found.file, 50);
      return commits.map((c) => ({
        version: c.sha,
        at: new Date(c.date).toISOString(),
        author: c.author.slice(0, 200),
        message: c.message.slice(0, 2000),
      }));
    },

    async revisionSource(slug, version) {
      const found = registered(slug);
      if (!found || !COMMIT_SHA.test(version)) return null;
      try {
        return (await readFile(env, found.file, version))?.content ?? null;
      } catch (error) {
        // An unknown ref is a missing version, not a failure of the site.
        if (error instanceof GitHubError && error.status === 422) return null;
        throw error;
      }
    },
  };
}
