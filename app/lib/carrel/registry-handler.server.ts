// The registry kinds of Carrel's /content group (docs/REGISTRY.md): one handler per kind in KINDS (primer, strain,
// reagent, equipment as they arrive), so Carrel lists and edits each as its own kind. An id is `<kind>.<id>` (the
// registry encodes it), the id being the item's own, such as `primer.m13-forward`, and the file
// content/registry/<kind>/<id>.md. Every write is saveRegistryItem, the one path an item reaches the repository by, so
// an item saved through Carrel is validated by the code CI runs, committed, written to D1 and live on the next request
// with no deploy. An item has a draft state (a `draft: true` flag, as a page does): saving keeps it, publishing and
// unpublishing set it.
//
// With no kind defined the list is empty and no handler is registered; a kind added to KINDS is served here with no
// change to this file.

import { RefusedError, VersionConflictError } from "@dustinedwards/site-api";
import type { ContentStatus, ContentSummary, WriteResult } from "@dustinedwards/site-api";
import matter from "gray-matter";

import { listRegistryRows } from "~/db/registry";
import type { ContentKindHandler } from "~/lib/carrel/content-kinds.server";
import { asSiteApiError } from "~/lib/carrel/errors.server";
import { withPublication } from "~/lib/carrel/front-matter-lines";
import { GitHubError, listCommitsForPath, readFile } from "~/lib/editor/github.server";
import { ID_PATTERN, registryPath, registrySlug } from "~/kb/registry/compile.mjs";
import { KINDS, type KindSpec } from "~/kb/registry/kinds.mjs";
import { saveRegistryItem } from "~/kb/registry/save.server";

type RegistryEnv = Env & { GITHUB_TOKEN?: string };

/** A revision's version is a commit sha; an item's own version is the blob sha of its file. */
const COMMIT_SHA = /^[0-9a-f]{7,40}$/i;

const isDraft = (raw: string) => matter(raw, {}).data.draft === true;
const statusOf = (raw: string): ContentStatus => (isDraft(raw) ? "draft" : "published");

/** One handler per kind. `kinds` is the registry's own unless a test brings its own. */
export function registryHandlers(env: RegistryEnv, kinds: Readonly<Record<string, KindSpec>> = KINDS): ContentKindHandler[] {
  return Object.keys(kinds).map((kind) => registryHandler(env, kind, kinds));
}

function registryHandler(env: RegistryEnv, kind: string, kinds: Readonly<Record<string, KindSpec>>): ContentKindHandler {
  const noun = kinds[kind]?.singular ?? kind;

  /** An id that is not an item's own shape owns no file, so a read of it is a missing id and never a path to read. */
  const owns = (id: string) => ID_PATTERN.test(id);
  const slugOf = (id: string) => registrySlug(kind, id);
  const fileOf = (id: string) => registryPath(slugOf(id));

  /** One write through saveRegistryItem as the Carrel actor, answered in the package's terms. */
  async function write(id: string, changeId: string, raw: string, expectedVersion: string | null): Promise<WriteResult> {
    try {
      const saved = await saveRegistryItem(env, {
        slug: slugOf(id),
        raw,
        expectedBlobSha: expectedVersion ?? undefined,
        isNew: expectedVersion === null,
        actor: { kind: "carrel", changeId },
        kinds,
      });
      return { id, version: saved.sourceBlobSha, status: statusOf(raw), changeId };
    } catch (error) {
      // A RegistryInvalid carries every message the validator gave; asSiteApiError passes them on.
      return asSiteApiError(env, error, fileOf(id));
    }
  }

  function target(id: string) {
    if (!owns(id)) throw new RefusedError(`"${id}" is not a ${noun} id; it is lower-case letters, digits and hyphens, such as m13-forward.`);
    return fileOf(id);
  }

  /** The stored file for a write that names a version; a version for a missing file is a conflict. */
  async function existing(id: string): Promise<string> {
    const file = await readFile(env, target(id));
    if (!file) throw new VersionConflictError(null);
    return file.content;
  }

  /** The source with its draft flag set to `draft`, touching no line when it already says so. */
  const withDraft = (raw: string, draft: boolean) => (isDraft(raw) === draft ? raw : withPublication(raw, { draft }));

  return {
    kind,

    async list(query) {
      const needle = query.q?.toLowerCase();
      const summaries: ContentSummary[] = (await listRegistryRows(env))
        .filter((row) => row.kind === kind)
        .map((row) => ({
          id: row.id,
          kind,
          title: row.name,
          status: row.status as ContentStatus,
          // No page draws an item yet; the pages arrive with the kinds' own changes.
          path: null,
          publishAt: null,
          publishedAt: null,
          updatedAt: row.syncedAt.toISOString(),
        }));
      return summaries
        .filter((s) => !query.status || s.status === query.status)
        .filter((s) => !needle || s.title.toLowerCase().includes(needle) || s.id.includes(needle));
    },

    async get(id) {
      if (!owns(id)) return null;
      const file = await readFile(env, fileOf(id));
      if (!file) return null;
      const row = await env.DB.prepare(`SELECT name, synced_at FROM registry WHERE kind = ?1 AND id = ?2`)
        .bind(kind, id)
        .first<{ name: string; synced_at: number }>();
      return {
        id,
        kind,
        title: row?.name ?? id,
        status: statusOf(file.content),
        path: null,
        publishAt: null,
        publishedAt: null,
        updatedAt: row ? new Date(row.synced_at * 1000).toISOString() : null,
        format: "markdown",
        source: file.content,
        version: file.sha,
      };
    },

    // Creates an item (no version) or edits one (its version), keeping its status as a page does.
    async saveDraft(id, input) {
      const file = await readFile(env, target(id));
      if (input.expectedVersion === null && file) throw new VersionConflictError(file.sha);
      if (input.expectedVersion !== null && !file) throw new VersionConflictError(null);
      return write(id, input.changeId, input.source, input.expectedVersion);
    },

    async publish(id, input) {
      const stored = await existing(id);
      return write(id, input.changeId, withDraft(input.source ?? stored, false), input.expectedVersion);
    },

    async unpublish(id, input) {
      const stored = await existing(id);
      return write(id, input.changeId, withDraft(stored, true), input.expectedVersion);
    },

    async revisions(id) {
      if (!owns(id) || !(await readFile(env, fileOf(id)))) return null;
      const commits = await listCommitsForPath(env, fileOf(id), 50);
      return commits.map((c) => ({
        version: c.sha,
        at: new Date(c.date).toISOString(),
        author: c.author.slice(0, 200),
        message: c.message.slice(0, 2000),
      }));
    },

    async revisionSource(id, version) {
      if (!owns(id) || !COMMIT_SHA.test(version)) return null;
      try {
        return (await readFile(env, fileOf(id), version))?.content ?? null;
      } catch (error) {
        // An unknown ref is a missing version, not a failure of the site.
        if (error instanceof GitHubError && error.status === 422) return null;
        throw error;
      }
    },
  };
}
