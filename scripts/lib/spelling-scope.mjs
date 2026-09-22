/**
 * Which tracked files American spelling governs, shared by `check:spelling` and the one-time fix.
 *
 * OUT, each for its reason: applied migrations are never edited (hard rule 14); `data/` and the
 * publication records carry third-party titles; `scratchpad/` is extracted history; the two files
 * capsid's copier owns stay byte-identical across the roster; `.claude/` decides which rules are
 * enforced (hard rule 15); generated artifacts follow their generators. `content/posts/` and
 * `content/about.md` are Dustin's authored prose and are REPORTED, never rewritten.
 */

const EXCLUDED = [
  /^drizzle\//,
  /^data\//,
  /^app\/data\/publications\.ts$/,
  /^scratchpad\//,
  /^scripts\/improve-report\.mjs$/,
  /^\.github\//,
  /^\.claude\//,
  /^content\/generated\//,
  /^public\//,
  /^node_modules\//,
  /(^|\/)package(-lock)?\.json$/,
  /^scripts\/lib\/american-spelling\.mjs$/,
  /^test\/american-spelling\.test\.mjs$/,
  /\.generated\./,
];

/** Authored prose: listed for Dustin, not rewritten. */
export const AUTHORED = [/^content\/posts\//, /^content\/about\.md$/];

/** @param {string} path a tracked path, forward slashes */
export function governed(path) {
  return !EXCLUDED.some((r) => r.test(path)) && !AUTHORED.some((r) => r.test(path));
}

/** @param {string} path */
export function authored(path) {
  return AUTHORED.some((r) => r.test(path));
}
