// The kind registry behind Carrel's /content group. site-api's contract has one id space and a free-form
// `kind` string on a summary, so each content kind (post, publication, page, cv) is a handler that works in
// its own slugs, and this module is the only place that turns a slug into a contract id and back.

import { NotFoundError, RefusedError } from "@dustinedwards/site-api";
import type {
  ContentAdapter,
  ContentDoc,
  ContentSummary,
  ListQuery,
  PreviewInput,
  PublishInput,
  Revision,
  SaveDraftInput,
  ScheduleInput,
  UnpublishInput,
  WriteResult,
} from "@dustinedwards/site-api";

import { DEFAULT_KIND, decodeContentId, encodeContentId } from "./content-id.mjs";

/**
 * One kind's side of the content group. Every id a handler takes or returns is its own slug; the
 * registry encodes it on the way out.
 */
export interface ContentKindHandler {
  kind: string;
  /** Every item of the kind matching q and status; the registry merges kinds and pages the result. */
  list(query: Pick<ListQuery, "q" | "status">): Promise<ContentSummary[]>;
  get(slug: string): Promise<ContentDoc | null>;
  saveDraft(slug: string, input: SaveDraftInput): Promise<WriteResult>;
  publish(slug: string, input: PublishInput): Promise<WriteResult>;
  schedule?(slug: string, input: ScheduleInput): Promise<WriteResult>;
  unpublish(slug: string, input: UnpublishInput): Promise<WriteResult>;
  revisions(slug: string): Promise<Revision[] | null>;
  revisionSource(slug: string, version: string): Promise<string | null>;
  /**
   * Deletes the item and whatever must follow it as one unit (v0.3.0). Throws NotFoundError for a missing
   * item, VersionConflictError for a stale version and RefusedError when the site's rules refuse. A kind
   * without it cannot be deleted from Carrel.
   */
  delete?(slug: string, input: { expectedVersion: string; changeId: string }): Promise<void>;
  /** The page the item would publish; `slug` is null for an unsaved new item. */
  preview?(slug: string | null, input: PreviewInput): Promise<string>;
}

export type ContentRegistry = {
  adapter: ContentAdapter;
  render(input: PreviewInput): Promise<string>;
};

export function contentRegistry(handlers: ContentKindHandler[]): ContentRegistry {
  const byKind = new Map(handlers.map((h) => [h.kind, h]));
  if (byKind.size !== handlers.length) throw new Error("two content kind handlers share a kind");

  /** The handler and slug for an id, or null when no registered kind owns it. */
  const route = (id: string) => {
    const { kind, slug } = decodeContentId(id);
    const handler = byKind.get(kind);
    return handler ? { handler, slug } : null;
  };

  const encoded = <T extends { id: string }>(kind: string, value: T): T => ({
    ...value,
    id: encodeContentId(kind, value.id),
  });

  /** A write for an id no kind owns is a missing id, which the contract answers as a null version. */
  const owner = (id: string) => {
    const found = route(id);
    if (!found) throw new RefusedError(`No content kind owns the id ${id}.`);
    return found;
  };

  const adapter: ContentAdapter = {
    async list(query) {
      const lists = await Promise.all(
        handlers.map(async (h) =>
          (await h.list({ q: query.q, status: query.status })).map((s) => encoded(h.kind, s)),
        ),
      );
      const matching = lists.flat();
      const start = query.cursor && /^\d+$/.test(query.cursor) ? Number(query.cursor) : 0;
      const end = start + query.limit;
      return {
        items: matching.slice(start, end),
        nextCursor: end < matching.length ? String(end) : null,
      };
    },

    async get(id) {
      const found = route(id);
      if (!found) return null;
      const doc = await found.handler.get(found.slug);
      return doc ? encoded(found.handler.kind, doc) : null;
    },

    async saveDraft(id, input) {
      const { handler, slug } = owner(id);
      return encoded(handler.kind, await handler.saveDraft(slug, input));
    },

    async publish(id, input) {
      const { handler, slug } = owner(id);
      return encoded(handler.kind, await handler.publish(slug, input));
    },

    async schedule(id, input) {
      const { handler, slug } = owner(id);
      if (!handler.schedule) throw new RefusedError(`A ${handler.kind} cannot be scheduled; publish it now.`);
      return encoded(handler.kind, await handler.schedule(slug, input));
    },

    async unpublish(id, input) {
      const { handler, slug } = owner(id);
      return encoded(handler.kind, await handler.unpublish(slug, input));
    },

    async revisions(id) {
      const found = route(id);
      return found ? found.handler.revisions(found.slug) : null;
    },

    async revisionSource(id, version) {
      const found = route(id);
      return found ? found.handler.revisionSource(found.slug, version) : null;
    },

    async delete(id, input) {
      const found = route(id);
      if (!found) throw new NotFoundError(`No content kind owns the id ${id}.`);
      if (!found.handler.delete) {
        throw new RefusedError(`A ${found.handler.kind} cannot be deleted from Carrel.`);
      }
      await found.handler.delete(found.slug, input);
    },
  };

  return {
    adapter,
    async render(input) {
      // No id is a new, unsaved item, and only a post can be previewed without one.
      const found = input.id === undefined ? null : route(input.id);
      const target = input.id === undefined ? byKind.get(DEFAULT_KIND) : found?.handler;
      if (!target?.preview) throw new RefusedError("This kind of content has no preview.");
      return target.preview(found ? found.slug : null, input);
    },
  };
}
