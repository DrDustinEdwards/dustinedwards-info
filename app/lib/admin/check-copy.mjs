/**
 * THE OPERATOR'S WORDS FOR THE FIVE HEALTH CHECKS.
 *
 * Ruling 54: internal names stay off the page. "content-drift", "ask-index",
 * "fts-equality" and `sync_posts` are what the instruments are called in the
 * source; none of them says anything to the person deciding whether to press a
 * button, and four of the five do not even name the thing they are about.
 *
 * ## THIS FILE OWNS NO NUMBERS, AND THAT IS THE WHOLE CONSTRAINT
 *
 * The one-owner rule: a measured value lives in the gate or the function that
 * measures it, or nowhere. Every figure the overview prints comes out of the
 * verdict's own `counts`, which the verdict functions already compute and
 * already ship. What lives here is the NOUN and the VERB: what the check is
 * about, and what the operator can do about it. Neither rots when a count moves.
 *
 * The failing sentence therefore has a shape rather than a value, and the
 * values are substituted from `counts` at render time. Where a check ships no
 * counts (the two that compare key sets rather than totals), the verdict's own
 * `detail` is the fallback, because a sentence this file invented would be a
 * second owner of a fact it cannot see.
 *
 * ## `repair` IS WHAT DECIDES WHETHER A ROW HAS A MENU
 *
 * A kebab on a passing row opens onto nothing, which is the same defect as an
 * empty Maintenance menu: it teaches the reader that menus here are not worth
 * opening. So a row gets a menu only where this file names an intent the page
 * can actually submit, and only while that row is failing.
 *
 * ## THE OVERVIEW ADDS NO WRITE PATH, AND THIS IS WHERE THAT IS ENFORCED
 *
 * `repair` names a route that ALREADY OWNS the intent, and the control posts
 * there. `/admin` has a loader and no action, and this design pass does not
 * give it one: the admin backlog's standing rule for any redo is no new write
 * paths and no change to what a save means. So the overview is a place you
 * decide from, and the door stays where the page that owns it put it.
 */

/**
 * @typedef {object} CheckCopy
 * @property {string} name What the check is about, in the operator's words.
 * @property {(counts: { expected: number, present: number } | undefined) => string | null} failing
 *   The failing sentence. Reads counts; never invents one. Null means "no shape
 *   fits this check, use the instrument's own sentence".
 * @property {string} passing The passing sentence. Carries no figure at all.
 * @property {{ action: string, intent: string, label: string } | null} repair
 *   The route that already owns the repair, and the intent it already reads.
 */

/** @type {Record<string, CheckCopy>} */
export const CHECK_COPY = {
  "content-drift": {
    name: "Posts on the site",
    failing: (counts) =>
      counts
        ? `${counts.expected - counts.present} of the ${counts.expected} posts are older on the site than in the repository. Syncing re-renders them.`
        : "Some posts are older on the site than in the repository. Syncing re-renders them.",
    passing: "Every post on the site matches the one in the repository.",
    repair: { action: "/admin/posts", intent: "regenerate", label: "Re-render every post" },
  },
  "ask-index-drift": {
    name: "Search answers",
    failing: (counts) =>
      counts
        ? `The answer index has ${counts.present} of ${counts.expected} posts, so an answer may quote text that has changed.`
        : "The answer index is out of step with the posts, so an answer may quote text that has changed.",
    passing: "The answer index has every post, and none it should not.",
    repair: { action: "/admin/posts", intent: "sync-ask", label: "Rebuild the answer index" },
  },
  "media-index-drift": {
    name: "Media library",
    failing: (counts) =>
      counts
        ? `The library lists ${counts.present} files and ${counts.expected} are stored, so something is missing from one side.`
        : "The library and the stored files disagree about what exists.",
    passing: "Every stored file is listed, and nothing is listed that is not there.",
    repair: { action: "/admin/media", intent: "rebuild", label: "Rebuild the library listing" },
  },
  "media-backup-drift": {
    name: "Media backups",
    /* NO COUNTS on this one, by design: it compares two key sets and every etag
       in them, so "expected" and "present" would be the wrong shape. The
       verdict's own sentence is the fallback the docstring names. */
    failing: () => null,
    passing: "Every uploaded file has a second, byte-identical copy.",
    repair: null,
  },
  "fts-equality": {
    name: "Site search",
    /* Same: five subqueries compared pairwise, not a total against a total. */
    failing: () => null,
    passing: "Search knows about every post and every page it should.",
    repair: null,
  },
};

/**
 * One check, in the words the overview prints.
 *
 * FAILS OPEN TO THE INSTRUMENT, never to silence. A check this file has no
 * entry for is a check somebody added without touching this page, and the
 * honest rendering is its own name and its own sentence rather than a blank
 * row: until the gap is closed the operator still sees what the instrument
 * said.
 *
 * @param {{ name: string, ok: boolean, detail: string, counts?: { expected: number, present: number } }} check
 * @returns {{ name: string, finding: string, repair: { action: string, intent: string, label: string } | null }}
 */
export function humanCheck(check) {
  const copy = CHECK_COPY[check.name];
  if (!copy) {
    return { name: check.name, finding: check.detail, repair: null };
  }
  if (check.ok) {
    return { name: copy.name, finding: copy.passing, repair: null };
  }
  // A shape with no value to put in it falls back to the instrument's sentence
  // rather than to a sentence this file made up.
  const finding = copy.failing(check.counts) ?? check.detail;
  return { name: copy.name, finding, repair: copy.repair };
}

/**
 * The page's one status sentence, which must AGREE WITH THE NOTICE.
 *
 * Ruling 54 states them as one rule because they were two rules and drifted:
 * the sentence said "every check the scheduled poll runs, answered here" while
 * the page below it was showing a failure. So both are computed from the same
 * call, here, and the notice is rendered from the first failing check this
 * function already looked at.
 *
 * @param {Array<{ name: string, ok: boolean, detail: string, counts?: { expected: number, present: number } }>} checks
 * @returns {string}
 */
export function statusSentence(checks) {
  const failing = checks.filter((check) => !check.ok);
  // The VALUE is guarded rather than the length. Same early return on an empty
  // list, and it is what tells the compiler the next line has an element.
  const worst = failing[0];
  if (!worst) {
    return "Everything agrees: the site, the repository, the library and search are all in step.";
  }
  const first = humanCheck(worst);
  if (failing.length === 1) {
    return `One thing needs attention. ${first.finding}`;
  }
  return `${failing.length} things need attention. ${first.finding}`;
}
