/**
 * Runs OWASP's own header test suite against a response, with no network and no venom.
 *
 * The suite is the OWASP Secure Headers Project's validator (oshp-tests-suite.yml, read verbatim by update-owasp.mjs
 * from subprojects/validator/tests_suite.yml). It is a venom test plan: each test case GETs the target and asserts on
 * `result.statuscode` and `result.headers.<Name>`. Venom is a Go binary that needs a live URL; this runs the same
 * assertions on the headers a site's code would send, so CI proves a policy before it is deployed. Only the operators
 * the suite uses are implemented, and any other one throws, so a changed suite fails loudly instead of passing quietly.
 *
 * The suite is the oracle for OSHP's recommendation, and OSHP's recommendation includes headers this package
 * deliberately does not send everywhere (OWASP_SKIPPED), so a run is expected to fail exactly those test cases.
 * Pass the YAML already parsed (a plain object), so this module needs no YAML parser.
 */

/** @typedef {{ status: number, headers: Headers }} SuiteResponse */

/** @param {string} text the assertion's argument text @returns {string[]} */
function argumentsOf(text) {
  return [...text.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3] ?? "");
}

/**
 * @param {string} assertion e.g. `result.headers.X-Frame-Options ShouldBeIn "deny" "DENY"`
 * @param {SuiteResponse} response
 * @returns {boolean}
 */
function holds(assertion, response) {
  const match = /^(result\.statuscode|result\.headers\.[A-Za-z0-9-]+)\s+(Should[A-Za-z]+)\s*(.*)$/.exec(assertion.trim());
  if (!match) throw new Error(`unsupported assertion: ${assertion}`);
  const [, subject = "", operator = "", rest = ""] = match;
  const value =
    subject === "result.statuscode" ? String(response.status) : (response.headers.get(subject.slice("result.headers.".length)) ?? null);
  const args = argumentsOf(rest);
  switch (operator) {
    case "ShouldEqual":
      return value !== null && value === args[0];
    case "ShouldNotBeNil":
      return value !== null;
    case "ShouldBeNil":
      return value === null;
    case "ShouldBeIn":
      return value !== null && args.includes(value);
    case "ShouldContainSubstring":
      return value !== null && value.includes(args[0] ?? "");
    case "ShouldNotContainSubstring":
      return value !== null && !value.includes(args[0] ?? "");
    default:
      throw new Error(`unsupported operator ${operator} in: ${assertion}`);
  }
}

/** @param {unknown} assertion @param {SuiteResponse} response @returns {boolean} */
function holdsAny(assertion, response) {
  if (typeof assertion === "string") return holds(assertion, response);
  if (assertion && typeof assertion === "object" && Array.isArray(/** @type {any} */ (assertion).or)) {
    return /** @type {any} */ (assertion).or.some((/** @type {unknown} */ a) => holdsAny(a, response));
  }
  throw new Error(`unsupported assertion shape: ${JSON.stringify(assertion)}`);
}

/**
 * Runs every test case of the suite.
 *
 * @param {{ testcases: Array<{ name: string, steps: Array<{ url?: string, assertions?: unknown[] }> }> }} suite the parsed suite
 * @param {{ page: SuiteResponse, logout?: SuiteResponse }} responses the page the suite calls `target_site`, and the
 *   logout response it calls `target_site/logout_url` (cases that need it fail when none is given)
 * @returns {Array<{ name: string, pass: boolean, failed: string[] }>}
 */
export function runOshpSuite(suite, responses) {
  if (!Array.isArray(suite?.testcases) || suite.testcases.length === 0) throw new Error("the suite has no test cases");
  return suite.testcases.map((testcase) => {
    /** @type {string[]} */
    const failed = [];
    for (const step of testcase.steps) {
      const response = String(step.url ?? "").includes("logout_url") ? responses.logout : responses.page;
      for (const assertion of step.assertions ?? []) {
        if (!response) {
          failed.push(typeof assertion === "string" ? assertion : JSON.stringify(assertion));
        } else if (!holdsAny(assertion, response)) {
          failed.push(typeof assertion === "string" ? assertion : JSON.stringify(assertion));
        }
      }
    }
    return { name: testcase.name, pass: failed.length === 0, failed };
  });
}
