// The publication kind of Carrel's /content group (docs/PUBLICATIONS.md): ids are `publication.<slug>` (the
// registry encodes them), and a write goes through savePublication, the one path a publication reaches the
// repository by. Nothing here writes around it, and there is no editor in the site's admin for this kind.

import { VersionConflictError } from "@dustinedwards/site-api";
import type { ContentStatus, ContentSummary, WriteResult } from "@dustinedwards/site-api";

import { listPublicationIdentities } from "~/db/publications";
import type { ContentKindHandler } from "~/lib/carrel/content-kinds.server";
import { asSiteApiError } from "~/lib/carrel/errors.server";
import { withPublication } from "~/lib/carrel/front-matter-lines";
import { listCommitsForPath, readFile } from "~/lib/editor/github.server";
import { GitHubError, currentHead } from "~/lib/editor/publish.server";
import { parsePublication, publicationPath } from "~/lib/publications/parse.mjs";
import { paperPath } from "~/lib/publications/paths.mjs";
import { fileIsDraft, savePublication } from "~/lib/publications/save.server";
import type { Publication } from "~/lib/publications/types";

type PublicationEnv = Env & { GITHUB_TOKEN?: string };

/** A version is a commit sha: the repository's head for a write, any commit for a revision. */
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

/** The deposited date at its own precision, as the timestamp the contract wants (a partial date reads as its first day). */
function timestampOf(date: string | null): string | null {
  if (!date) return null;
  const full = date.length === 4 ? `${date}-01-01` : date.length === 7 ? `${date}-01` : date;
  const at = Date.parse(`${full}T00:00:00.000Z`);
  return Number.isNaN(at) ? null : new Date(at).toISOString();
}

export function publicationHandler(env: PublicationEnv): ContentKindHandler {
  /** One write through savePublication as the Carrel actor, answered in the package's terms. */
  async function write(slug: string, changeId: string, raw: string, expectedVersion: string | null): Promise<WriteResult> {
    try {
      const saved = await savePublication(env, {
        slug,
        raw,
        expectedHeadSha: expectedVersion,
        isNew: expectedVersion === null,
        actor: { kind: "carrel", changeId },
      });
      return { id: slug, version: saved.commitSha, status: saved.draft ? "draft" : "published", changeId };
    } catch (error) {
      return asSiteApiError(env, error);
    }
  }

  /** The stored file for a write that names a version; a version for a missing id is a conflict. */
  async function existing(slug: string): Promise<string> {
    const file = await readFile(env, publicationPath(slug));
    if (!file) throw new VersionConflictError(null);
    return file.content;
  }

  return {
    kind: "publication",

    async list(query) {
      const needle = query.q?.toLowerCase();
      const rows = await listPublicationIdentities(env);
      const summaries: ContentSummary[] = rows.map((row) => {
        const record = JSON.parse(row.record) as Publication;
        const status: ContentStatus = row.status === "draft" ? "draft" : "published";
        return {
          id: row.slug,
          kind: "publication",
          title: row.title,
          status,
          path: status === "draft" ? null : paperPath(row.slug),
          publishAt: null,
          publishedAt: status === "published" ? timestampOf(record.publishedDate) : null,
          updatedAt: row.syncedAt ? row.syncedAt.toISOString() : null,
        };
      });
      return summaries
        .filter((s) => !query.status || s.status === query.status)
        .filter((s) => !needle || s.title.toLowerCase().includes(needle) || s.id.includes(needle));
    },

    async get(slug) {
      const file = await readFile(env, publicationPath(slug));
      if (!file) return null;
      const [version, rows] = await Promise.all([currentHead(env), listPublicationIdentities(env)]);
      const { data } = parsePublication({ file: publicationPath(slug), raw: file.content });
      const draft = data.draft === true;
      const stored = rows.find((row) => row.slug === slug);
      return {
        id: slug,
        kind: "publication",
        title: typeof data.title === "string" ? data.title : slug,
        status: draft ? "draft" : "published",
        path: draft ? null : paperPath(slug),
        publishAt: null,
        publishedAt: draft ? null : timestampOf(typeof data.publishedDate === "string" ? data.publishedDate : null),
        updatedAt: stored?.syncedAt ? stored.syncedAt.toISOString() : null,
        format: "markdown",
        source: file.content,
        version,
      };
    },

    // Keeps the stored status, as a post does: a save to a live paper edits it live, and a new record
    // starts as a draft. First publication is a separate call, which Carrel's key may make.
    async saveDraft(slug, input) {
      const file = await readFile(env, publicationPath(slug));
      if (input.expectedVersion === null && file) throw new VersionConflictError(await currentHead(env));
      if (input.expectedVersion !== null && !file) throw new VersionConflictError(null);
      const raw = withPublication(input.source, { draft: file ? fileIsDraft(file.content) : true });
      return write(slug, input.changeId, raw, input.expectedVersion);
    },

    async publish(slug, input) {
      // Read even when source is sent: a version for an id that does not exist is a conflict.
      const stored = await existing(slug);
      return write(slug, input.changeId, withPublication(input.source ?? stored, { draft: false }), input.expectedVersion);
    },

    async unpublish(slug, input) {
      const source = await existing(slug);
      return write(slug, input.changeId, withPublication(source, { draft: true }), input.expectedVersion);
    },

    async revisions(slug) {
      if (!(await readFile(env, publicationPath(slug)))) return null;
      const commits = await listCommitsForPath(env, publicationPath(slug), 50);
      return commits.map((c) => ({
        version: c.sha,
        at: new Date(c.date).toISOString(),
        author: c.author.slice(0, 200),
        message: c.message.slice(0, 2000),
      }));
    },

    async revisionSource(slug, version) {
      if (!COMMIT_SHA.test(version)) return null;
      try {
        return (await readFile(env, publicationPath(slug), version))?.content ?? null;
      } catch (error) {
        // An unknown ref is a missing version, not a failure of the site.
        if (error instanceof GitHubError && error.status === 422) return null;
        throw error;
      }
    },
  };
}
