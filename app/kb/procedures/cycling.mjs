// A PCR program as the page draws it: one Apollo cue card per stage (Capsomer's manual theme, .cap-cue),
// with roll blocks under the strip for the stage you are on. Drawn from the front matter's `cycling`, which
// the validator checks, so the cards and the markdown twin's table say the same program.

const GAP = /^MISSING:/;

/** @param {unknown} v */
const known = (v) =>
  v === undefined || v === null || v === "" || (typeof v === "string" && GAP.test(v))
    ? null
    : String(v);

/**
 * One line of a card: the temperature as its name and the time as its value. A temperature the file has not
 * recorded is left as a dash rather than a guess.
 *
 * @param {any} step
 * @returns {{ name: string, value: string }}
 */
function line(step) {
  const temperature = known(step?.temperature_c);
  return {
    name: temperature === null ? "--" : `${temperature} °C`,
    value: known(step?.time) ?? "--",
  };
}

/**
 * @param {any} program one entry of `cycling`: `{ set?, program: [stage] }`
 * @returns {Array<{ title: string, lines: Array<{ name: string, value: string }> }>}
 */
export function cueStages(program) {
  const stages = Array.isArray(program?.program) ? program.program : [];
  return stages.map((/** @type {any} */ stage) => ({
    title: known(stage?.stage) ?? "Stage",
    lines: Array.isArray(stage?.steps) ? stage.steps.map(line) : [line(stage)],
  }));
}

/**
 * The page's prose renders each program's table too ("Step | Temperature (°C) | Time", the shape every cycling
 * table in content/procedures has); the page draws the program's cards in its place. Split, in order, so the nth
 * table is the nth program. A page with fewer programs than tables keeps the extra tables as written.
 */
const CYCLING_TABLE =
  /<div class="table-scroll"[^>]*aria-label="Table: Step, Temperature \(°C\), Time"[^>]*>[\s\S]*?<\/table>\s*<\/div>/g;

/**
 * @param {string} html one prose block's HTML
 * @param {number} first the index of the first program this block may take
 * @param {number} programs how many programs the record has
 * @returns {{ parts: Array<{ html: string } | { program: number }>, next: number }}
 */
export function splitCyclingTables(html, first, programs) {
  /** @type {Array<{ html: string } | { program: number }>} */
  const parts = [];
  let at = 0;
  let next = first;
  for (const match of html.matchAll(CYCLING_TABLE)) {
    if (next >= programs) break;
    const start = match.index ?? 0;
    if (start > at) parts.push({ html: html.slice(at, start) });
    parts.push({ program: next });
    next += 1;
    at = start + match[0].length;
  }
  if (at < html.length) parts.push({ html: html.slice(at) });
  return { parts, next };
}
