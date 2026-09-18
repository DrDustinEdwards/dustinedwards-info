// Chunk 1: scripts/check-policy.mjs, blocks 0-114.
//
// The file is the gate over money paths and delete authority, so its prohibitions are the
// half that matters and every one of them stays. What goes is the change log written beside
// them: which session re-scoped a needle, which plant caught it, which date a ruling landed.
//
// Re-cut to wave 1's rule after the measurement: a surviving block is ONE LINE, statement then
// the because as a clause, separators keep their label and lose the dashes, and the
// justification for CHOOSING one approach over another is deleted rather than compressed.
export default {
  "scripts/check-policy.mjs#0": [
    "CONTRACT",
    "the boundary and the paired-negative rule kept; the restatement of both, cut",
    `Gate over the operator publish policy.

  npm run check:policy

BOUNDARY: the decision function in isolation, and pure. It proves what the policy DECIDES,
never that a caller consults it before writing. Every rule here comes with its paired negative,
and so does every rule added later: a policy that only refuses has not been shown to permit
anything.`,
  ],
  "scripts/check-policy.mjs#1": ["CONTRACT", "one line already; kept"],
  "scripts/check-policy.mjs#10": ["CONTRACT", "section marker, rule padding cut", `readState`],
  "scripts/check-policy.mjs#11": [
    "WHY",
    "the state the policy exists to tell apart, in one line",
    `The negative: a post withdrawn after publication is draft:true but HAS a date.`,
  ],
  "scripts/check-policy.mjs#12": ["CONTRACT", "section marker, rule padding cut", `forceFirstPublished`],
  "scripts/check-policy.mjs#13": ["WHY", "one line already; kept"],
  "scripts/check-policy.mjs#14": ["CONTRACT", "section marker, rule padding cut", `The policy: operator`],
  "scripts/check-policy.mjs#15": [
    "WHY",
    "the forgery case in one line: the prior file is the only thing consulted",
    `THE FORGERY CASE: the payload claims first_published; only the prior file is consulted.`,
  ],
  "scripts/check-policy.mjs#16": ["WHY", "one line already; kept"],
  "scripts/check-policy.mjs#17": ["CONTRACT", "section marker, rule padding cut", `The policy: admin`],
  "scripts/check-policy.mjs#18": ["CONTRACT", "section marker, rule padding cut", `The policy: smoke, the read-only machine actor`],
  "scripts/check-policy.mjs#19": [
    "CONTRACT",
    "the claim, its two instruments and the N-1-of-N reason; the tabulated restatement cut",
    `The claim: the smoke actor appears in NO WRITE BRANCH, both halves, by two instruments.`,
  ],
  "scripts/check-policy.mjs#20": [
    "WHY",
    "the drift prohibition alone",
    `Driven off a TABLE, so a refusal list that drifted cannot leave a transition unasserted.`,
  ],
  "scripts/check-policy.mjs#21": ["WHY", "zero-scope class, cites hard rule 10; two lines already"],
  "scripts/check-policy.mjs#23": [
    "WHY",
    "the refusal must be the one that is true of the actor",
    `THE FORGERY CASE here too, refused as READ ONLY, the refusal that is true of this actor.`,
  ],
  "scripts/check-policy.mjs#24": [
    "WHY",
    "iterate rather than name, so a fourth capability cannot pass unexamined",
    `Iterated rather than named, so a FOURTH capability granted to smoke fails here.`,
  ],
  "scripts/check-policy.mjs#25": [
    "WHY",
    "the unfailable-condition trap in one line",
    `THE PAIRED POSITIVE: every assertion above is satisfied by a table in which nobody writes.`,
  ],
  "scripts/check-policy.mjs#26": ["WHY", "one line already; kept"],
  "scripts/check-policy.mjs#27": [
    "WHY",
    "the proximity-needle prohibition; the date it was recorded goes to Capsid",
    `The guard is extracted by walking back from the EXIT: a proximity needle passes on a print.`,
  ],
  "scripts/check-policy.mjs#28": [
    "WHY",
    "an import is a mention not a use; the story of catching it, cut",
    `The exit is located in comment-stripped source, by the line it sits on, not by first mention.`,
  ],
  "scripts/check-policy.mjs#29": ["WHY", "one line already; kept"],
  "scripts/check-policy.mjs#30": [
    "WHY",
    "both zero-scope arms in two lines",
    `SCOPE, ASSERTED twice: an empty extract reports a present guard missing, a greedy one passes.`,
  ],
  "scripts/check-policy.mjs#31": [
    "WHY",
    "what a denylist lets through",
    `AND NOT A DENYLIST: equality on POST lets PUT, PATCH and DELETE through.`,
  ],
  "scripts/check-policy.mjs#32": [
    "WHY",
    "a 403 that lies",
    `REFUSED BEFORE ANYTHING RUNS: a gate after next() is a 403 with the write already done.`,
  ],
  "scripts/check-policy.mjs#33": [
    "WHY",
    "why both files are named rather than one excluded",
    `The other direction: the smoke actor is CONSTRUCTED in one place, and two files are NAMED.`,
  ],
  "scripts/check-policy.mjs#36": ["WHY", "zero-scope arm; two lines already"],
  "scripts/check-policy.mjs#37": [
    "WHY",
    "the unbounded-window trap and fail-closed; the plant and its date to Capsid",
    `The one way a smoke GET could still 500: adminSessionContext is unset and context.get throws.`,
  ],
  "scripts/check-policy.mjs#39": ["CONTRACT", "how a body's end is found here; two lines already"],
  "scripts/check-policy.mjs#40": ["WHY", "zero-scope arm; two lines already"],
  "scripts/check-policy.mjs#41": ["CONTRACT", "section marker, rule padding cut", `What decide() stamps`],
  "scripts/check-policy.mjs#42": ["WHY", "one line already; kept"],
  "scripts/check-policy.mjs#43": ["WHY", "one line already; kept"],
  "scripts/check-policy.mjs#44": ["WHY", "the lockout this prevents; two lines already"],
  "scripts/check-policy.mjs#45": [
    "CONTRACT",
    "the two cases state cannot tell apart, in two lines",
    `What a save DID, with both negatives: republish is not first publication, edit is not republish.`,
  ],
  "scripts/check-policy.mjs#47": [
    "WHY",
    "the ceremony performed twice, in two lines",
    `The negative that matters: a republished post must not read as a first publication.`,
  ],
  "scripts/check-policy.mjs#48": ["WHY", "one line already; kept"],
  "scripts/check-policy.mjs#49": ["WHY", "one line already; kept"],
  "scripts/check-policy.mjs#50": ["CONTRACT", "boxed heading, rule padding cut", `The Ask index is a public surface`],
  "scripts/check-policy.mjs#51": [
    "WHY",
    "least privilege and the real-module rule; the date and the narrative cut",
    `OPERATORS CANNOT DELETE: the destructive verb needs more authority than publishing, not less.`,
  ],
  "scripts/check-policy.mjs#52": [
    "WHY",
    "the property is the pair",
    `Asserted as a PAIR: the defect was delete permissive while publish was not.`,
  ],
  "scripts/check-policy.mjs#54": [
    "WHY",
    "the predicate passing is not the call site asking",
    `AND THE CALL SITE REACHES IT, scoped to its own body, since decide() is imported for savePost.`,
  ],
  "scripts/check-policy.mjs#55": [
    "WHY",
    "the slug-probing leak a late guard leaves open",
    `BEFORE THE FILE READ, or the difference between two errors tells a caller which slugs exist.`,
  ],
  "scripts/check-policy.mjs#56": [
    "WHY",
    "why the method is the only defensible line",
    `ASK IS BILLED, so no GET: a crawler, prefetch, unfurler or img src issues one unasked.`,
  ],
  "scripts/check-policy.mjs#57": [
    "WHY",
    "why absence and a file-wide mention both pass on a defect",
    `The loader must exist and REFUSE: absence passes for a route serving GET another way.`,
  ],
  "scripts/check-policy.mjs#58": [
    "WHY",
    "what a restored loader would bill on",
    `And the question is read from the BODY, or a restored loader bills on a hand-made GET.`,
  ],
  "scripts/check-policy.mjs#59": [
    "WHY",
    "the attack and why order is the assertion",
    `THE ORIGIN GATE, AND ITS POSITION IS THE ASSERTION: a hostile page spends the shared budget.`,
  ],
  "scripts/check-policy.mjs#60": [
    "WHY",
    "hard rule 19's chain, why position beats presence, and the stated exclusion",
    `THE REST OF THE CHAIN: RATE, then CACHE, then BUDGET, then MODEL, which is hard rule 19's
order. Presence passes on any arrangement; the ORDER is the property, cheapest refusing first.`,
  ],
  "scripts/check-policy.mjs#61": [
    "WHY",
    "the measured framework boundary and the four routes it leaves; the rename story cut",
    `EVERY MUTATING SURFACE TAKES THE SAME PREDICATE, measured on source rather than assumed.`,
  ],
  "scripts/check-policy.mjs#62": [
    "WHY",
    "the exemption hard rule 9 requires, and that it is the easiest thing to tighten by accident",
    `AND THE ABSENT-ORIGIN EXEMPTION SURVIVES: a scriptless form post carries none, hard rule 9.`,
  ],
  "scripts/check-policy.mjs#63": [
    "WHY",
    "the work an unauthenticated caller can ask for, and the boundary",
    `REFUSED ON LENGTH BEFORE IT IS HASHED, asserted by POSITION, hard rule 19's instrument.`,
  ],
  "scripts/check-policy.mjs#64": [
    "WHY",
    "either half alone passes on metering both or neither",
    `AND DESCRIBE SPENDS NO RATE UNIT: absence in the loader and presence in the action, both.`,
  ],
  "scripts/check-policy.mjs#65": [
    "WHY",
    "the raw-text escape, the no-hand-list rule and the stated exclusion",
    `EVERY JSON-LD BLOCK GOES THROUGH THE ESCAPING SERIALISER, found by scanning, not from a list.`,
  ],
  "scripts/check-policy.mjs#67": ["CONTRACT", "one line already; kept"],
  "scripts/check-policy.mjs#68": [
    "WHY",
    "why an offline half exists beside a stronger wire case that skips",
    `THE LIGHTBOX IS A REAL MODAL DIALOG, asserted on source because check:browser skips.`,
  ],
  "scripts/check-policy.mjs#69": [
    "WHY",
    "the same offline-half argument, and each property asserted by its mechanism",
    `WCAG 2.2 1.4.13 on source, each property asserted by its mechanism rather than by a claim.`,
  ],
  "scripts/check-policy.mjs#70": [
    "WHY",
    "why the two rejected spellings are rejected",
    `4.1.3: ONE role=status region, not a relabelled control and not a pseudo-element.`,
  ],
  "scripts/check-policy.mjs#71": [
    "WHY",
    "assert the behaviour, not the comment claiming it",
    `And the permalink LANDS on the heading: the assertion is on the focus move.`,
  ],
  "scripts/check-policy.mjs#72": ["CONTRACT", "section marker, rule padding cut", `the Ask index is kept in step by ship`],
  "scripts/check-policy.mjs#73": [
    "WHY",
    "why the index fell behind, and what position plus failure-path buys; the measurement to Capsid",
    `sync:content does not touch AI Search, so the index fell behind on every content ship.`,
  ],
  "scripts/check-policy.mjs#74": [
    "WHY",
    "why the upload runs last",
    `ORDER: the upload writes what the DEPLOYED Worker serves, so it runs after deploy and sync.`,
  ],
  "scripts/check-policy.mjs#75": [
    "WHY",
    "a discarded result cannot fail",
    `THE FAILURE PATH: a step whose result is discarded cannot fail, and stale-index ships did.`,
  ],
  "scripts/check-policy.mjs#76": [
    "WHY",
    "the window-around-an-anchor class; the plant and its date cut",
    `THE EXIT CONDITION ITSELF: a block that PRINTS the miss keeps the name inside the window.`,
  ],
  "scripts/check-policy.mjs#77": [
    "WHY",
    "why the version has to print first",
    `And the deploy STANDS: the record prints before the exit, which is what an operator needs.`,
  ],
  "scripts/check-policy.mjs#78": [
    "WHY",
    "what five 200s are blind to, and why position is the assertion",
    `READINESS, BETWEEN DEPLOY AND FIRST WRITE: five 200s are blind to what /api/health reports.`,
  ],
  "scripts/check-policy.mjs#79": [
    "WHY",
    "read the verdict from the body and act on it; why the decision is its own module",
    `THE VERDICT IS READ OUT OF THE BODY and ACTED ON; the decision lives in readiness.mjs.`,
  ],
  "scripts/check-policy.mjs#80": [
    "WHY",
    "what stops the step passing against the wrong URL",
    `AND A BODY WITH NO CHECKS REFUSES: any JSON on the origin can carry ok:true.`,
  ],
  "scripts/check-policy.mjs#81": [
    "WHY",
    "both halves and what each alone costs; the dated deadlock to Capsid",
    `BOTH HALVES: deferring without the late assertion drops the check, and the reverse deadlocks.`,
  ],
  "scripts/check-policy.mjs#82": ["HISTORY", "which ruling pinned which shape and that the meaning is unchanged; the code below states the shape", null],
  "scripts/check-policy.mjs#83": [
    "WHY",
    "enumerate, because one name passes on a table that lost the others",
    `ALL THREE, ENUMERATED: a regex for content-drift alone passes once the other two are gone.`,
  ],
  "scripts/check-policy.mjs#84": [
    "WHY",
    "the needle's correctness, not the code's",
    `Upper case as well as lower: a lower-only class failed on correct code.`,
  ],
  "scripts/check-policy.mjs#85": [
    "WHY",
    "the value is the test for whether a fourth check belongs",
    `EACH NAMES THE STEP THAT REPAIRS IT, which is the test for whether a fourth belongs.`,
  ],
  "scripts/check-policy.mjs#86": [
    "WHY",
    "existence would sit before the sync and be the deadlock again",
    `AND ASSERTED AFTER THE SYNC, or a check that merely exists is the deadlock again.`,
  ],
  "scripts/check-policy.mjs#87": [
    "WHY",
    "the N-1-of-N prohibition; the date it was added goes to Capsid",
    `THE MEDIA INDEX, ASSERTED SEPARATELY, because the two steps fail independently.`,
  ],
  "scripts/check-policy.mjs#88": [
    "WHY",
    "rule 18's repair path, and what a hand-written row makes the index",
    `RULE 18, ASSERTED: the repair goes through the derivation, never a hand-written insert.`,
  ],
  "scripts/check-policy.mjs#89": [
    "WHY",
    "a rebuild's own counters are not a verdict",
    `AND THE VERDICT IS READ BACK: only mediaIndexStatus re-enumerates and reads D1 afterwards.`,
  ],
  "scripts/check-policy.mjs#90": ["CONTRACT", "section marker, rule padding cut", `the cache split, in config`],
  "scripts/check-policy.mjs#91": [
    "WHY",
    "the failure mode on each side, and why the value is a policy question check:config cannot answer",
    `WHICH ENTRYPOINT THE PLATFORM MAY CACHE, which check:config cannot judge: gateway cache on
hides readership, Renderer cache off renders every request, cross_version on serves stale.`,
  ],
  "scripts/check-policy.mjs#92": ["CONTRACT", "one line already; kept"],
  "scripts/check-policy.mjs#93": [
    "WHY",
    "absent rather than false, and why writing it would be a second owner",
    `ABSENT rather than false: writing it would be a second place to state a safe default.`,
  ],
  "scripts/check-policy.mjs#94": [
    "CONTRACT",
    "why Ask cannot filter at query time; the dated leak goes to Capsid",
    `Drafts must never reach the AI index: Ask cannot filter at query time, so exclude at upload.`,
  ],
  "scripts/check-policy.mjs#96": [
    "WHY",
    "the silent-leak case in two lines",
    `The withdrawn case leaks silently: an indexed post set back to draft must be REMOVED.`,
  ],
  "scripts/check-policy.mjs#97": ["WHY", "read the shipped module rather than restating; two lines already"],
  "scripts/check-policy.mjs#98": [
    "WHY",
    "the comment-satisfied anchor; the stale limit corrected to the shared tokenizer",
    `COMMENTS STRIPPED BEFORE MATCHING: a comment explaining a filter that had been removed kept
the count at two, which is hard rule 10's comment-satisfied anchor.`,
  ],
  "scripts/check-policy.mjs#99": ["HISTORY", "the plant proving trailing comments were unstripped, and a stripper inventory the shared tokenizer ended", null],
  "scripts/check-policy.mjs#100": [
    "WHY",
    "the guard's job; the dated ratio measurement goes to Capsid",
    `SCOPE, ASSERTED: an over-eager stripper empties the file and every assertion below misreads.`,
  ],
  "scripts/check-policy.mjs#101": [
    "WHY",
    "the binding this gate owns, and the shape that leaks if either half goes",
    `The BINDING: the uploader sources from askCorpusRecords alone, never its own SELECT.`,
  ],
  "scripts/check-policy.mjs#102": [
    "WHY",
    "compose rather than restate, and why the scope is the function body",
    `THE FILTER COMPOSES THE SHARED PREDICATE rather than restating it in a third shape.`,
  ],
  "scripts/check-policy.mjs#103": [
    "WHY",
    "the property that moved with the mechanism; the round-trip measurement to Capsid",
    `THE EXPECTED SET comes from search_docs, not from recomputing the corpus on every load.`,
  ],
  "scripts/check-policy.mjs#106": ["CONTRACT", "where a top-level function ends here; two lines already"],
  "scripts/check-policy.mjs#107": [
    "WHY",
    "assert the binding, never one spelling of one line; the re-scoping story to Capsid",
    `ASSERTED AS THE BINDING, never as a line arrangement a legitimate refactor would break.`,
  ],
  "scripts/check-policy.mjs#108": ["WHY", "both zero-scope arms; two lines already"],
  "scripts/check-policy.mjs#109": [
    "WHY",
    "the half that keeps a widening honest; the dated widening to Capsid",
    `Asserted in two halves: the paper half comes from the module, not a query grown here.`,
  ],
  "scripts/check-policy.mjs#110": [
    "WHY",
    "the half a whole-line needle got for free",
    `AND FROM NOTHING ELSE: recordsForPosts, the producer this moved away from, caught anywhere.`,
  ],
  "scripts/check-policy.mjs#111": [
    "WHY",
    "a neighbour composing the same predicate satisfies a character window; the plant story cut",
    `SCOPED TO THE FUNCTION BODY, never a window after its name: zeroState sits below and composes
visibilityClause itself, which is hard rule 10's unanchored needle.`,
  ],
  "scripts/check-policy.mjs#112": [
    "WHY",
    "both zero-scope arms in two lines",
    `SCOPE, ASSERTED: an empty extract misreads all three below; a whole-file one passes anywhere.`,
  ],
  "scripts/check-policy.mjs#113": ["CONTRACT", "section marker, rule padding cut", `Report`],
  "scripts/check-policy.mjs#114": [
    "NUMBER",
    "the floor is asserted on the line below; the seven dated re-measurements go to Capsid",
    `EXECUTED-COUNT FLOOR. This gate covers hard rule 19's ordered cost chain and the operation
reserved for the human, so the floor MOVES WITH THE MEASUREMENT: slack is the defect.`,
  ],
};
