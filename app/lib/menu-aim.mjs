/*
 * The safe triangle for the header's hover menus (app/enhance/header.ts). A card hangs below the
 * header, so a pointer heading for it from its word may cross another word on the way. It is heading
 * for the card when its newest point lies inside the triangle whose apex is an earlier point and whose
 * base is the card's top edge. Pure, so test/menu-aim.test.mjs can reach it without a browser.
 */

/**
 * @typedef {{ x: number, y: number }} Point
 * @typedef {{ left: number, right: number, top: number }} CardTop
 */

/**
 * Whether `p` lies inside the triangle `a b c`, edges included: on the same side of all three edges.
 *
 * @param {Point} p
 * @param {Point} a
 * @param {Point} b
 * @param {Point} c
 */
export function inTriangle(p, a, b, c) {
  /** @param {Point} u @param {Point} v */
  const side = (u, v) => (v.x - u.x) * (p.y - u.y) - (v.y - u.y) * (p.x - u.x);
  const [ab, bc, ca] = [side(a, b), side(b, c), side(c, a)];
  return (ab >= 0 && bc >= 0 && ca >= 0) || (ab <= 0 && bc <= 0 && ca <= 0);
}

/**
 * Whether a pointer that moved from `from` to `to` is heading for the card: it moved, and `to` lies
 * inside the triangle from `from` to the card's top-left and top-right corners. A pointer that has not
 * moved is not heading anywhere, and one moving along the header, level or upward, is outside it.
 *
 * @param {Point} from
 * @param {Point} to
 * @param {CardTop} card
 */
export function aimsAt(from, to, card) {
  if (from.x === to.x && from.y === to.y) return false;
  return inTriangle(to, from, { x: card.left, y: card.top }, { x: card.right, y: card.top });
}
