/**
 * The media grid's arrow-key geometry, pure so it can be tested without a DOM. Rows come from
 * rendered boxes, not a column model: the browser decides the column count, and a second layout
 * engine would disagree with it at the widths nobody tested.
 */

/** @typedef {{ id: string, top: number, left: number, width: number }} TileBox */
/** @typedef {{ top: number, items: Array<{ id: string, mid: number }> }} Band */
/** @typedef {"left" | "right" | "up" | "down"} Direction */

/**
 * Visual rows, from the rendered boxes. Tiles within 6px share a row. A box with no width is not
 * laid out (a hidden tile) and joins no row.
 *
 * @param {Iterable<TileBox>} boxes
 * @returns {Band[]}
 */
export function bands(boxes) {
  /** @type {Band[]} */
  const out = [];
  for (const r of boxes) {
    if (!r.width) continue;
    const entry = { id: r.id, mid: r.left + r.width / 2 };
    const band = out.find((b) => Math.abs(b.top - r.top) < 6);
    if (band) band.items.push(entry);
    else out.push({ top: r.top, items: [entry] });
  }
  out.sort((a, b) => a.top - b.top);
  for (const b of out) b.items.sort((x, y) => x.mid - y.mid);
  return out;
}

/**
 * The tile an arrow key moves to, or null to stay put. With nothing active, or an active id that is
 * no longer on the page, the first tile. Left and right wrap across rows in reading order; up and
 * down take the nearest tile by centre in the next row, and stop at the edges.
 *
 * @param {Band[]} rows
 * @param {string} active
 * @param {Direction} dir
 * @returns {string | null}
 */
export function nextTile(rows, active, dir) {
  const flat = rows.flatMap((b) => b.items.map((i) => i.id));
  const firstId = flat[0];
  if (firstId === undefined) return null;
  if (!active) return firstId;

  let ri = -1;
  let ci = -1;
  rows.forEach((b, i) =>
    b.items.forEach((it, j) => {
      if (it.id === active) {
        ri = i;
        ci = j;
      }
    }),
  );
  if (ri < 0) return firstId;
  const row = rows[ri];
  const current = row?.items[ci];
  if (!row || !current) return null;
  if (dir === "left" || dir === "right") {
    const next = row.items[ci + (dir === "right" ? 1 : -1)];
    if (next) return next.id;
    const k = flat.indexOf(active) + (dir === "right" ? 1 : -1);
    return flat[k] || null;
  }
  const band = rows[ri + (dir === "down" ? 1 : -1)];
  if (!band) return null;
  const mid = current.mid;
  let best = band.items[0];
  if (!best) return null;
  let bestD = Infinity;
  for (const it of band.items) {
    const d = Math.abs(it.mid - mid);
    if (d < bestD) {
      bestD = d;
      best = it;
    }
  }
  return best.id;
}

/**
 * Which tile's controls are in the tab order: the one last focused, else the one the inspector is
 * open on, else the first. One tile only, so Tab crosses the whole grid in that tile's few controls.
 *
 * @param {string[]} visible the keys on this page, in document order
 * @param {string} active the tile focus was last on, or ""
 * @param {string} inspected the key the inspector is open on, or ""
 * @returns {string} the key, or "" on an empty page
 */
export function rovingKey(visible, active, inspected) {
  if (active && visible.includes(active)) return active;
  if (inspected && visible.includes(inspected)) return inspected;
  return visible[0] ?? "";
}
