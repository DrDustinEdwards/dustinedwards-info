import matter from "gray-matter";

/**
 * Who is asking to write, and what they are allowed to do.
 *
 * The distinction exists for three rules now: an agent may not be the one to
 * make a post public for the first time, an agent may not DELETE a post at all,
 * and the SMOKE actor may not write anything. Everything else an operator can
 * do, the admin can do, on an identical path.
 */
/**
 * @typedef {{ kind: "admin" } | { kind: "operator", id: string } | { kind: "smoke", id: string }} Actor
 */

/**
 * THE POLICY NAME THE SMOKE ACTOR IS REFUSED UNDER, stated once.
 *
 * Three places quote it: this module's refusals, the `/admin` middleware's
 * method gate, and `check:policy`. A second spelling of it would be the rule 17
 * defect in the one place a refusal has to be recognizable, so it is a constant
 * rather than four string literals that happen to agree today.
 */
export const SMOKE_READ_ONLY_POLICY = "smoke-is-read-only";

/**
 * WHAT EACH ACTOR KIND MAY DO. Keyed by the kind, so a NEW kind is a TYPECHECK
 * FAILURE rather than a silent permission.
 *
 * **THIS TABLE IS THE "BY CONSTRUCTION" IN THE SMOKE CREDENTIAL'S RULING, and
 * it replaces a shape that did not have that property.** Both refusals used to
 * read `if (actor.kind === "operator")`, which is DEFAULT-ALLOW: it names the
 * one kind that is restricted and lets every other kind fall through. Adding a
 * third kind to that shape would have handed the machine actor a full publish
 * and delete authority, in silence, with every gate green, because there is no
 * assertion anywhere that fires on a kind nobody wrote a branch for.
 *
 * A `Record` keyed by `Actor["kind"]` inverts that. `tsc` requires every member
 * of the union to have an entry, so the question "what may this new kind do"
 * has to be ANSWERED in the diff that introduces the kind. That is hard rule
 * 13's own stated idiom (a map keyed by its own union is a typecheck failure),
 * used here for the reason it was written down.
 *
 * Chosen over an exhaustive `switch` deliberately: a switch with a missing case
 * compiles, runs, and falls through to whatever follows it. The compiler only
 * objects when a `default` is written to make it object, which makes the
 * property depend on remembering to ask for it. This does not.
 *
 * @type {Readonly<Record<Actor["kind"], Readonly<{ write: boolean, firstPublish: boolean, destroy: boolean }>>>}
 */
export const WRITE_CAPABILITIES = {
  /** The single human admin. Everything. */
  admin: { write: true, firstPublish: true, destroy: true },
  /**
   * The publish agent. May create, edit, unpublish and republish; may not make
   * a post public for the first time and may not destroy one.
   */
  operator: { write: true, firstPublish: false, destroy: false },
  /**
   * THE SMOKE CREDENTIAL. Reads only, and every one of these is false.
   *
   * It exists so `check:browser` can drive the real authenticated admin plane
   * in CI instead of in Dustin's hands. It is a machine principal, its own
   * credential rather than a copy of the admin's session, and it is revocable
   * on its own with `wrangler secret delete SMOKE_TOKEN`.
   *
   * The three falses are not a configuration. They are the whole point of the
   * kind existing, and `check:policy` asserts that EVERY capability on this row
   * is false, so a fourth capability added above and granted here fails rather
   * than passing unexamined.
   *
   * ## THE RESIDUE. WHAT A READ-ONLY CREDENTIAL STILL EXPOSES
   *
   * **The claim this credential supports is BOUNDED, NOT SAFE**, and the
   * difference is the whole of this paragraph. "Read only" answers what it can
   * CHANGE. It does not answer what it can SEE, and what it can see is the
   * entire admin plane:
   *
   *   - **UNPUBLISHED DRAFTS.** `/admin/posts` lists every post whatever its
   *     state, and an edit route serves the full markdown. Hard rule 1 keeps
   *     drafts off every PUBLIC surface; this is not a public surface, and the
   *     smoke actor is inside the gate rather than outside it.
   *   - **THE OPERATOR EMAIL**, rendered in the topbar on every admin page.
   *     Deliberately not stubbed: the topbar's binding constraint at narrow
   *     widths IS that email, one unbreakable 199px token, so a smoke render
   *     showing a placeholder would move the very measurement the credential
   *     exists to take. The overflow readings have to come off the page Dustin
   *     sees, which means they come off a page carrying his address.
   *   - Media keys, trash contents, D1 counts, and the cockpit's panels.
   *
   * So a leaked SMOKE_TOKEN is a disclosure of unpublished work and one email
   * address. It is NOT a write, not a delete, not a publish, and not a path to
   * the admin's Google session. That is a real reduction in blast radius and it
   * is not zero, which is why it is written here rather than implied by the
   * word "read-only" three lines up.
   */
  smoke: { write: false, firstPublish: false, destroy: false },
};

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
 * Frontmatter values as comparable plain data.
 *
 * gray-matter runs the YAML parser, which turns an unquoted `2026-07-30` into a
 * `Date`. The stamp below writes a STRING. Comparing the two shapes directly
 * would report a difference on every post that carries a date, so both sides
 * are reduced to the same normal form first: a date becomes its ISO day, which
 * is the same reduction `readState` above already makes.
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
 * Forces `first_published` in raw markdown to the value the SERVER decided.
 *
 * This overwrites, and that is the security-critical part. The policy asks
 * whether a post has ever been published, and the answer must come from the
 * committed file, never from the request. Without this overwrite an agent could
 * publish any draft by submitting `first_published` in its own payload and
 * asserting the very fact the gate was checking.
 *
 * ## THE LINE EDIT STAYS, AND THE PARSER NOW CHECKS IT. 2026-08-28.
 *
 * The cheap path is still a line edit on the frontmatter block, for the reason
 * it always was: re-serializing through gray-matter reformats every other key
 * and turns a one-field stamp into a whole-frontmatter diff, on every publish,
 * forever.
 *
 * What was wrong with it was not the diff, it was that NOTHING CHECKED THE
 * RESULT. Two documents were FOUND that it gets wrong, and neither is exotic:
 *
 *   - a QUOTED key, `"first_published": ...`. The `^first_published` anchor
 *     misses it, so the old value survives and a second key is appended. YAML
 *     refuses a duplicate mapping key outright, so the post stops parsing and
 *     the next build fails on a file this function broke.
 *   - a LIST value, `first_published:` followed by indented items. The key
 *     line is removed and the items are orphaned onto whatever key sits above,
 *     so a post titled `A post` silently becomes `A post - 2020-01-01`. This
 *     one does not throw, which makes it the dangerous half: a stamp that
 *     renames a published post is the failure a security-critical overwrite
 *     must not have.
 *
 * Several likelier candidates did NOT discriminate, and that is worth writing
 * down so nobody re-derives the wrong hole: a folded scalar's continuation
 * lines are indented, so the anchor already misses them, and an appended key at
 * column zero correctly ends the scalar above it. YAML's indentation rules make
 * the line edit safer than it looks, and safer than it looks is not checked.
 *
 * So the parser decides. The edit is made, the result is parsed back, and it is
 * accepted only if the body is byte-identical and the frontmatter is exactly
 * the input's with this one key set or removed. Anything else falls back to a
 * full re-serialization, which is correct by construction and noisy, and that
 * is the right trade for a case that should never happen: correct always, tidy
 * almost always, and never quietly wrong.
 *
 * @param {string} raw
 * @param {string | null} value
 * @returns {string}
 */
