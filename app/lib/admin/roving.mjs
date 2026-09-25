/**
 * The key map of a roving tabindex (APG toolbar, radio group and menu patterns): which item an arrow,
 * Home or End moves to. Pure, so a node test can hold it; the components own focus and state.
 *
 * `axis` is the arrows that move: "horizontal" for a toolbar or radio row, "vertical" for a list.
 * Movement wraps, as the APG toolbar and radio group examples do.
 *
 * @param {string} key a KeyboardEvent `key`
 * @param {number} at the index that has focus now
 * @param {number} count how many items there are
 * @param {"horizontal" | "vertical"} [axis]
 * @returns {number | null} the index to move to, or null when the key is not a movement key
 */
export function rovingTarget(key, at, count, axis = "horizontal") {
  if (count <= 0) return null;
  const forward = axis === "horizontal" ? "ArrowRight" : "ArrowDown";
  const back = axis === "horizontal" ? "ArrowLeft" : "ArrowUp";
  if (key === forward) return (at + 1) % count;
  if (key === back) return (at - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
