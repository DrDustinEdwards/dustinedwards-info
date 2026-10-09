// The "procedure" kind of Carrel's content group (docs/PROCEDURES.md): the lab protocols under
// content/procedures. The id is `procedure.<slug>`. Every read is the operator API's (listProceduresForOperator,
// the file itself) and every write is saveProcedure, the one procedure save, so a procedure saved through
// Carrel is compiled by the code CI runs, committed, written to D1 and live on the next request with no deploy.
// A procedure has no publish time and no preview route, so it is neither scheduled nor previewed.

import { VersionConflictError } from "@dustinedwards/site-api";
import type { ContentStatus, ContentSummary, WriteResult } from "@dustinedwards/site-api";

import { listProceduresForOperator } from "~/db/procedures";
import type { ContentKindHandler } from "~/lib/carrel/content-kinds.server";
import { asSiteApiError } from "~/lib/carrel/errors.server";
import { withPublication } from "~/lib/carrel/front-matter-lines";
import { GitHubError, listCommitsForPath, readFile } from "~/lib/editor/github.server";
import { parseProcedure, procedurePath } from "~/kb/procedures/parse.mjs";
import { saveProcedure } from "~/kb/procedures/save.server";

type ProcedureEnv = Env & { GITHUB_TOKEN?: string };

/** A revision's version is a commit sha; an item's own version is the blob sha of its file. */
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

/** Whether a stored file is a draft, read from the file itself, the only authority. */
const fileIsDraft = (raw: string) => parseProcedure({ file: "", raw }).data.draft === true;

/** The source with its draft flag set to `draft`, touching no line when it already says so. */
const withDraft = (raw: string, draft: boolean) => (fileIsDraft(raw) === draft ? raw : withPublication(raw, { draft }));

/** A date the file wrote, as the ISO instant a summary carries; null when the file wrote none. */
function isoDay(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : new Date(at).toISOString();
}

export function procedureHandler(env: ProcedureEnv): ContentKindHandler {
  /** One write through saveProcedure as the Carrel actor, answered in the package's terms. */
  async function write(slug: string, changeId: string, raw: string, expectedVersion: string | null): Promise<WriteResult> {
    try {
      const saved = await saveProcedure(env, {
        slug,
        raw,
        expectedBlobSha: expectedVersion ?? undefined,
        isNew: expectedVersion === null,
        actor: { kind: "carrel", changeId },
      });
      return { id: slug, version: saved.sourceBlobSha, status: saved.draft ? "draft" : "published", changeId };
    } catch (error) {
      // A ProcedureInvalid carries every message the validator gave; asSiteApiError passes them on.
      return asSiteApiError(env, error, procedurePath(slug));
    }
  }

  /** The stored file for a write that names a version; a version for a missing id is a conflict. */
  async function existing(slug: string): Promise<string> {
    const file = await readFile(env, procedurePath(slug));
    if (!file) throw new VersionConflictError(null);
    return file.content;
  }

  return {
    kind: "procedure",

    async list(query) {
      const needle = query.q?.toLowerCase();
      const summaries: ContentSummary[] = (await listProceduresForOperator(env)).map((row) => {
        const status: ContentStatus = row.draft ? "draft" : "published";
        return {
          id: row.slug,
          kind: "procedure",
          title: row.title,
          status,
          path: row.draft ? null : row.path,
          publishAt: null,
          publishedAt: null,
          updatedAt: isoDay(row.updated),
        };
      });
      return summaries
        .filter((s) => !query.status || s.status === query.status)
        .filter((s) => !needle || s.title.toLowerCase().includes(needle) || s.id.includes(needle));
    },

    async get(slug) {
      const file = await readFile(env, procedurePath(slug));
      if (!file) return null;
      const { data } = parseProcedure({ file: procedurePath(slug), raw: file.content });
      const draft = data.draft === true;
      return {
        id: slug,
        kind: "procedure",
        title: typeof data.title === "string" ? data.title : slug,
        status: draft ? "draft" : "published",
        path: draft || typeof data.path !== "string" ? null : data.path,
        publishAt: null,
        publishedAt: null,
        updatedAt: isoDay(data.updated),
        format: "markdown",
        source: file.content,
        version: file.sha,
      };
    },

    // Keeps the stored status, as a post does: a save to a live procedure edits it live, and a new one starts
    // as a draft. First publication is a separate call, which Carrel's key may make.
    async saveDraft(slug, input) {
      const file = await readFile(env, procedurePath(slug));
      if (input.expectedVersion === null && file) throw new VersionConflictError(file.sha);
      if (input.expectedVersion !== null && !file) throw new VersionConflictError(null);
      const raw = withDraft(input.source, file ? fileIsDraft(file.content) : true);
      return write(slug, input.changeId, raw, input.expectedVersion);
    },

    async publish(slug, input) {
      // Read even when source is sent: a version for an id that does not exist is a conflict.
      const stored = await existing(slug);
      return write(slug, input.changeId, withDraft(input.source ?? stored, false), input.expectedVersion);
    },

    async unpublish(slug, input) {
      const source = await existing(slug);
      return write(slug, input.changeId, withDraft(source, true), input.expectedVersion);
    },

    async revisions(slug) {
      if (!(await readFile(env, procedurePath(slug)))) return null;
      const commits = await listCommitsForPath(env, procedurePath(slug), 50);
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
        return (await readFile(env, procedurePath(slug), version))?.content ?? null;
      } catch (error) {
        // An unknown ref is a missing version, not a failure of the site.
        if (error instanceof GitHubError && error.status === 422) return null;
        throw error;
      }
    },
  };
}
