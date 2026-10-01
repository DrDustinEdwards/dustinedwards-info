// The one place a content kind and its slug become a site-api content id and back. site-api's ContentId
// is `^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$` (no colon), so the separator is a dot. Pure, so the publication
// validator can share the length rule with the registry (content-kinds.server.ts).

/** The contract's ContentId allows at most 200 characters (site-api contract.ts). */
export const CONTENT_ID_MAX = 200;

/** The kind that keeps a bare slug for its id, so every id posts already had is unchanged. */
export const DEFAULT_KIND = "post";

/** The separator between a kind and a slug. A bare id has none; a slug may itself contain it. */
const SEPARATOR = ".";

/**
 * The contract id for a kind's slug: posts keep the bare slug, every other kind is `<kind>.<slug>`.
 *
 * @param {string} kind
 * @param {string} slug
 */
export function encodeContentId(kind, slug) {
  return kind === DEFAULT_KIND ? slug : `${kind}${SEPARATOR}${slug}`;
}

/**
 * The kind and slug of a contract id. A post slug never contains the separator (SLUG_PATTERN), so an id
 * with none is a post; otherwise the kind is everything before the FIRST separator and the slug is the rest.
 *
 * @param {string} id
 * @returns {{ kind: string, slug: string }}
 */
export function decodeContentId(id) {
  const at = id.indexOf(SEPARATOR);
  if (at === -1) return { kind: DEFAULT_KIND, slug: id };
  return { kind: id.slice(0, at), slug: id.slice(at + 1) };
}

/**
 * Whether `<kind>.<slug>` fits the contract's id length, for a validator to refuse a slug that cannot.
 *
 * @param {string} kind
 * @param {string} slug
 */
export function contentIdFits(kind, slug) {
  return encodeContentId(kind, slug).length <= CONTENT_ID_MAX;
}
