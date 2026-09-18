/**
 * Does the deployed database have every migration this repo carries?
 *
 * PURE: it takes what `wrangler d1 migrations list` printed plus the files on disk and returns a
 * verdict, which is what lets the RULE be unit tested against recorded output.
 *
 * Authoring a migration created an obligation nowhere: ship applies none and compares no schema,
 * `check:migrations` compares FILES to a manifest, and the gate that would have caught it is in
 * neither tier ship runs. IT REFUSES RATHER THAN APPLYING, because a deploy that silently mutates
 * the production schema is worse than one that stops and ship cannot classify SQL.
 *
 * THREE OUTCOMES, NOT TWO, because a parser that reads "nothing pending" from output it did not
 * understand is the danger: pending names refuse, a positive clean marker proceeds, and anything
 * unrecognised refuses as unreadable. An empty match set is never evidence of a clean database.
 */

/** What wrangler prints when it has nothing to do. Version-sensitive by nature. */
const CLEAN_MARKERS = ["No migrations to apply"];

/** The heading above the table of pending names. */
const PENDING_MARKERS = ["Migrations to be applied"];

/**
 * A migration filename, as it appears both on disk and in wrangler's table, anchored to the
 * four-digit prefix so a stray word in a warning banner cannot be mistaken for one.
 */
const MIGRATION_NAME = /\b(\d{4}_[a-z0-9_]+\.sql)\b/g;

/**
 * @typedef {object} MigrationVerdict
 * @property {"pending" | "clean" | "unreadable"} state
 * @property {string[]} pending  filenames wrangler says are not applied
 * @property {string} reason     one sentence, for the refusal message
 */

/**
 * Reads a `wrangler d1 migrations list` run.
 *
 * @param {object} input
 * @param {number} input.code    the process exit code
 * @param {string} input.text    stdout and stderr, combined
 * @returns {MigrationVerdict}
 */
export function readMigrationList({ code, text }) {
  // A NON-ZERO EXIT IS NOT "NOTHING PENDING": network down, auth expired or the database renamed
  // all exit non-zero and print no names, and treating that as clean is how a guard becomes
  // decoration.
  if (code !== 0) {
    return {
      state: "unreadable",
      pending: [],
      reason: `wrangler exited ${code}, so the deployed schema is unknown`,
    };
  }

  const body = typeof text === "string" ? text : "";

  const named = [...new Set((body.match(MIGRATION_NAME) ?? []))];
  /*
   * SCOPED-BY the whole command output, there being no narrower region: these markers are
   * wrangler's own sentinel sentences. The vacuity is handled by the design instead, since neither
   * marker matching means `unreadable` rather than clean, so an unscoped match can only ever
   * produce a MORE cautious verdict.
   */
  /* SCOPED-BY the whole command output, which is the only region there is. */
  const saysPending = PENDING_MARKERS.some((m) => body.includes(m));
  /* SCOPED-BY the same whole command output, for the same reason. */
  const saysClean = CLEAN_MARKERS.some((m) => body.includes(m));

  /*
   * NAMES WIN OVER THE CLEAN MARKER: if both appeared, the safe reading is that something is
   * pending, and resolving the ambiguity toward proceed would be choosing the outcome that ships.
   */
  if (named.length > 0 && saysPending) {
    return {
      state: "pending",
      pending: named,
      reason: `${named.length} migration(s) are not applied to the deployed database`,
    };
  }

  if (saysClean && named.length === 0) {
    return { state: "clean", pending: [], reason: "the deployed database has every migration" };
  }

  /*
   * Everything else is UNREADABLE, and the case worth naming is nothing matching at all: an empty
   * parse of changed output looks identical to a clean database.
   */
  return {
    state: "unreadable",
    pending: named,
    reason:
      named.length > 0
        ? "wrangler named migrations without the heading this parser expects"
        : "wrangler printed neither a pending list nor a no-migrations line, so its " +
          "output format has changed and this check cannot read it",
  };
}

/**
 * The remedy sentence, with the database name filled in: a refusal that says "apply your
 * migrations" and makes the operator go looking is a refusal that gets worked around.
 *
 * @param {string} database
 * @returns {string}
 */
export function applyCommand(database) {
  return `npx wrangler d1 migrations apply ${database} --remote`;
}
