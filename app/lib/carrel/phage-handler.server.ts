// The phage kind of Carrel's /content group (docs/PHAGES.md): ids are `phage.<slug>` (the registry encodes
// them), the slug being the phage's name in lower case (content/phages/acorn15.md). Every write is savePhage,
// the one path a phage reaches the repository by, so a phage saved through Carrel is validated by the code CI
// runs, committed, written to D1, drawn into /research/phages and live on the next request with no deploy.
// There is no editor in the site's admin for this kind and no operator save tool. A phage has no draft state:
// it is public when it is saved, so saving and publishing are the same write and unpublishing is refused.

import { RefusedError, VersionConflictError } from "@dustinedwards/site-api";
import type { ContentSummary, WriteResult } from "@dustinedwards/site-api";

import { listPhageRows } from "~/db/phages";
import type { ContentKindHandler } from "~/lib/carrel/content-kinds.server";
import { asSiteApiError } from "~/lib/carrel/errors.server";
import { GitHubError, listCommitsForPath, readFile } from "~/lib/editor/github.server";
import { PHAGES_PAGE_PATH, phagePath } from "~/lib/phages/compile.mjs";
import { PHAGE_SLUG, savePhage } from "~/lib/phages/save.server";

type PhageEnv = Env & { GITHUB_TOKEN?: string };

/** A revision's version is a commit sha; an item's own version is the blob sha of its file. */
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

export function phageHandler(env: PhageEnv): ContentKindHandler {
  /** One write through savePhage as the Carrel actor, answered in the package's terms. */
  async function write(slug: string, changeId: string, raw: string, expectedVersion: string | null): Promise<WriteResult> {
    try {
      const saved = await savePhage(env, {
        slug,
        raw,
        expectedBlobSha: expectedVersion ?? undefined,
        isNew: expectedVersion === null,
        actor: { kind: "carrel", changeId },
      });
      return { id: slug, version: saved.sourceBlobSha, status: "published", changeId };
    } catch (error) {
      // A PhageInvalid carries every message the validator gave; asSiteApiError passes them on.
      return asSiteApiError(env, error, phagePath(slug));
    }
  }

  /** A slug that is not a lower-case name owns no file, so a read of it is a missing id and never a path to read. */
  const owns = (slug: string) => PHAGE_SLUG.test(slug);

  return {
    kind: "phage",

    async list(query) {
      const needle = query.q?.toLowerCase();
      const summaries: ContentSummary[] = (await listPhageRows(env)).map((row) => ({
        id: row.slug,
        kind: "phage",
        title: row.name,
        status: "published",
        // A phage has no page of its own: it is a row of the table, and a section, on the phages page.
        path: `${PHAGES_PAGE_PATH}#${row.slug}`,
        publishAt: null,
        publishedAt: null,
        updatedAt: row.syncedAt.toISOString(),
      }));
      return summaries
        .filter((s) => !query.status || s.status === query.status)
        .filter((s) => !needle || s.title.toLowerCase().includes(needle) || s.id.includes(needle));
    },

    async get(slug) {
      if (!owns(slug)) return null;
      const file = await readFile(env, phagePath(slug));
      if (!file) return null;
      const row = await env.DB.prepare(`SELECT name, synced_at FROM phages WHERE slug = ?1`).bind(slug).first<{ name: string; synced_at: number }>();
      return {
        id: slug,
        kind: "phage",
        title: row?.name ?? slug,
        status: "published",
        path: `${PHAGES_PAGE_PATH}#${slug}`,
        publishAt: null,
        publishedAt: null,
        updatedAt: row ? new Date(row.synced_at * 1000).toISOString() : null,
        format: "markdown",
        source: file.content,
        version: file.sha,
      };
    },

    // Creates a phage (no version) or edits one (its version), as every kind does; either way it is public.
    async saveDraft(slug, input) {
      if (!owns(slug)) throw new RefusedError(`"${slug}" is not a phage file key; a phage is named for its name in lower case, such as acorn15.`);
      const file = await readFile(env, phagePath(slug));
      if (input.expectedVersion === null && file) throw new VersionConflictError(file.sha);
      if (input.expectedVersion !== null && !file) throw new VersionConflictError(null);
      return write(slug, input.changeId, input.source, input.expectedVersion);
    },

    async publish(slug, input) {
      if (!owns(slug)) throw new RefusedError(`"${slug}" is not a phage file key; a phage is named for its name in lower case, such as acorn15.`);
      // Read even when source is sent: a version for an id that does not exist is a conflict.
      const file = await readFile(env, phagePath(slug));
      if (!file) throw new VersionConflictError(null);
      return write(slug, input.changeId, input.source ?? file.content, input.expectedVersion);
    },

    async unpublish() {
      throw new RefusedError(
        "A phage has no draft state, so it cannot be unpublished. To remove a phage, delete its file from " +
          "content/phages/ in a commit; the next content sync removes its row and redraws the table.",
      );
    },

    async revisions(slug) {
      if (!owns(slug) || !(await readFile(env, phagePath(slug)))) return null;
      const commits = await listCommitsForPath(env, phagePath(slug), 50);
      return commits.map((c) => ({
        version: c.sha,
        at: new Date(c.date).toISOString(),
        author: c.author.slice(0, 200),
        message: c.message.slice(0, 2000),
      }));
    },

    async revisionSource(slug, version) {
      if (!owns(slug) || !COMMIT_SHA.test(version)) return null;
      try {
        return (await readFile(env, phagePath(slug), version))?.content ?? null;
      } catch (error) {
        // An unknown ref is a missing version, not a failure of the site.
        if (error instanceof GitHubError && error.status === 422) return null;
        throw error;
      }
    },
  };
}
