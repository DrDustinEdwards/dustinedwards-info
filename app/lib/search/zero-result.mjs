/**
 * What a zero-result query is normalized to before it is stored, and what is refused outright.
 *
 * `.mjs` so `node --test` imports the same function the Worker does. This is the privacy boundary
 * of the whole feature: everything the table will ever contain passes through here, so it is the
 * one place worth testing exhaustively.
 *
 * REFUSAL IS THE DEFAULT FOR ANYTHING THAT LOOKS PERSONAL. The ruling is query text only, and a
 * query is not always only a query: readers paste their own email address into search boxes, and
 * somebody searching a person's full name has told us about that person rather than about a gap in
 * the writing. Both are dropped. The cost of dropping a legitimate query is one missing row in a
 * demand list; the cost of keeping a personal one is a personal record in a database that exists
 * to be read by a human later.
 *
 * @see test/zero-result.test.mjs
 */

/** Matches the CHECK constraint in drizzle/0015_zero_result_queries.sql. */
export const ZERO_RESULT_MAX_LENGTH = 200;

/**
 * The retention window, in seconds. Ninety days.
 *
 * HERE RATHER THAN BESIDE THE SWEEP, because the admin button's label is derived from it and a
 * component reading a `.server` module pulls that module into the client bundle: React Router
 * strips server code from `loader`, `action`, `middleware` and `headers`, and a module-scope
 * constant used in JSX is none of those. Same shape as the prompt that nearly shipped in ask.js.
 *
 * One owner, so a button promising ninety days cannot sit beside a sweep using another number.
 */
export const ZERO_RESULT_RETENTION_SECONDS = 90 * 24 * 60 * 60;

/** Below this a query is a fragment, not a question, and every site gets thousands of them. */
const MIN_LENGTH = 3;

/**
 * Anything with an `@` between two runs of non-space is an address shape. Deliberately WIDER than
 * a correct email pattern: this is a refusal, so over-matching costs a row and under-matching
 * stores an address.
 */
const ADDRESS_SHAPE = /\S+@\S+/;

/** A bare phone-shaped run of digits, spaces, dashes and parentheses. */
const PHONE_SHAPE = /(?:\+?\d[\d\s().-]{6,}\d)/;

/**
 * TWO OR MORE CAPITALISED WORDS IN A ROW, which is the shape of a person's name.
 *
 * It over-matches on purpose and the over-matches are cheap: "Cloudflare Workers" and "Source
 * Serif" are dropped too. That is a lost row in a demand list. The alternative, a name list, would
 * be both incomplete and a list of people's names living in the repository.
 *
 * It does not fire on a normal sentence-case query, because the second word is not capitalized.
 */
const NAME_SHAPE = /\b[A-Z][a-z]+\s+[A-Z][a-z]+/;

/**
 * Normalize a query for storage, or return null to refuse it.
 *
 * LOWERCASED AND COLLAPSED, so "D1  Backups" and "d1 backups" are one gap rather than two rows.
 * The case tests above run on the RAW input, before lowercasing, because lowercasing destroys the
 * only signal `NAME_SHAPE` has.
 *
 * @param {string} raw
 * @returns {string | null} the value to store, or null when it must not be stored
 */
export function normaliseZeroResultQuery(raw) {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (trimmed.length < MIN_LENGTH) return null;
  /*
   * REFUSED, NOT TRUNCATED. Truncating to the cap would store the first 200 characters of whatever
   * somebody pasted, which is the same problem in a shorter field.
   */
  if (trimmed.length > ZERO_RESULT_MAX_LENGTH) return null;

  if (ADDRESS_SHAPE.test(trimmed)) return null;
  if (PHONE_SHAPE.test(trimmed)) return null;
  if (NAME_SHAPE.test(trimmed)) return null;

  const normalised = trimmed.toLowerCase().replace(/\s+/g, " ");
  /* A query of only punctuation normalizes to something with no letters or digits in it. */
  if (!/[\p{L}\p{N}]/u.test(normalised)) return null;

  return normalised;
}
