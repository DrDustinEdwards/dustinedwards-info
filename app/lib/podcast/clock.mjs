// On its own, without the feed parser, because the player's enhancement bundle imports it.

/**
 * A duration as a clock: `m:ss`, or `h:mm:ss` from an hour. A missing or unreadable length (NaN,
 * which an audio element reports before its metadata loads) reads as 0:00.
 *
 * @param {number} seconds
 */
export function clockTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${rest}` : `${m}:${rest}`;
}
