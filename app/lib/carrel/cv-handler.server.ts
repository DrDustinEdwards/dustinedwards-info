// The "cv" kind of Carrel's content group (docs/CV.md): the files in content/cv/. The id is `cv.<slug>`, the slug
// being the file's name (`cv.grants` for content/cv/grants.md, `cv.profile` for the edition and the person).
// Every write is saveCvFile, the one CV save, so a file saved through Carrel is validated by the code CI runs,
// committed, written to D1 and live on the next request with no deploy. A file cannot be created here: the set
// of files is structure and lives in CV_FILES, so an id no file names is refused. The CV has no draft state, so
// it cannot be unpublished.

import { RefusedError, VersionConflictError } from "@dustinedwards/site-api";
import type { ContentSummary, WriteResult } from "@dustinedwards/site-api";

import { listCvRows } from "~/db/cv";
import type { ContentKindHandler } from "~/lib/carrel/content-kinds.server";
import { asSiteApiError } from "~/lib/carrel/errors.server";
import { CV_PAGE } from "~/lib/cv/entries.mjs";
import { CV_DIR, CV_FILES, cvFileFor, cvSourcePath } from "~/lib/cv/parse.mjs";
import { saveCvFile } from "~/lib/cv/save.server";
import { TYPES } from "~/lib/cv/view.mjs";
import { GitHubError, listCommitsForPath, readFile } from "~/lib/editor/github.server";
import { currentHead } from "~/lib/editor/publish.server";

type CvEnv = Env & { GITHUB_TOKEN?: string };

/** A version is a commit sha: the repository's head for a write, any commit for a revision. */
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

/** The name a list shows for a file: the section's plural as the CV prints it. */
function titleOf(slug: string) {
  const type = cvFileFor(slug)?.type;
  const plural = TYPES.find(([id]) => id === type)?.[2];
  return `${CV_PAGE.title}: ${type === "profile" ? "Profile" : (plural ?? slug)}`;
}

export function cvHandler(env: CvEnv): ContentKindHandler {
  /** The file of a registered slug, or null: an id no file names owns nothing. */
  function registered(slug: string) {
    return cvFileFor(slug) ? cvSourcePath(slug) : null;
  }

  /** The same, for a write: a missing registration is a refusal that says why. */
  function target(slug: string) {
    const found = registered(slug);
    if (!found) {
      throw new RefusedError(
        `"${slug}" names no CV file. A save cannot create one: the set of files is CV_FILES ` +
          `(app/lib/cv/parse.mjs). The files are ${CV_FILES.map((f) => f.slug).join(", ")}, in ${CV_DIR}/.`,
      );
    }
    return found;
  }

  /** One write through saveCvFile as the Carrel actor, answered in the package's terms. */
  async function write(slug: string, changeId: string, raw: string, expectedVersion: string | null): Promise<WriteResult> {
    target(slug);
    try {
      const saved = await saveCvFile(env, { slug, raw, expectedHeadSha: expectedVersion, actor: { kind: "carrel", changeId } });
      return { id: slug, version: saved.commitSha, status: "published", changeId };
    } catch (error) {
      // A CvInvalid carries every message the validator gave; asSiteApiError passes them on.
      return asSiteApiError(env, error);
    }
  }

  /** The stored file for a write that names a version; a version for a missing file is a conflict. */
  async function existing(slug: string): Promise<string> {
    const file = await readFile(env, target(slug));
    if (!file) throw new VersionConflictError(null);
    return file.content;
  }

  return {
    kind: "cv",

    async list(query) {
      const needle = query.q?.toLowerCase();
      const summaries: ContentSummary[] = (await listCvRows(env)).map((row) => ({
        id: row.slug,
        kind: "cv",
        title: titleOf(row.slug),
        status: "published",
        path: CV_PAGE.path,
        publishAt: null,
        publishedAt: null,
        updatedAt: row.syncedAt.toISOString(),
      }));
      return summaries
        .filter((s) => !query.status || s.status === query.status)
        .filter((s) => !needle || s.title.toLowerCase().includes(needle) || s.id.includes(needle));
    },

    async get(slug) {
      const found = registered(slug);
      if (!found) return null;
      const file = await readFile(env, found);
      if (!file) return null;
      const [version, row] = await Promise.all([
        currentHead(env),
        env.DB.prepare(`SELECT synced_at FROM cv WHERE slug = ?1`).bind(slug).first<{ synced_at: number }>(),
      ]);
      return {
        id: slug,
        kind: "cv",
        title: titleOf(slug),
        status: "published",
        path: CV_PAGE.path,
        publishAt: null,
        publishedAt: null,
        updatedAt: row ? new Date(row.synced_at * 1000).toISOString() : null,
        format: "markdown",
        source: file.content,
        version,
      };
    },

    // A file always exists, so a save that names no version is a conflict, as a page's is.
    async saveDraft(slug, input) {
      const found = target(slug);
      const file = await readFile(env, found);
      if (input.expectedVersion === null && file) throw new VersionConflictError(await currentHead(env));
      if (input.expectedVersion !== null && !file) throw new VersionConflictError(null);
      if (!file) throw new RefusedError(`The file ${found} is missing from the repository, so it cannot be saved.`);
      return write(slug, input.changeId, input.source, input.expectedVersion);
    },

    async publish(slug, input) {
      const stored = await existing(slug);
      return write(slug, input.changeId, input.source ?? stored, input.expectedVersion);
    },

    async unpublish() {
      throw new RefusedError("The CV has no draft state, so it cannot be unpublished. Edit the file, or remove an entry.");
    },

    async revisions(slug) {
      const found = registered(slug);
      if (!found || !(await readFile(env, found))) return null;
      const commits = await listCommitsForPath(env, found, 50);
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
        return (await readFile(env, found, version))?.content ?? null;
      } catch (error) {
        // An unknown ref is a missing version, not a failure of the site.
        if (error instanceof GitHubError && error.status === 422) return null;
        throw error;
      }
    },
  };
}
