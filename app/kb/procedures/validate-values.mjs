/** The closed unit lists and the quantity pattern procedure fields are judged against. */

/** Units are a closed list. A unit outside it fails until it is added here on purpose. */
export const PROTOCOL_UNITS = [
  "µl",
  "µL",
  "ml",
  "mL",
  "l",
  "L",
  "M",
  "mM",
  "µM",
  "nM",
  "mg/ml",
  "µg/ml",
  "ng/µl",
  "%",
  "U",
  "g",
  "mg",
  "µg",
  "ng",
  "volume",
  "volumes",
  "tube",
  "tubes",
  "reaction",
  "reactions",
  "plate",
  "plates",
  "x",
];
export const TIME_UNITS = [
  "second",
  "seconds",
  "sec",
  "s",
  "minute",
  "minutes",
  "min",
  "hour",
  "hours",
  "h",
  "day",
  "days",
];

/**
 * "250 µl", "0.5 ml", "100% or 80%", "1.25 to 5 µl", "2.5 volumes".
 *
 * @param {string[]} units
 */
function quantityPattern(units) {
  const number = String.raw`\d[\d,]*(?:\.\d+)?`;
  const unit = units.map((u) => u.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")).join("|");
  return new RegExp(`^${number}(?: ?(?:${unit}))?(?: (?:to|or) ${number})? ?(?:${unit})$`);
}

export const PROTOCOL_QUANTITY = quantityPattern(PROTOCOL_UNITS);

/**
 * @param {unknown} value
 */
export function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
