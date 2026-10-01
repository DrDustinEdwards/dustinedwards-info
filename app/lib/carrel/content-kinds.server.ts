// The kind registry behind Carrel's /content group. site-api's contract has one id space and a free-form
// `kind` string on a summary, so each content kind (post, publication, page) is a handler that works in
// its own slugs, and this module is the only place that turns a slug into a contract id and back.

import { RefusedError } from "@dustinedwards/site-api";
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

/** The contract's ContentId allows at most 200 characters (site-api contract.ts). */
export const CONTENT_ID_MAX = 200;

/** The kind that keeps a bare slug for its id, so every id posts already had is unchanged. */
export const DEFAULT_KIND = "post";

/** The separator between a kind and a slug. A bare id has none; a slug may itself contain it. */
const SEPARATOR = ".";

/** The contract id for a kind's slug: posts keep the bare slug, every other kind is `<kind>.<slug>`. */
export function encodeContentId(kind: string, slug: string): string {
  return kind === DEFAULT_KIND ? slug : `${kind}${SEPARATOR}${slug}`;
}

/**
 * The kind and slug of a contract id. A post slug never contains the separator (SLUG_PATTERN), so an id
 * with none is a post; otherwise the kind is everything before the FIRST separator and the slug is the rest.
 */
export function decodeContentId(id: string): { kind: string; slug: string } {
  const at = id.indexOf(SEPARATOR);
  if (at === -1) return { kind: DEFAULT_KIND, slug: id };
  return { kind: id.slice(0, at), slug: id.slice(at + 1) };
}

/** Whether `<kind>.<slug>` fits the contract's id length, for a validator to refuse a slug that cannot. */
export function contentIdFits(kind: string, slug: string): boolean {
  return encodeContentId(kind, slug).length <= CONTENT_ID_MAX;
}

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
