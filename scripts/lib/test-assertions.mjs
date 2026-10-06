/**
 * Finds `test(...)` and `it(...)` calls whose body asserts nothing: a test that cannot fail. The scan is
 * lexical (strings, template literals, comments and regex literals are skipped when matching brackets), because the
 * repo's TypeScript 7 has no JS API to parse with.
 *
 * A body counts as asserting when it calls something named like an assertion (assert, expect, check, verify,
 * ensure, validate, must, fail), the invariants harness's `done`, awaits a `rejects` or `resolves`, calls a method on
 * `t` (node:test's context, `t.assert`), or calls a function declared in the same file whose own body asserts. A
 * helper from another file with another name that throws on failure is invisible here: name it for what it does, or
 * put the assertion in the test.
 */

const ASSERTING = /\b(?:assert|expect|check|verify|ensure|validate|must|fail|should|done)\w*\s*[.(]|\.(?:rejects|resolves)\b|\bt\.assert\b/i;
const CALL = /(?<![\w.$])(?:test|it)\s*\(/g;
const REGEX_CAN_START_AFTER = /[(,=:!&|?{};[+\-*%<>~^]$|(?:^|[^\w$.])(?:return|typeof|case|void|delete|in|of|await|yield)$/;

/**
 * The index just past the bracket that closes the one at `open`.
 *
 * @param {string} source
 * @param {number} open index of "(" or "{"
 * @returns {number}
 */
function closeOf(source, open) {
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      i = source.indexOf("\n", i);
      if (i < 0) return source.length;
    } else if (ch === "/" && next === "*") {
      i = source.indexOf("*/", i + 2) + 1;
      if (i === 0) return source.length;
    } else if (ch === '"' || ch === "'") {
      for (i += 1; i < source.length && source[i] !== ch; i += 1) if (source[i] === "\\") i += 1;
    } else if (ch === "`") {
      i = endOfTemplate(source, i);
    } else if (ch === "/" && REGEX_CAN_START_AFTER.test(source.slice(Math.max(0, i - 12), i).trimEnd())) {
      let inClass = false;
      for (i += 1; i < source.length; i += 1) {
        if (source[i] === "\\") i += 1;
        else if (source[i] === "[") inClass = true;
        else if (source[i] === "]") inClass = false;
        else if (source[i] === "/" && !inClass) break;
        else if (source[i] === "\n") break;
      }
    } else if (ch === "(" || ch === "{" || ch === "[") {
      depth += 1;
    } else if (ch === ")" || ch === "}" || ch === "]") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return source.length;
}

/** @param {string} source @param {number} start index of the opening backtick @returns {number} index of the closing one */
function endOfTemplate(source, start) {
  for (let i = start + 1; i < source.length; i += 1) {
    if (source[i] === "\\") i += 1;
    else if (source[i] === "`") return i;
    else if (source[i] === "$" && source[i + 1] === "{") i = closeOf(source, i + 1) - 1;
  }
  return source.length;
}

/**
 * Functions this file declares whose bodies assert, so a test that calls one is asserting.
 *
 * @param {string} source
 * @returns {string[]}
 */
function assertingHelpers(source) {
  /** @type {string[]} */
  const names = [];
  const declaration = /(?:^|\n)\s*(?:async\s+)?function\s+(\w+)\s*\(|(?:^|\n)\s*const\s+(\w+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>)/g;
  for (const match of source.matchAll(declaration)) {
    const name = match[1] ?? match[2];
    const open = source.indexOf("{", (match.index ?? 0) + match[0].length);
    if (open < 0 || !name) continue;
    if (ASSERTING.test(source.slice(open, closeOf(source, open)))) names.push(name);
  }
  return names;
}

/**
 * @param {string} source a test file's text
 * @returns {Array<{ line: number, name: string }>} the tests that assert nothing, by the line of the call
 */
export function testsWithoutAssertions(source) {
  const helpers = assertingHelpers(source);
  /** @type {Array<{ line: number, name: string }>} */
  const found = [];
  for (const match of source.matchAll(CALL)) {
    const open = (match.index ?? 0) + match[0].length - 1;
    const end = closeOf(source, open);
    const call = source.slice(open, end);
    // `test.skip`, `test.todo` and `test.each` are not matched by CALL; a call with no function in it is not a test.
    if (!/=>|\bfunction\b/.test(call)) continue;
    if (ASSERTING.test(call) || helpers.some((helper) => new RegExp(`(?<![\\w.$])${helper}\\s*\\(`).test(call))) continue;
    const name = /^\(\s*(["'`])([^]*?)\1/.exec(call)?.[2] ?? "(unnamed)";
    found.push({ line: source.slice(0, open).split("\n").length, name });
  }
  return found;
}
