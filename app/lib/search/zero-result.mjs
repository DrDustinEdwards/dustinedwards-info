// The privacy boundary: everything the table stores passes through here, and anything that looks
// personal is refused. A dropped legitimate query costs one row; a kept personal one is a record.

/** Matches the CHECK constraint in drizzle/0015_zero_result_queries.sql. */
export const ZERO_RESULT_MAX_LENGTH = 200;

/** Here, not beside the sweep: the admin label derives from it, and a .server import in JSX reaches the client bundle. */
export const ZERO_RESULT_RETENTION_SECONDS = 90 * 24 * 60 * 60;

/** Below this a query is a fragment, not a question, and every site gets thousands of them. */
const MIN_LENGTH = 3;

/** Wider than a real email pattern on purpose: over-matching costs a row, under-matching stores an address. */
const ADDRESS_SHAPE = /\S+@\S+/;

const PHONE_SHAPE = /(?:\+?\d[\d\s().-]{6,}\d)/;

/** A person's name shape. Over-matches ("Cloudflare Workers") on purpose; a name list would hold names. */
const NAME_SHAPE = /\b[A-Z][a-z]+\s+[A-Z][a-z]+/;

/**
 * The shape tests run on the RAW input, since lowercasing destroys the only signal NAME_SHAPE has.
 *
 * @param {string} raw
 * @returns {string | null} the value to store, or null when it must not be stored
 */
export function normaliseZeroResultQuery(raw) {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (trimmed.length < MIN_LENGTH) return null;
  // Refused, not truncated: a truncated paste is the same problem in a shorter field.
  if (trimmed.length > ZERO_RESULT_MAX_LENGTH) return null;

  if (ADDRESS_SHAPE.test(trimmed)) return null;
  if (PHONE_SHAPE.test(trimmed)) return null;
  if (NAME_SHAPE.test(trimmed)) return null;

  const normalised = trimmed.toLowerCase().replace(/\s+/g, " ");
  if (!/[\p{L}\p{N}]/u.test(normalised)) return null;

  return normalised;
}
