// The map at /systems with every system's inside (Dustin, 2026-10-18: "it's not intuitive to click twice"). The
// insides are drawn at build time (scripts/lib/system-layout.mjs, served as virtual:system-insides); these two put
// them into Capsomer's markup on the server, which is all the Worker does with them.

const esc = (/** @type {string} */ s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Capsomer's map with the inside layers given in place of its one for the core (the core's first, since Capsomer's
 * controller takes the first inside layer as its own and plays the core's flows on it), and the address of the
 * asset holding every layer, which the map's script fetches for the rest.
 * @param {string} html what systemMapHtml returned
 * @param {Record<string, string>} layers some of insideLayers' result, by id: none at rest, the chosen one's
 * @param {string | undefined} coreId
 * @param {string} url every layer, as JSON (virtual:system-insides' INSIDES_URL)
 */
export function wireMapHtml(html, layers, coreId, url) {
  const ids = Object.keys(layers).sort((a, b) => Number(b === coreId) - Number(a === coreId));
  const all = ids.map((id) => layers[id]).join("");
  // The detail line sits above the drawing here (app/styles/systems.css), so it is sent shown: a box that
  // appeared there once the script ran would push the drawing down. Where no script runs, systems.css hides it
  // and the view buttons, which would do nothing.
  const shown = html
    .replace(/(data-cap-part="(?:views|detail)"[^>]*?) hidden>/g, "$1>")
    .replace(/<figure class="cap-system-map" data-cap="system-map"/, (whole) => `${whole} data-insides="${esc(url)}"`);
  const own = /<svg class="cap-system-map-layer" data-layer="inside"[^>]*>[\s\S]*?<\/svg>/;
  if (own.test(shown)) return shown.replace(own, () => all);
  // A core with no parts: Capsomer drew no inside layer, so the layers go at the end of the stage.
  const stage = shown.indexOf('data-cap-part="stage"');
  const end = shown.indexOf("</div>", stage);
  return `${shown.slice(0, end)}${all}${shown.slice(end)}`;
}

/**
 * The map zoomed into one system, as the site's script leaves it: the figure entered and naming the system, and
 * that system's layer shown. So a shared ?system= address opens zoomed in, before any script and with none.
 * @param {string} html @param {string} id
 */
export function zoomInMapHtml(html, id) {
  return html
    .replace(/<figure class="cap-system-map" data-cap="system-map"/, (whole) => `${whole} data-entered data-zoom="${esc(id)}"`)
    .replace(`data-layer="inside" data-system="${esc(id)}"`, (whole) => `${whole} data-shown`);
}
