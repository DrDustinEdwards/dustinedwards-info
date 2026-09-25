/* /api/health bodies for the tests that read one: the readiness step and the watchdog's
 * repair planner. The five checks are the ones the endpoint reports, in its order. */

export const CHECK_NAMES = [
  "ask-index-drift",
  "media-index-drift",
  "media-backup-drift",
  "content-drift",
  "fts-equality",
];

/** Every check passing. */
export const HEALTHY = { ok: true, checks: CHECK_NAMES.map((name) => ({ name, ok: true })) };

/**
 * All five checks, with each one named in `drift` failing and carrying its detail.
 *
 * @param {Record<string, { expected: number, present: number }>} drift
 */
export const bodyDrifted = (drift) => ({
  ok: false,
  checks: CHECK_NAMES.map((name) =>
    name in drift ? { name, ok: false, ...drift[name] } : { name, ok: true },
  ),
});

/**
 * A passing fts-equality followed by `failing`, in the order given. Unknown classes are
 * allowed, which is what the watchdog's notify arm needs.
 *
 * @param {string[]} failing
 */
export const bodyFailing = (failing) => ({
  ok: false,
  checks: [
    { name: "fts-equality", ok: true },
    ...failing.map((name) => ({ name, ok: false })),
  ],
});
