// The "dictionary" kind of Carrel's content group (docs/DICTIONARY.md): the entries that open the named
// Software pages. The id is `dictionary.<key>`, the key being the file's name (`capsid` for
// content/dictionary/capsid.md). Every write is saveDictionaryEntry, the one dictionary save, so an entry saved
// through Carrel is validated by the code CI runs, committed, written to D1 and live on the next request with no
// deploy. An entry's page is a registered path, so what an entry may open is structure and lives in
// CONTENT_PAGE_PATHS in code; the validator refuses a path that is not one.

import { VersionConflictError } from "@dustinedwards/site-api";
import type { ContentStatus, ContentSummary, WriteResult } from "@dustinedwards/site-api";

import { listDictionaryRows } from "~/db/dictionary";
import type { ContentKindHandler } from "~/lib/carrel/content-kinds.server";
import { asSiteApiError } from "~/lib/carrel/errors.server";
import { withPublication } from "~/lib/carrel/front-matter-lines";
import { dictionaryPath, parseDictionaryEntry } from "~/lib/dictionary/parse.mjs";
import { fileIsDraft, saveDictionaryEntry } from "~/lib/dictionary/save.server";
import { GitHubError, listCommitsForPath, readFile } from "~/lib/editor/github.server";
import { currentHead } from "~/lib/editor/publish.server";

type DictionaryEnv = Env & { GITHUB_TOKEN?: string };

/** A version is a commit sha: the repository's head for a write, any commit for a revision. */
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

/** The source with its draft flag set to `draft`, touching no line when it already says so. */
const withDraft = (raw: string, draft: boolean) => (fileIsDraft(raw) === draft ? raw : withPublication(raw, { draft }));

export function dictionaryHandler(env: DictionaryEnv): ContentKindHandler {
  /** One write through saveDictionaryEntry as the Carrel actor, answered in the package's terms. */
  async function write(key: string, changeId: string, raw: string, expectedVersion: string | null): Promise<WriteResult> {
    try {
      const saved = await saveDictionaryEntry(env, {
        key,
        raw,
        expectedHeadSha: expectedVersion,
        isNew: expectedVersion === null,
        actor: { kind: "carrel", changeId },
      });
      return { id: key, version: saved.commitSha, status: saved.draft ? "draft" : "published", changeId };
    } catch (error) {
      // A DictionaryInvalid carries every message the validator gave; asSiteApiError passes them on.
      return asSiteApiError(env, error);
    }
  }

  /** The stored file for a write that names a version; a version for a missing id is a conflict. */
  async function existing(key: string): Promise<string> {
    const file = await readFile(env, dictionaryPath(key));
    if (!file) throw new VersionConflictError(null);
    return file.content;
  }

  return {
    kind: "dictionary",

    async list(query) {
      const needle = query.q?.toLowerCase();
      const summaries: ContentSummary[] = (await listDictionaryRows(env)).map((row) => {
        const status: ContentStatus = row.draft ? "draft" : "published";
        return {
          id: row.key,
          kind: "dictionary",
          title: row.term,
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

    async get(key) {
      const file = await readFile(env, dictionaryPath(key));
      if (!file) return null;
      const [version, row] = await Promise.all([
        currentHead(env),
        env.DB.prepare(`SELECT synced_at FROM dictionary_entries WHERE key = ?1`).bind(key).first<{ synced_at: number }>(),
      ]);
      const { data } = parseDictionaryEntry({ file: dictionaryPath(key), raw: file.content });
      const draft = data.draft === true;
      return {
        id: key,
        kind: "dictionary",
        title: typeof data.term === "string" ? data.term : key,
        status: draft ? "draft" : "published",
        path: draft || typeof data.path !== "string" ? null : data.path,
        publishAt: null,
        publishedAt: null,
        updatedAt: row ? new Date(row.synced_at * 1000).toISOString() : null,
        format: "markdown",
        source: file.content,
        version,
      };
    },

    // Keeps the stored status, as a post does: a save to a live entry edits it live, and a new entry starts as
    // a draft. First publication is a separate call, which Carrel's key may make.
    async saveDraft(key, input) {
      const file = await readFile(env, dictionaryPath(key));
      if (input.expectedVersion === null && file) throw new VersionConflictError(await currentHead(env));
      if (input.expectedVersion !== null && !file) throw new VersionConflictError(null);
      const raw = withDraft(input.source, file ? fileIsDraft(file.content) : true);
      return write(key, input.changeId, raw, input.expectedVersion);
    },

    async publish(key, input) {
      // Read even when source is sent: a version for an id that does not exist is a conflict.
      const stored = await existing(key);
      return write(key, input.changeId, withDraft(input.source ?? stored, false), input.expectedVersion);
    },

    async unpublish(key, input) {
      const source = await existing(key);
      return write(key, input.changeId, withDraft(source, true), input.expectedVersion);
    },

    async revisions(key) {
      if (!(await readFile(env, dictionaryPath(key)))) return null;
      const commits = await listCommitsForPath(env, dictionaryPath(key), 50);
      return commits.map((c) => ({
        version: c.sha,
        at: new Date(c.date).toISOString(),
        author: c.author.slice(0, 200),
        message: c.message.slice(0, 2000),
      }));
    },

    async revisionSource(key, version) {
      if (!COMMIT_SHA.test(version)) return null;
      try {
        return (await readFile(env, dictionaryPath(key), version))?.content ?? null;
      } catch (error) {
        // An unknown ref is a missing version, not a failure of the site.
        if (error instanceof GitHubError && error.status === 422) return null;
        throw error;
      }
    },
  };
}
