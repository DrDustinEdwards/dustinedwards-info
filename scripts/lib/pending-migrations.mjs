/**
 * Does the deployed database have every migration this repo carries?
 *
 * PURE. It takes the text `wrangler d1 migrations list` printed and the list of
 * migration files on disk, and returns a verdict. It runs no command and
 * touches no network, which is what lets the RULE be unit tested against
 * recorded output instead of only against a live database.
 *
 * ## The defect this exists for, measured 2026-08-15
 *
 * SHIP WINDOW 5 deployed with every gate green and the media admin page
 * returned a 500 on its first load. `0011_media_trash_tags.sql` had been
 * pending on the remote database since the session that authored it, four
 * sessions earlier, so `trashed_at` and `tags` did not exist and every media
 * loader query threw.
 *
 * Nothing could see it. `npm run ship` applies no migrations and compares no
 * schema. `check:migrations` compares FILES to a hash manifest, never to a
 * database. `check:admin-ui` renders the route with every `.server` import
 * stubbed, so the loader never runs. `check:invariants --remote` would have
 * caught it and is in neither tier ship runs. Authoring a migration created an
 * obligation nowhere.
 *
 * ## Why this REFUSES rather than applying
 *
 * A deploy that silently mutates the production schema is worse than one that
 * stops. `0011` happened to be additive, two `ADD COLUMN` and an index, and
 * ship cannot tell that from a `DROP` or a rewrite: it would have to read and
 * classify SQL, and being wrong once is unrecoverable. The operator decides,
 * and this makes sure they are ASKED rather than finding out from a 500.
 *
 * ## Fail closed, with three outcomes and not two
 *
 * The dangerous shape here is a parser that reads "no pending migrations" from
 * output it did not understand. So "nothing pending" needs a POSITIVE signal,
 * and anything unrecognised is its own verdict:
 *
 *   pending      names are present. Refuse, listing them.
 *   clean        wrangler said so, in words. Proceed.
 *   unreadable   neither. Refuse, saying the output could not be read.
 *
 * An empty match set is never on its own evidence of a clean database.
 */

/** What wrangler prints when it has nothing to do. Version-sensitive by nature. */
const CLEAN_MARKERS = ["No migrations to apply"];

/** The heading above the table of pending names. */
const PENDING_MARKERS = ["Migrations to be applied"];

/**
 * A migration filename, as it appears both on disk and in wrangler's table.
 *
 * Anchored to the four-digit prefix this repo uses, so a stray word in a
 * warning banner cannot be mistaken for a migration.
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
 * @param {string[]} [input.onDisk] migration filenames in `drizzle/`
 * @returns {MigrationVerdict}
 */
export function readMigrationList({ code, text, onDisk = [] }) {
  // A NON-ZERO EXIT IS NOT "NOTHING PENDING". Network down, auth expired, the
  // database renamed: every one of them exits non-zero and prints no names, and
  // treating that as clean is exactly how a guard becomes decoration.
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
   * SCOPED-BY the whole command output, deliberately, and there is no narrower
   * region to scope to: `body` is a few lines of wrangler stdout rather than a
   * document with elements, and these markers are wrangler's own sentinel
   * sentences. Matching one anywhere in its output IS the signal.
   *
   * The vacuity this rule guards against is handled by the design instead of by
   * the needle: neither marker matching does not mean "clean", it means
   * `unreadable`, and clean requires the positive marker AND no names. An
   * unscoped match here can only ever produce a MORE cautious verdict.
   */
  /* SCOPED-BY the whole command output, which is the only region there is. */
  const saysPending = PENDING_MARKERS.some((m) => body.includes(m));
  /* SCOPED-BY the same whole command output, for the same reason. */
  const saysClean = CLEAN_MARKERS.some((m) => body.includes(m));

  /*
   * NAMES WIN OVER THE CLEAN MARKER, and the order matters.
   *
   * If output somehow contained both, the safe reading is that something is
   * pending. A guard that resolved the ambiguity toward "proceed" would be
   * choosing the outcome that ships.
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
   * Everything else is UNREADABLE, including the case where names appear with
   * no heading and the case where nothing at all matched. The second is the one
   * worth naming: an empty parse of changed output looks identical to a clean
   * database, and this is the branch that refuses to let it.
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
 * The remedy sentence, so nobody has to remember the command under pressure.
 *
 * The exact invocation, with the database name filled in, because a refusal
 * that says "apply your migrations" and makes the operator go looking is a
 * refusal that gets worked around.
 *
 * @param {string} database
 * @returns {string}
 */
export function applyCommand(database) {
  return `npx wrangler d1 migrations apply ${database} --remote`;
}
