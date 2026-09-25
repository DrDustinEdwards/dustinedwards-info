import { assertFloor } from "./floor.mjs";

/**
 * The pass/fail counter every gate keeps. Label first, condition second: a string in the condition
 * slot is always truthy, so one argument order for every gate is what keeps a swapped call visible.
 *
 * The options only reproduce the report shapes the gates already print, so a gate's output did not
 * change when its own copy was replaced by this one.
 *
 * @param {{
 *   separator?: string,
 *   blankLine?: boolean,
 *   printPass?: boolean,
 *   print?: boolean,
 * }} [style] `separator` joins a label to its detail; `blankLine` puts an empty line before a FAIL;
 *   `printPass` prints an `ok` line per passing check; `print: false` records failures for the gate
 *   to print itself at the end.
 */
export function createTally(style = {}) {
  const { separator = "\n        ", blankLine = false, printPass = false, print = true } = style;
  let checks = 0;
  /** @type {string[]} */
  const failed = [];

  /**
   * Records a failure the gate found outside `ok`, without counting a check or printing it.
   *
   * @param {string} text
   */
  function fail(text) {
    failed.push(text);
  }

  /**
   * @param {string} label
   * @param {boolean} condition
   * @param {string} [detail]
   */
  function ok(label, condition, detail = "") {
    checks += 1;
    if (condition) {
      if (printPass) console.log(`  ok    ${label}`);
      return;
    }
    const text = `${label}${detail ? `${separator}${detail}` : ""}`;
    failed.push(text);
    if (print) console.log(`${blankLine ? "\n" : ""}  FAIL  ${text}`);
  }

  /**
   * `ok` on a JSON comparison, with both sides printed under the label when they differ.
   *
   * @param {string} label
   * @param {unknown} actual
   * @param {unknown} expected
   */
  function eq(label, actual, expected) {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    ok(`${label}\n    expected ${b}\n    actual   ${a}`, a === b);
  }

  /**
   * The whole-gate floor, failed as one more check so the summary line counts it.
   *
   * @param {string} gate
   * @param {string} name
   * @param {number} minimum
   * @param {string} [why]
   * @param {string} [label]
   */
  function floor(gate, name, minimum, why = "", label = "this gate executed its assertions") {
    const breach = assertFloor(gate, name, checks, minimum, why);
    if (breach) ok(label, false, breach);
    return breach;
  }

  return {
    ok,
    eq,
    fail,
    floor,
    failed,
    get checks() {
      return checks;
    },
    get failures() {
      return failed.length;
    },
  };
}
