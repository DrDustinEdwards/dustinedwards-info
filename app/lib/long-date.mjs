/**
 * UTC so the server render and the hydration pass produce the same text; a
 * local zone causes a hydration mismatch. Null rather than rendering "Invalid Date".
 *
 * @param {string | Date | number | null | undefined} value
 * @returns {string | null}
 */
export function longDateUTC(value) {
  if (value === null || value === undefined || value === "") return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
