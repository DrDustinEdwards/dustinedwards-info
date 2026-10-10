// A recipe's views (docs/KNOWLEDGE-BASE.md, step 9): its ingredients both ways (R2), metric and imperial (R3) and its
// mise-en-place (R5), every one computed from the compiled record and the reader's address, never stored. Unit conversion is
// arithmetic on the record's own amounts; volume becomes weight only for an ingredient whose recipe states `grams_per_cup`
// (DECIDE 7), never from a table of densities. Pure, so the page, the sheet and a test read the same numbers.

import { formatNumber, formatQuantity } from "./marks.mjs";

/** The unit systems a reader can ask for; absent is the recipe's own units. */
export const UNIT_SYSTEMS = Object.freeze({ metric: "Metric", imperial: "Imperial (US)" });

/** @typedef {keyof typeof UNIT_SYSTEMS} UnitSystem */
/** @typedef {{ amount: string, unit: string, fixed: boolean, min: number | null, max: number | null }} Quantity */

/** The system an address asks for (`?units=metric`), or null for the recipe's own. @param {string | null} value @returns {UnitSystem | null} */
export function readUnits(value) {
  return value === "metric" || value === "imperial" ? value : null;
}

/** Grams in one of each mass unit. */
const GRAMS = /** @type {Record<string, number>} */ ({ g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 });
/** Millilitres in one of each volume unit (US customary). */
const MILLILITRES = /** @type {Record<string, number>} */ ({ ml: 1, l: 1000, tsp: 4.92892159375, tbsp: 14.78676478125, "fl oz": 29.5735295625, cup: 236.5882365 });
/** The spoons a cook uses in either system, kept as written. */
const SPOONS = new Set(["tsp", "tbsp"]);

/** A unit's one spelling: "teaspoons" is tsp, "Cups" is cup. @param {string} unit */
function canonical(unit) {
  const u = unit.trim().toLowerCase().replace(/\.$/, "");
  const aliases = /** @type {Record<string, string>} */ ({
    gram: "g", grams: "g", kilogram: "kg", kilograms: "kg", ounce: "oz", ounces: "oz", pound: "lb", pounds: "lb", lbs: "lb",
    millilitre: "ml", millilitres: "ml", milliliter: "ml", milliliters: "ml", litre: "l", litres: "l", liter: "l", liters: "l",
    teaspoon: "tsp", teaspoons: "tsp", tablespoon: "tbsp", tablespoons: "tbsp", cups: "cup", "fluid ounce": "fl oz", "fluid ounces": "fl oz",
  });
  return aliases[u] ?? u;
}

/** A number rounded as a cook reads it in a unit: whole grams, quarter cups, half ounces. @param {number} n @param {string} unit */
function round(n, unit) {
  const step = unit === "cup" ? 0.25 : unit === "lb" ? 0.1 : unit === "oz" ? 0.25 : unit === "tsp" || unit === "tbsp" ? 0.25 : n < 10 ? 0.1 : 1;
  return Math.round(n / step) * step;
}

/**
 * One amount in a unit of `system`: grams become ounces and the reverse, millilitres become cups and the reverse, spoons stay. In
 * metric, a volume of an ingredient with `gramsPerCup` becomes its weight. A unit neither system knows (a pinch, 2 eggs) is
 * left as written, and so is an amount with no number.
 *
 * @param {number} value
 * @param {string} unit
 * @param {UnitSystem} system
 * @param {number | null} gramsPerCup
 * @returns {{ value: number, unit: string } | null}
 */
function convert(value, unit, system, gramsPerCup) {
  const u = canonical(unit);
  if (u in GRAMS) {
    const g = value * /** @type {number} */ (GRAMS[u]);
    if (system === "metric") return g >= 1000 ? { value: g / 1000, unit: "kg" } : { value: g, unit: "g" };
    const oz = g / /** @type {number} */ (GRAMS.oz);
    return oz >= 16 ? { value: oz / 16, unit: "lb" } : { value: oz, unit: "oz" };
  }
  if (u in MILLILITRES) {
    if (SPOONS.has(u)) return null;
    const ml = value * /** @type {number} */ (MILLILITRES[u]);
    if (system === "metric") {
      if (gramsPerCup) return { value: (ml / /** @type {number} */ (MILLILITRES.cup)) * gramsPerCup, unit: "g" };
      return ml >= 1000 ? { value: ml / 1000, unit: "l" } : { value: ml, unit: "ml" };
    }
    if (ml < 15) return { value: ml / /** @type {number} */ (MILLILITRES.tsp), unit: "tsp" };
    if (ml < 60) return { value: ml / /** @type {number} */ (MILLILITRES.tbsp), unit: "tbsp" };
    return { value: ml / /** @type {number} */ (MILLILITRES.cup), unit: "cup" };
  }
  return null;
}

/**
 * An amount as the reader asked for it: scaled by `factor` (a fixed amount is not), then in `system` when one is asked for.
 *
 * @param {Quantity} q
 * @param {number} factor
 * @param {UnitSystem | null} system
 * @param {number | null} [gramsPerCup]
 */
