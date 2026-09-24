/** Three outcomes, not two: an empty match set is never on its own evidence of a clean database. */

/** Version-sensitive: wrangler's own wording. */
const CLEAN_MARKERS = ["No migrations to apply"];

const PENDING_MARKERS = ["Migrations to be applied"];

/** Anchored to the four-digit prefix so a stray word in a warning banner cannot match. */
const MIGRATION_NAME = /\b(\d{4}_[a-z0-9_]+\.sql)\b/g;

/**
 * @typedef {object} MigrationVerdict
 * @property {"pending" | "clean" | "unreadable"} state
 * @property {string[]} pending
 * @property {string} reason
 */

/**
 * @param {object} input
 * @param {number} input.code
 * @param {string} input.text
 * @returns {MigrationVerdict}
 */
export function readMigrationList({ code, text }) {
  // Network down, auth expired or a renamed database all exit non-zero and print no names.
  if (code !== 0) {
    return {
      state: "unreadable",
      pending: [],
      reason: `wrangler exited ${code}, so the deployed schema is unknown`,
    };
  }

  const body = typeof text === "string" ? text : "";

  const named = [...new Set((body.match(MIGRATION_NAME) ?? []))];
  const saysPending = PENDING_MARKERS.some((m) => body.includes(m));
  const saysClean = CLEAN_MARKERS.some((m) => body.includes(m));

  // Names win over the clean marker: if both appear, the safe reading is that something is pending.
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

  // Nothing matching is unreadable, not clean: an empty parse of changed output looks like a clean database.
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
 * @param {string} database
 * @returns {string}
 */
export function applyCommand(database) {
  return `npx wrangler d1 migrations apply ${database} --remote`;
}
