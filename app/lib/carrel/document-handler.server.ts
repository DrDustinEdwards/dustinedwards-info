// The "document" kind of Carrel's content group (docs/LLMS.md): today one record, `document.llms`, the
// content/llms.txt file /llms.txt is served from. Every write is saveLlms, the one llms.txt save, so an edit
// through Carrel is validated by the code CI runs, committed, written to D1 and live on the next request with
// no deploy. A document has no draft state: it is always published, so saveDraft and publish are the same
// save (a save to a live document edits it live, as a save to a live page does), and it cannot be
// unpublished or created here. It has no preview: the page is plain text, and there is nothing rendered.

import { RefusedError, VersionConflictError } from "@dustinedwards/site-api";
import type { ContentSummary, WriteResult } from "@dustinedwards/site-api";

import type { ContentKindHandler } from "~/lib/carrel/content-kinds.server";
import { asSiteApiError } from "~/lib/carrel/errors.server";
import { GitHubError, listCommitsForPath, readFile } from "~/lib/editor/github.server";
import { saveLlms } from "~/lib/llms/save.server";
import { LLMS_PATH } from "~/lib/llms/validate.mjs";

type DocumentEnv = Env & { GITHUB_TOKEN?: string };

/** The one slug of the kind. `document.llms` is the id Carrel sees. */
const LLMS_SLUG = "llms";

const TITLE = "llms.txt";
const PUBLIC_PATH = "/llms.txt";

/** A revision's version is a commit sha; an item's own version is the blob sha of its file. */
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

export function documentHandler(env: DocumentEnv): ContentKindHandler {
  /** A write names the one document, or is refused with the reason. */
  function target(slug: string) {
    if (slug !== LLMS_SLUG) {
      throw new RefusedError(`"${slug}" names no document. The only document is "${LLMS_SLUG}" (${LLMS_PATH}); a save cannot create another.`);
    }
  }

  /** One write through saveLlms as the Carrel actor, answered in the package's terms. */
  async function write(slug: string, changeId: string, raw: string, expectedVersion: string | null): Promise<WriteResult> {
    try {
      const saved = await saveLlms(env, { raw, expectedBlobSha: expectedVersion ?? undefined, actor: { kind: "carrel", changeId } });
      return { id: slug, version: saved.sourceBlobSha, status: "published", changeId };
    } catch (error) {
      return asSiteApiError(env, error, LLMS_PATH);
    }
  }

  /** The stored file; a write that names a version for a missing file is a conflict. */
  async function existing() {
    const file = await readFile(env, LLMS_PATH);
    if (!file) throw new VersionConflictError(null);
    return file.content;
  }

  /** A save, which is also the publish: the document has no state to change. */
  async function save(slug: string, input: { changeId: string; source?: string; expectedVersion: string | null }) {
    target(slug);
    const stored = await readFile(env, LLMS_PATH);
    // The file always exists, so a save that names no version is a conflict, as a page's is.
    if (input.expectedVersion === null && stored) throw new VersionConflictError(stored.sha);
    if (input.expectedVersion !== null && !stored) throw new VersionConflictError(null);
    if (!stored) throw new RefusedError(`${LLMS_PATH} is missing from the repository, so it cannot be saved.`);
    return write(slug, input.changeId, input.source ?? stored.content, input.expectedVersion);
  }

  return {
    kind: "document",

    async list(query) {
      const needle = query.q?.toLowerCase();
      const summary: ContentSummary = {
        id: LLMS_SLUG,
        kind: "document",
        title: TITLE,
        status: "published",
        path: PUBLIC_PATH,
        publishAt: null,
        publishedAt: null,
        // The settings row carries no timestamp, and the file's last change is the revision list.
        updatedAt: null,
      };
      const matches = (!query.status || query.status === "published") && (!needle || TITLE.includes(needle) || LLMS_SLUG.includes(needle));
      return matches ? [summary] : [];
    },

    async get(slug) {
      if (slug !== LLMS_SLUG) return null;
      const file = await readFile(env, LLMS_PATH);
      if (!file) return null;
      return {
        id: LLMS_SLUG,
        kind: "document",
        title: TITLE,
        status: "published",
        path: PUBLIC_PATH,
        publishAt: null,
        publishedAt: null,
        updatedAt: null,
        format: "markdown",
        source: file.content,
        version: file.sha,
      };
    },

    saveDraft: (slug, input) => save(slug, input),

    async publish(slug, input) {
      target(slug);
      // Read even when source is sent: a version for a missing file is a conflict.
      const stored = await existing();
      return write(slug, input.changeId, input.source ?? stored, input.expectedVersion);
    },

    async unpublish() {
      throw new RefusedError(`${TITLE} cannot be unpublished: it is the document agents read first, and it has no draft state.`);
    },

    async revisions(slug) {
      if (slug !== LLMS_SLUG || !(await readFile(env, LLMS_PATH))) return null;
      const commits = await listCommitsForPath(env, LLMS_PATH, 50);
      return commits.map((c) => ({
        version: c.sha,
        at: new Date(c.date).toISOString(),
        author: c.author.slice(0, 200),
        message: c.message.slice(0, 2000),
      }));
    },

    async revisionSource(slug, version) {
      if (slug !== LLMS_SLUG || !COMMIT_SHA.test(version)) return null;
      try {
        return (await readFile(env, LLMS_PATH, version))?.content ?? null;
      } catch (error) {
        // An unknown ref is a missing version, not a failure of the site.
        if (error instanceof GitHubError && error.status === 422) return null;
        throw error;
      }
    },
  };
}
