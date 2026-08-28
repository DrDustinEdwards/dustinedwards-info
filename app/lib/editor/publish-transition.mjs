/**
 * What the editor's primary button DOES, per post state.
 *
 * This is the UI half of the publish story and it is deliberately separate from
 * publish-policy.mjs, which is the server half. The policy module answers "was
 * this write allowed, and what did it do", from the prior FILE, after the fact.
 * This one answers "what should the button say, and what does pressing it
 * send", from the loader's view of current state, before the fact. They agree
 * by construction because they are driven by the same two facts: whether the
 * post is a draft right now, and whether it has ever been public.
 *
 * It lives in its own module, as .mjs, for the reason query.mjs and
 * publish-policy.mjs do: a gate can import the module the Worker imports and
 * assert the table directly. A transition table that only existed inside JSX
 * could be checked by rendering and nothing else, and rendering cannot see what
 * a button does on click.
 *
 * `wantsDraft` is the whole contract with the server. `fieldsFromForm` reads
 * `form.get("draft") === "on"`, so a transition with wantsDraft true must send
 * `draft=on` and one with wantsDraft false must send NO `draft` key at all.
 * Nothing else about the payload changes between transitions.
 */

/**
 * @typedef {"draft" | "scheduled" | "published"} PostState
 * @typedef {{
 *   id: string,
 *   label: string,
 *   wantsDraft: boolean,
 *   ceremony: boolean,
 *   danger: boolean,
 * }} Transition
 */

/** @type {Transition} */
const SAVE_DRAFT = {
  id: "save-draft",
  label: "Save draft",
  wantsDraft: true,
  ceremony: false,
  danger: false,
};

/**
 * The transition on a post that is already public: it UPDATES what the reader
 * sees.
 *
 * Named for the transition rather than for the mechanism, which is what ruling
 * 4 asks of every primary. It read "Save changes" until 2026-08-01, and that
 * was the one label in this table that named what the button does to the
 * REPOSITORY rather than what it does to the site. The plumbing was already
 * right: the component renders `primary.label` and check:admin-ui derives its
 * expectation from this same table, so correcting the string here corrects both
 * without touching either.
 *
 * The id stays `save`, so the payload, the policy weld and the gate fixture are
 * all untouched.
 *
 * @type {Transition}
 */
const SAVE_CHANGES = {
  id: "save",
  label: "Update",
  wantsDraft: false,
  ceremony: false,
  danger: false,
};

/** @type {Transition} */
const UNPUBLISH = {
  id: "unpublish",
  label: "Revert to draft",
  wantsDraft: true,
  ceremony: false,
  // Not destructive, but it takes something off the public site, which is the
  // one secondary action worth colouring.
  danger: true,
};

/**
 * The ordered transitions for a post, primary first.
 *
 * The primary always NAMES what it does, which is the point of the state
 * machine replacing a checkbox: a tickbox labelled "draft" states a field, and
 * the author has to do the mapping to "this goes live" themselves. Saving in
 * place is always available and is never the primary on a draft, because on a
 * draft the interesting transition is publication and burying it under a
 * generic Save is how a post sits unpublished for a week.
 *
 * NON-EMPTY BY CONSTRUCTION, and the return type says so. Both arms below
 * return two transitions, and the caller reads `transitions[0]` as the primary
 * button. Typed as `Transition[]` that read is possibly-undefined and the
 * button label would have been asserted non-null at four call sites; typed as a
 * non-empty tuple it is the function that carries the guarantee, which is where
 * the guarantee actually lives.
 *
 * @param {PostState} state
 * @param {boolean} everPublished
 * @returns {[Transition, ...Transition[]]}
 */
export function transitionsFor(state, everPublished) {
  if (state === "draft") {
    return [
      {
        id: everPublished ? "republish" : "publish",
        label: everPublished ? "Republish" : "Publish",
        wantsDraft: false,
        // Only a post that has NEVER been public gets the ceremony. A
        // republication is putting back something that was already there, and
        // asking twice for it would train the author to click through.
        ceremony: !everPublished,
        danger: false,
      },
      SAVE_DRAFT,
    ];
  }
  // Published and scheduled behave identically here: both are `draft: false`
  // already, so the only transition left is withdrawal. What separates them is
  // publish_at, which the schedule control owns, not this table.
  return [SAVE_CHANGES, UNPUBLISH];
}

/**
 * The state the loader should report, from the two stored facts.
 *
 * Same test `publiclyVisible()` runs and the same one the posts index derives
 * its pill from, so the editor and the list can never disagree about whether a
 * post is live. Takes `now` rather than reading the clock, because it is called
 * on the server and a component that recomputed it would hydrate a different
 * word.
 *
 * @param {{ draft: boolean, publishAt: string }} fields
 * @param {number} now epoch milliseconds
 * @returns {PostState}
 */
export function stateOf(fields, now) {
  if (fields.draft) return "draft";
  if (!fields.publishAt) return "published";
  const at = Date.parse(fields.publishAt);
  // An unparseable publish_at is not a schedule. Treating it as one would hide
  // a live post behind a date nothing can read.
  if (Number.isNaN(at)) return "published";
  return at > now ? "scheduled" : "published";
}