export function forceFirstPublished(raw, value) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) return raw;

  // The capture group cannot be absent when the match succeeded. Falling back
  // to an empty block would write an empty frontmatter, so it refuses instead
  // and returns the input unchanged, which is what the `if` above already does
  // for a document with no frontmatter at all.
  const block = match[1];
  if (block === undefined) return raw;
  const rest = raw.slice(match[0].length);
  const kept = block
    .split("\n")
    .filter((line) => !/^first_published\s*:/.test(line));

  if (value) kept.push(`first_published: ${value}`);

  const edited = `---\n${kept.join("\n")}\n---\n${rest}`;

  /*
   * THE PARSER'S VERDICT ON THE EDIT ABOVE.
   *
   * `before` is the input as YAML understands it and `want` is what this
   * function was asked to produce. If the cheap edit produced exactly that, and
   * left the body alone, it is returned as written.
   */
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
    // The edit produced something YAML cannot read, which is the multi-line
    // scalar case doing exactly what it does. Fall through.
  }

  /*
   * THE FALLBACK. Correct by construction, and it reformats the frontmatter,
   * which is why it is not the primary path. `before.content` is the body
   * gray-matter already separated, so the body still cannot be touched here.
   */
  return matter.stringify(before.content, want);
}

/**
 * What a save DID to a post's public status, named.
 *
 * This is the editor's feedback, and it is computed here rather than in the UI
 * for the same reason the permission is: the answer depends on the prior FILE,
 * which no other layer has read. A route that inferred it from the checkbox
 * alone could not tell a first publication from a republication, and those are
 * the two the author most needs told apart.
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
    // Already published and edited again is an ordinary save. Only a post that
    // was actually withdrawn can be republished.
    return state.priorDraft === true ? "republished" : "saved";
  }
  // A new post created as a draft never went public, so nothing was withdrawn.
  return state.priorDraft === false ? "unpublished" : "saved";
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
 * MAY THIS ACTOR DELETE A POST?
 *
 * **Operators may not. Ruled 2026-08-17.**
 *
 * The asymmetry this closes was reachable over the network. `savePost` called
 * `decide()` and refused an operator's first publish; `deletePost` took the
 * same `actor` and used it ONLY to build the commit message, with no policy
 * path at all. So a token forbidden from making a post public was permitted to
 * destroy that same post, which is the wrong way round: least privilege says
 * the destructive verb is the one that needs MORE authority, not less.
 *
 * A separate function rather than a branch inside `decide()` because the two
 * answer different questions. `decide()` is about a publish TRANSITION and
 * needs the incoming and prior bodies to compute one; a delete has no incoming
 * body and no transition, only an actor. Folding it in would mean inventing a
 * body to ask the question. What they share, deliberately, is the module and
 * the error type: `PolicyError` already maps to 403 with `detail.policy` in the
 * operator API, so this refusal arrives named rather than as a 500.
 *
 * Throws rather than returning a boolean, so a caller that forgets to check the
 * result cannot proceed. There is no success value worth having.
 *
 * @param {{ actor: Actor }} options
 * @returns {void}
 * @throws {PolicyError} when the actor may not delete
 */
export function decideDelete(options) {
  const may = WRITE_CAPABILITIES[options.actor.kind];

  // The read-only refusal comes FIRST, so a machine actor is refused as what it
  // is rather than being told deletion is reserved to the admin, which would be
  // true and useless: it may not save either.
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

  // The prior FILE is the only authority. Anything the caller sent is ignored.
  const priorFirstPublished = prior?.firstPublished ?? null;
  const wantsPublished = !incoming.draft;
  const everPublished = priorFirstPublished !== null;

  const may = WRITE_CAPABILITIES[options.actor.kind];

  // BEFORE any transition is computed. A read-only actor is refused for every
  // save, not only for the one transition the operator rule is about, so the
  // question "which transition is this" is never reached on its behalf.
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
