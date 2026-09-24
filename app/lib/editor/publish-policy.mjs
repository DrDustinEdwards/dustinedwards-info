import matter from "gray-matter";

/**
 * @typedef {{ kind: "admin" } | { kind: "operator", id: string } | { kind: "smoke", id: string }} Actor
 */

export const SMOKE_READ_ONLY_POLICY = "smoke-is-read-only";

/**
 * Keyed by kind, so a new actor kind is a typecheck failure rather than a silent permission (a
 * switch with a missing case compiles and falls through).
 *
 * @type {Readonly<Record<Actor["kind"], Readonly<{ write: boolean, firstPublish: boolean, destroy: boolean }>>>}
 */
export const WRITE_CAPABILITIES = {
  admin: { write: true, firstPublish: true, destroy: true },
  operator: { write: true, firstPublish: false, destroy: false },
  /**
   * Every capability false; check:policy asserts it. Read-only is not safe: it still sees drafts and
   * the operator email (not stubbed, since the topbar's narrow-width measurement depends on it).
   */
  smoke: { write: false, firstPublish: false, destroy: false },
};

export class PolicyError extends Error {
  /**
   * @param {string} message
   * @param {string} policy
   */
  constructor(message, policy) {
    super(message);
    this.name = "PolicyError";
    /** @type {string} */
    this.policy = policy;
  }
}

/** @returns {string} */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * @param {string} raw
 * @returns {{ draft: boolean, firstPublished: string | null }}
 */
export function readState(raw) {
  const data = /** @type {Record<string, unknown>} */ (matter(raw).data);
  const value = data.first_published;
  const firstPublished =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : typeof value === "string" && value.trim()
        ? value.trim()
        : null;
  return { draft: data.draft === true, firstPublished };
}

/**
 * gray-matter turns an unquoted 2026-07-30 into a Date while the stamp writes a string, so both sides
 * reduce a date to its ISO day before comparing.
 *
 * @param {Record<string, unknown>} data
 * @returns {string}
 */
function comparableFrontmatter(data) {
  /** @type {Record<string, unknown>} */
  const flat = {};
  for (const key of Object.keys(data).sort()) {
    const value = data[key];
    flat[key] = value instanceof Date ? value.toISOString().slice(0, 10) : value;
  }
  return JSON.stringify(flat);
}

/**
 * Overwrites, and that is the security part: the value must come from the committed file, or an agent
 * could publish a draft by submitting first_published itself. The line edit keeps the diff to one
 * field; it is parsed back and kept only if exact, since a quoted key or a list value defeats it.
 *
 * @param {string} raw
 * @param {string | null} value
 * @returns {string}
 */
export function forceFirstPublished(raw, value) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return raw;

  const block = match[1];
  if (block === undefined) return raw;
  const rest = raw.slice(match[0].length);
  const kept = block
    .split("\n")
    .filter((line) => !/^first_published\s*:/.test(line));

  if (value) kept.push(`first_published: ${value}`);

  const edited = `---\n${kept.join("\n")}\n---\n${rest}`;

  const before = matter(raw);
  const want = { .../** @type {Record<string, unknown>} */ (before.data) };
  if (value) want.first_published = value;
  else delete want.first_published;

  try {
    const after = matter(edited);
    if (
      after.content === before.content &&
      comparableFrontmatter(/** @type {Record<string, unknown>} */ (after.data)) ===
        comparableFrontmatter(want)
    ) {
      return edited;
    }
  } catch {
    // YAML cannot read the edit. Fall through.
  }

  return matter.stringify(before.content, want);
}

/**
 * Computed here because only the prior file can tell a first publication from a republication.
 *
 * @typedef {"saved" | "published-first" | "republished" | "unpublished"} SaveOutcome
 */

/**
 * @param {{ wantsPublished: boolean, everPublished: boolean, priorDraft: boolean | null }} state
 * @returns {SaveOutcome}
 */
function classify(state) {
  if (state.wantsPublished) {
    if (!state.everPublished) return "published-first";
    return state.priorDraft === true ? "republished" : "saved";
  }
  return state.priorDraft === false ? "unpublished" : "saved";
}

/**
 * Operators may not delete: the destructive verb needs more authority than publishing, not less.
 * Throws rather than returning a boolean, so a caller that forgets to check cannot proceed.
 *
 * @param {{ actor: Actor }} options
 * @returns {void}
 * @throws {PolicyError} when the actor may not delete
 */
export function decideDelete(options) {
  const may = WRITE_CAPABILITIES[options.actor.kind];

  if (!may.write) {
    throw new PolicyError(
      "Refused: this credential is READ ONLY. It may render admin pages and it " +
        "may not change anything, delete included.",
      SMOKE_READ_ONLY_POLICY,
    );
  }

  if (!may.destroy) {
    throw new PolicyError(
      "Refused: deleting a post is reserved to the human admin. An operator " +
        "may create, edit, unpublish and republish a post, but not destroy it. " +
        "Unpublish it instead (draft: true), which is reversible, and ask " +
        "Dustin to delete it from /admin/posts if it should go for good.",
      "delete-requires-admin",
    );
  }
}

/**
 * @param {{ actor: Actor, incomingRaw: string, priorRaw: string | null }} options
 * @returns {{ raw: string, firstPublished: string | null, published: boolean, outcome: SaveOutcome }}
 */
export function decide(options) {
  const incoming = readState(options.incomingRaw);
  const prior = options.priorRaw ? readState(options.priorRaw) : null;

  // The prior FILE is the only authority, and the check is on the resulting state, not a diff.
  const priorFirstPublished = prior?.firstPublished ?? null;
  const wantsPublished = !incoming.draft;
  const everPublished = priorFirstPublished !== null;

  const may = WRITE_CAPABILITIES[options.actor.kind];

  if (!may.write) {
    throw new PolicyError(
      "Refused: this credential is READ ONLY. It may render admin pages and it " +
        "may not save a post, in any state, new or existing.",
      SMOKE_READ_ONLY_POLICY,
    );
  }

  if (!may.firstPublish && wantsPublished && !everPublished) {
    throw new PolicyError(
      "Refused: publishing a post for the first time is reserved to the human " +
        "admin. This post has never been public, so an operator cannot set " +
        "draft to false on it. Save it as a draft (draft: true) and ask Dustin " +
        "to publish it from /admin/posts. Once it has been published once, an " +
        "operator may unpublish and republish it freely.",
      "first-publish-requires-admin",
    );
  }

  const firstPublished =
    priorFirstPublished ?? (wantsPublished ? today() : null);

  return {
    raw: forceFirstPublished(options.incomingRaw, firstPublished),
    firstPublished,
    published: wantsPublished,
    outcome: classify({
      wantsPublished,
      everPublished,
      priorDraft: prior ? prior.draft : null,
    }),
  };
}
