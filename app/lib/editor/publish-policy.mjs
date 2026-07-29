import matter from "gray-matter";

/**
 * Who is asking to write, and what they are allowed to do.
 *
 * The distinction exists for exactly one rule: an agent may not be the one to
 * make a post public for the first time. Everything else an operator can do,
 * the admin can do, and the code path is identical.
 */
/**
 * @typedef {{ kind: "admin" } | { kind: "operator", id: string }} Actor
 */

/** A write refused by policy rather than by a content gate. */
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

/** Today, UTC, as YYYY-MM-DD. Matches how the editor stamps `updated`. @returns {string} */
export function today() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Reads `draft` and `first_published` out of raw markdown without rendering it.
 *
 * Rendering a post to answer a policy question would mean running the whole
 * markdown pipeline before deciding whether the write is even allowed. This
 * parses frontmatter only.
 */
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
 * Forces `first_published` in raw markdown to the value the SERVER decided.
 *
 * This overwrites, and that is the security-critical part. The policy asks
 * whether a post has ever been published, and the answer must come from the
 * committed file, never from the request. Without this overwrite an agent could
 * publish any draft by submitting `first_published` in its own payload and
 * asserting the very fact the gate was checking.
 *
 * Written as a line edit on the frontmatter block rather than a gray-matter
 * re-serialisation, because re-serialising would reformat every other key and
 * turn a one-field stamp into a whole-file diff.
 */
/**
 * @param {string} raw
 * @param {string | null} value
 * @returns {string}
 */
export function forceFirstPublished(raw, value) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return raw;

  const block = match[1];
  const rest = raw.slice(match[0].length);
  const kept = block
    .split("\n")
    .filter((line) => !/^first_published\s*:/.test(line));

  if (value) kept.push(`first_published: ${value}`);

  return `---\n${kept.join("\n")}\n---\n${rest}`;
}

/**
 * Decides what a write is allowed to do, and what `first_published` becomes.
 *
 * `priorRaw` is the file as it exists in the repository right now, or null for
 * a new post. It is the only source consulted for the prior published state.
 *
 * The rule: an operator may create, edit, unpublish and republish. It may not
 * perform a post's FIRST transition to draft:false. Grounds are in
 * dustinedwards/decisions.md: first publication is the moment a draft becomes a
 * public claim under Dustin's name, and it reaches feeds, the sitemap, search
 * and the AI index. Everything after it is editing something already public.
 *
 * Note this is checked on the RESULTING state, not on a diff. An operator
 * creating a post with draft:false in one shot is a first publication and is
 * refused, exactly like flipping an existing draft.
 */
/**
 * @param {{ actor: Actor, incomingRaw: string, priorRaw: string | null }} options
 * @returns {{ raw: string, firstPublished: string | null, published: boolean }}
 */
export function decide(options) {
  const incoming = readState(options.incomingRaw);
  const prior = options.priorRaw ? readState(options.priorRaw) : null;

  // The prior FILE is the only authority. Anything the caller sent is ignored.
  const priorFirstPublished = prior?.firstPublished ?? null;
  const wantsPublished = !incoming.draft;
  const everPublished = priorFirstPublished !== null;

  if (options.actor.kind === "operator" && wantsPublished && !everPublished) {
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
  };
}
