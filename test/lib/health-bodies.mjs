/* /health bodies for the tests that read one: the readiness step and the watchdog's repair planner.
 * The drift checks are the ones the endpoint reports, in its order, after the database's. */

export const CHECK_NAMES = [
  "ask-index-drift",
  "media-index-drift",
  "media-backup-drift",
  "content-drift",
  "procedures-drift",
  "dictionary-drift",
  "roster-drift",
  "phage-drift",
  "registry-drift",
  "pages-drift",
  "publications-drift",
  "llms-drift",
  "cv-drift",
  "cv-pdf-drift",
  "fts-equality",
];

const pass = (name) => ({ name, status: "pass" });

/** Every check passing. */
export const HEALTHY = { status: "pass", ok: true, checks: [pass("db"), ...CHECK_NAMES.map(pass)] };

/**
 * Every check, with each one named in `drift` warning and carrying its counts as /health words them.
 *
 * @param {Record<string, { expected: number, present: number }>} drift
 */
export const bodyDrifted = (drift) => ({
  status: "warn",
  ok: true,
  checks: [
    pass("db"),
    ...CHECK_NAMES.map((name) =>
      name in drift
        ? { name, status: "warn", detail: `${drift[name].present} of ${drift[name].expected}` }
        : pass(name),
    ),
  ],
});

/**
 * A passing fts-equality followed by `failing`, each warning, in the order given. Unknown classes are
 * allowed, which is what the watchdog's notify arm needs.
 *
 * @param {string[]} failing
 */
export const bodyFailing = (failing) => ({
  status: "warn",
  ok: true,
  checks: [pass("fts-equality"), ...failing.map((name) => ({ name, status: "warn" }))],
});
