// The roster kind of Carrel's /content group (docs/ROSTER.md): ids are `roster.<year>` (the registry encodes
// them), the year being the cohort's file key (content/roster/2025.md). Every write is saveRoster, the one
// path a cohort reaches the repository by, so a cohort saved through Carrel is validated by the code CI
// runs, committed, written to D1 and live on the next request with no deploy. There is no editor in the
// site's admin for this kind and no operator save tool. A cohort has no draft state: it is public when it
// is saved, so saving and publishing are the same write and unpublishing is refused.

import { RefusedError, VersionConflictError } from "@dustinedwards/site-api";
import type { ContentSummary, WriteResult } from "@dustinedwards/site-api";

import { listRosterRows } from "~/db/roster";
import type { ContentKindHandler } from "~/lib/carrel/content-kinds.server";
import { asSiteApiError } from "~/lib/carrel/errors.server";
import { GitHubError, listCommitsForPath, readFile } from "~/lib/editor/github.server";
import { ROSTER_PAGE_PATH, rosterPath } from "~/lib/roster/compile.mjs";
import { COHORT_SLUG, saveRoster } from "~/lib/roster/save.server";

type RosterEnv = Env & { GITHUB_TOKEN?: string };

/** A revision's version is a commit sha; an item's own version is the blob sha of its file. */
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

/** The title Carrel shows: the cohort's year, which is all a cohort is named. */
const titleOf = (slug: string) => `${slug} cohort`;

export function rosterHandler(env: RosterEnv): ContentKindHandler {
  /** One write through saveRoster as the Carrel actor, answered in the package's terms. */
  async function write(slug: string, changeId: string, raw: string, expectedVersion: string | null): Promise<WriteResult> {
    try {
      const saved = await saveRoster(env, {
        slug,
        raw,
        expectedBlobSha: expectedVersion ?? undefined,
        isNew: expectedVersion === null,
        actor: { kind: "carrel", changeId },
      });
      return { id: slug, version: saved.sourceBlobSha, status: "published", changeId };
    } catch (error) {
      // A RosterInvalid carries every message the validator gave; asSiteApiError passes them on.
      return asSiteApiError(env, error, rosterPath(slug));
    }
  }

  /** A slug that is not a year owns no file, so a read of it is a missing id and never a path to read. */
  const owns = (slug: string) => COHORT_SLUG.test(slug);

  return {
    kind: "roster",

    async list(query) {
      const needle = query.q?.toLowerCase();
      const summaries: ContentSummary[] = (await listRosterRows(env)).map((row) => ({
        id: row.slug,
        kind: "roster",
        title: titleOf(row.slug),
        status: "published",
        // A cohort has no page of its own: it is listed on the program page, under its heading.
        path: `${ROSTER_PAGE_PATH}#year-${row.year}`,
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
      const file = await readFile(env, rosterPath(slug));
      if (!file) return null;
      const row = await env.DB.prepare(`SELECT synced_at FROM roster WHERE slug = ?1`).bind(slug).first<{ synced_at: number }>();
      return {
        id: slug,
        kind: "roster",
        title: titleOf(slug),
        status: "published",
        path: `${ROSTER_PAGE_PATH}#year-${slug}`,
        publishAt: null,
        publishedAt: null,
        updatedAt: row ? new Date(row.synced_at * 1000).toISOString() : null,
        format: "markdown",
        source: file.content,
        version: file.sha,
      };
    },

    // Creates a cohort (no version) or edits one (its version), as every kind does; either way it is public.
    async saveDraft(slug, input) {
      if (!owns(slug)) throw new RefusedError(`"${slug}" is not a cohort file key; a cohort is named for its year, such as 2025.`);
      const file = await readFile(env, rosterPath(slug));
      if (input.expectedVersion === null && file) throw new VersionConflictError(file.sha);
      if (input.expectedVersion !== null && !file) throw new VersionConflictError(null);
      return write(slug, input.changeId, input.source, input.expectedVersion);
    },

    async publish(slug, input) {
      if (!owns(slug)) throw new RefusedError(`"${slug}" is not a cohort file key; a cohort is named for its year, such as 2025.`);
      // Read even when source is sent: a version for an id that does not exist is a conflict.
      const file = await readFile(env, rosterPath(slug));
      if (!file) throw new VersionConflictError(null);
      return write(slug, input.changeId, input.source ?? file.content, input.expectedVersion);
    },

    async unpublish() {
      throw new RefusedError(
        "A roster cohort has no draft state, so it cannot be unpublished. To remove a cohort, delete its file " +
          "from content/roster/ in a commit; the next content sync removes its row.",
      );
    },

    async revisions(slug) {
      if (!owns(slug) || !(await readFile(env, rosterPath(slug)))) return null;
      const commits = await listCommitsForPath(env, rosterPath(slug), 50);
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
        return (await readFile(env, rosterPath(slug), version))?.content ?? null;
      } catch (error) {
        // An unknown ref is a missing version, not a failure of the site.
        if (error instanceof GitHubError && error.status === 422) return null;
        throw error;
      }
    },
  };
}