export function showQuantity(q, factor, system, gramsPerCup = null) {
  if (!system || q.min === null) return formatQuantity({ ...q, raw: "" }, factor);
  const scale = q.fixed ? 1 : factor;
  const low = convert(q.min * scale, q.unit, system, gramsPerCup);
  if (!low) return formatQuantity({ ...q, raw: "" }, factor);
  const high = q.max !== null && q.max !== q.min ? convert(q.max * scale, q.unit, system, gramsPerCup) : null;
  // A range is shown in the unit of its low end, so "1 to 2 cups" never reads "1 cup to 0.5 quart".
  const highValue = high ? (high.unit === low.unit ? high.value : (q.max ?? 0) * scale * (low.value / (q.min * scale))) : null;
  const amount = highValue !== null ? `${formatNumber(round(low.value, low.unit))} to ${formatNumber(round(highValue, low.unit))}` : formatNumber(round(low.value, low.unit));
  return `${amount} ${low.unit}`;
}

/** A temperature in the other scale, to the nearest 5 degrees as an oven dial reads. @param {number} t @param {"C" | "F"} to */
const toScale = (t, to) => Math.round((to === "F" ? (t * 9) / 5 + 32 : ((t - 32) * 5) / 9) / 5) * 5;

/**
 * A step's words with its temperatures in the asked-for system's scale: "180 °C" reads "355 °F" in imperial, and the reverse in
 * metric. HTML in, HTML out: only the text of a temperature changes.
 *
 * @param {string} html
 * @param {UnitSystem | null} system
 */
export function showTemperatures(html, system) {
  if (!system) return html;
  const from = system === "imperial" ? "C" : "F";
  const to = system === "imperial" ? "F" : "C";
  return html.replace(new RegExp(`(-?\\d+(?:\\.\\d+)?)(?:\\s*(?:to|-)\\s*(-?\\d+(?:\\.\\d+)?))?\\s*°${from}`, "g"), (_all, low, high) =>
    high !== undefined ? `${toScale(Number(low), to)} to ${toScale(Number(high), to)} °${to}` : `${toScale(Number(low), to)} °${to}`,
  );
}

/** The anchor of a step on the page: its list's scope and its number. @param {string} scope @param {number} number */
export const stepId = (scope, number) => `${scope}step-${number}`;

/**
 * Every step each ingredient is used in, in the page's order: the other half of R2, read from the marks the compile already
 * put on each step. Keyed by the ingredient's name, lower-cased, as the record's materials are.
 *
 * @param {import("./render.mjs").ProcedureRecord} record
 */
export function ingredientSteps(record) {
  /** @type {Map<string, Array<{ number: number, id: string }>>} */
  const uses = new Map();
  for (const section of record.sections) {
    section.blocks.forEach((block, i) => {
      if (block.type !== "steps") return;
      for (const step of block.steps) {
        for (const m of step.materials) {
          const key = m.name.toLowerCase();
          const list = uses.get(key) ?? [];
          if (!list.some((u) => u.number === step.number && u.id === stepId(`${section.id}-${i}-`, step.number))) {
            list.push({ number: step.number, id: stepId(`${section.id}-${i}-`, step.number) });
          }
          uses.set(key, list);
        }
      }
    });
  }
  return uses;
}

/**
 * The grams in a cup of each ingredient whose recipe states it, by lower-cased name.
 *
 * @param {import("./render.mjs").ProcedureRecord} record
 */
export function gramsPerCup(record) {
  return new Map(record.materials.flatMap((m) => (typeof m.gramsPerCup === "number" ? [[m.name.toLowerCase(), m.gramsPerCup]] : [])));
}

/**
 * A step's ingredients, each with its amount as the reader asked for it: the first half of R2.
 *
 * @param {import("./render.mjs").ProcedureRecord["sections"][number]["blocks"][number] extends infer B ? B extends { type: "steps", steps: Array<infer S> } ? S : never : never} step
 * @param {number} factor
 * @param {UnitSystem | null} system
 * @param {Map<string, number>} densities
 * @param {Map<string, string>} [names] the ingredient list's words for each ingredient, which the step's own marks may shorten
 */
export function stepIngredients(step, factor, system, densities, names = new Map()) {
  return step.materials.map((m) => {
    const q = step.quantities.find((x) => x.name?.toLowerCase() === m.name.toLowerCase());
    return { name: names.get(m.name.toLowerCase()) ?? m.display, amount: q ? showQuantity(q, factor, system, densities.get(m.name.toLowerCase()) ?? null) : null };
  });
}

/** Each ingredient's words in the ingredient list, by lower-cased name. @param {import("./render.mjs").ProcedureRecord} record */
export function ingredientNames(record) {
  return new Map(record.materials.map((m) => [m.name.toLowerCase(), m.display]));
}

/**
 * The mise-en-place: every ingredient once, with its total amount at the reader's servings and units, in the order of the
 * ingredient list; and the same as plain lines, a shopping list to copy (R5).
 *
 * @param {import("./render.mjs").ProcedureRecord} record
 * @param {number} factor
 * @param {UnitSystem | null} system
 */
export function miseEnPlace(record, factor, system) {
  const items = record.materials.map((m) => {
    const amount = m.amount ? m.amount : m.quantity ? showQuantity(m.quantity, factor, system, m.gramsPerCup ?? null) : null;
    return { name: m.display, amount };
  });
  return { items, text: items.map((i) => `- ${i.amount ? `${i.amount} ` : ""}${i.name}`).join("\n") };
}
