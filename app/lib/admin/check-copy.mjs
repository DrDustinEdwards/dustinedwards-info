/**
 * @typedef {object} CheckCopy
 * @property {string} name
 * @property {(counts: { expected: number, present: number } | undefined) => string | null} failing
 * @property {string} passing
 * @property {{ action: string, intent: string, label: string } | null} repair
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
    // No counts: it compares key sets and etags, not totals, so the verdict's detail is used.
    failing: () => null,
    passing: "Every uploaded file has a second, byte-identical copy.",
    repair: null,
  },
  "fts-equality": {
    name: "Site search",
    // Same: five subqueries compared pairwise, not a total against a total.
    failing: () => null,
    passing: "Search knows about every post and every page it should.",
    repair: null,
  },
};

/**
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
  const finding = copy.failing(check.counts) ?? check.detail;
  return { name: copy.name, finding, repair: copy.repair };
}

/**
 * @param {Array<{ name: string, ok: boolean, detail: string, counts?: { expected: number, present: number } }>} checks
 * @returns {string}
 */
export function statusSentence(checks) {
  const failing = checks.filter((check) => !check.ok);
  // Guard the value, not the length, so the compiler knows `worst` is defined.
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
