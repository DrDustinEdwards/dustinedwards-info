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
 * `wantsDraft` is the whole contract with the server, and THE BUTTON THAT WAS
 * PRESSED IS WHAT CARRIES IT, since 2026-09-03. Each transition submits its own
 * `id` as the form's `intent`, and `fieldsFromForm` derives `draft` from that
 * intent through `draftForIntent` below. Nothing else about the payload changes
 * between transitions.
 *
 * ## WHY IT IS THE SUBMITTER AND NOT A FIELD
 *
 * It was a hidden `draft` input that each button flipped in its own `onClick`,
 * imperatively, through a ref. That reproduced a checkbox exactly and it made
 * every publication transition DEPEND ON SCRIPT: with scripting off no handler
 * runs, so the input submits whatever the server rendered it as, and the button
 * the author pressed has no effect on the request at all. Three transitions
 * were wrong at once, and two of them were wrong SILENTLY:
 *
 *   - Publish, on a never-published draft, could not be reached at all: the
 *     primary was `type="button"` and both real submits lived inside a
 *     `<dialog>`.
 *   - Republish sent `draft=on`, because the post IS a draft and the input was
 *     rendered enabled. The post was saved as a draft and the editor said
 *     "Saved".
 *   - Revert to draft sent NO `draft` key, because the post is public and the
 *     input was rendered disabled. The post stayed live and the editor said
 *     "Saved".
 *
 * A submitter's name and value are the one part of a form a browser sends
 * because of what was PRESSED rather than because of what was RENDERED. Putting
 * the transition there is what makes the button mean the same thing with and
 * without script, and it is why there is no longer a `draft` input to flip.
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
 * right: the component renders `primary.label`, so correcting the string here
 * corrects the button without touching it.
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
  // one secondary action worth coloring.
  danger: true,
};

/**
 * The ordered transitions for a post, primary first.
 *
 * The primary always NAMES what it does, which is the point of the state
 * machine replacing a checkbox: a tickbox labeled "draft" states a field, and
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
 * THE INTENT A CONFIRMED FIRST PUBLICATION SENDS, and the only one that is not
 * a transition id.
 *
 * A first publication is the one transition that asks twice, so it needs two
 * distinguishable requests: `publish` is the ASK and this is the ANSWER. The
 * difference has to live in the submitter for the same reason the draft flag
 * does, because the confirmation is worth exactly as much as the no-script path
 * that can express it. A hidden field armed on click would have reproduced the
 * defect this module was rewritten to remove.
 *
 * Both mean draft:false. Only this one satisfies `savePost`'s ceremony check.
 */
export const PUBLISH_CONFIRMED_INTENT = "publish-confirmed";

/**
 * WHAT `draft` A SUBMITTED INTENT MEANS. The server's half of the contract
 * above.
 *
 * Keyed by the transition ids `transitionsFor` hands out, plus the confirmed
 * publish. Derived from the table rather than restated, so a transition whose
 * `wantsDraft` changes cannot leave a second copy of the old answer behind:
 * rule 17, on the one value the whole publish story turns on.
 *
 * @type {Readonly<Record<string, boolean>>}
 */
export const DRAFT_BY_INTENT = Object.freeze(
  Object.fromEntries([
    ...[
      ...transitionsFor("draft", false),
      ...transitionsFor("draft", true),
      ...transitionsFor("published", true),
    ].map((transition) => [transition.id, transition.wantsDraft]),
    [PUBLISH_CONFIRMED_INTENT, false],
  ]),
);

/**
 * Reads the draft flag out of the intent, FAILING CLOSED.
 *
 * An intent this table does not know is a draft, and that is the safe direction
 * rather than the tidy one: the failure of an unrecognised intent must be a
 * post that stays private, never one that goes public. `handleEditorAction`
 * refuses an unknown intent outright before this matters, so the fallback
 * guards the case where a second caller appears and forgets to.
 *
 * @param {string | null} intent
 * @returns {boolean}
 */
export function draftForIntent(intent) {
  if (intent === null) return true;
  return DRAFT_BY_INTENT[intent] ?? true;
}

/**
 * The intent for "commit this, and change nothing about who can see it".
 *
 * Cmd+S submits with no submitter, so it cannot carry a transition the way a
 * button does and has to name one itself. The one it names is the transition
 * whose `wantsDraft` already equals the post's current state, which is what
 * saving in place means: a draft stays a draft, a public post stays public.
 *
 * Stated as a lookup on the table rather than as two literals, so it cannot
 * drift from the ids the buttons send.
 *
 * @param {PostState} state
 * @returns {string}
 */
export function saveInPlaceIntent(state) {
  const wantsDraft = state === "draft";
  // `everPublished` does not change which transition saves in place: both
  // arms of the table carry one for each value of `wantsDraft`. false is
  // passed because a fresh draft is the state with the fewest assumptions.
  const list = transitionsFor(state, false);
  const match = list.find((transition) => transition.wantsDraft === wantsDraft);
  // Non-null by construction: every arm above offers both.
  return match ? match.id : SAVE_DRAFT.id;
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
