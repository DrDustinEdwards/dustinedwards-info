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
    `Gate over the operator publish policy: npm run check:policy.

BOUNDARY: the decision function in isolation. It proves what the policy DECIDES, never that a
caller consults it before writing. Pure: no GitHub, no database, no network. EVERY RULE HAS A
PAIRED NEGATIVE, because a policy that only refuses has not been shown to permit anything.`,
  ],
  "scripts/check-policy.mjs#1": ["CONTRACT", "one line already; kept"],
  "scripts/check-policy.mjs#10": ["CONTRACT", "section marker, rule padding cut", `readState`],
  "scripts/check-policy.mjs#11": [
    "WHY",
    "the state the policy exists to tell apart, in one line",
    `The negative: a post withdrawn after publication is draft:true but HAS a date, which is the
state the whole policy exists to tell apart from a new draft.`,
  ],
  "scripts/check-policy.mjs#12": ["CONTRACT", "section marker, rule padding cut", `forceFirstPublished`],
  "scripts/check-policy.mjs#13": ["WHY", "one line already; kept"],
  "scripts/check-policy.mjs#14": ["CONTRACT", "section marker, rule padding cut", `The policy: operator`],
  "scripts/check-policy.mjs#15": [
    "WHY",
    "the forgery case in one line: the prior file is the only thing consulted",
    `THE FORGERY CASE. An operator submits first_published in its own payload; the prior FILE
says otherwise, and the prior file is the only thing consulted.`,
  ],
  "scripts/check-policy.mjs#16": ["WHY", "one line already; kept"],
  "scripts/check-policy.mjs#17": ["CONTRACT", "section marker, rule padding cut", `The policy: admin`],
  "scripts/check-policy.mjs#18": ["CONTRACT", "section marker, rule padding cut", `The policy: smoke, the read-only machine actor`],
  "scripts/check-policy.mjs#19": [
    "CONTRACT",
    "the claim, its two instruments and the N-1-of-N reason; the tabulated restatement cut",
    `THE CLAIM UNDER TEST: the smoke actor appears in NO WRITE BRANCH. Two halves by two
instruments, decide() and decideDelete() refusing it when RUN, and every other action refused
by the /admin method gate read out of the route source. Asserting only the first leaves the
larger half unexamined while reading like a complete answer.`,
  ],
  "scripts/check-policy.mjs#20": [
    "WHY",
    "the drift prohibition alone",
    `Driven off a TABLE: a refusal list that drifted out of step would leave a transition
permitted for the machine actor and unasserted.`,
  ],
  "scripts/check-policy.mjs#21": ["WHY", "zero-scope class, cites hard rule 10; two lines already"],
  "scripts/check-policy.mjs#23": [
    "WHY",
    "the refusal must be the one that is true of the actor",
    `THE FORGERY CASE for this actor too, and it must be refused as READ ONLY rather than as a
first-publish, because the read-only refusal is the one that is true of it.`,
  ],
  "scripts/check-policy.mjs#24": [
    "WHY",
    "iterate rather than name, so a fourth capability cannot pass unexamined",
    `Iterated rather than naming the three capabilities, so a FOURTH granted to smoke fails here
instead of passing unexamined.`,
  ],
  "scripts/check-policy.mjs#25": [
    "WHY",
    "the unfailable-condition trap in one line",
    `THE PAIRED POSITIVE, and not a formality: every assertion above is satisfied by a table in
which NOBODY may write, which takes the publish path down at a perfect score.`,
  ],
  "scripts/check-policy.mjs#26": ["WHY", "one line already; kept"],
  "scripts/check-policy.mjs#27": [
    "WHY",
    "the proximity-needle prohibition; the date it was recorded goes to Capsid",
    `THE GUARD EXPRESSION IS EXTRACTED BY WALKING BACK FROM THE EXIT, never matched near it: a
proximity needle stays satisfied by a PRINT of the name after control flow has stopped
consulting it.`,
  ],
  "scripts/check-policy.mjs#28": [
    "WHY",
    "an import is a mention not a use; the story of catching it, cut",
    `THE EXIT, located in COMMENT-STRIPPED source and NOT at the first mention, which is the
IMPORT above every if in the module. Skipped by the line it sits on, not by taking the last
occurrence, which breaks the day a second refusal is added.`,
  ],
  "scripts/check-policy.mjs#29": ["WHY", "one line already; kept"],
  "scripts/check-policy.mjs#30": [
    "WHY",
    "both zero-scope arms in two lines",
    `SCOPE, ASSERTED, twice: an extractor returning nothing reports a missing guard that is
present, and one that ran to the top of the file lets a neighbour's condition satisfy this.`,
  ],
  "scripts/check-policy.mjs#31": [
    "WHY",
    "what a denylist lets through",
    `AND IT IS NOT A DENYLIST: an equality test on POST passes everything above and lets PUT,
PATCH and DELETE through.`,
  ],
  "scripts/check-policy.mjs#32": [
    "WHY",
    "a 403 that lies",
    `REFUSED BEFORE ANYTHING RUNS. A gate firing after next() refuses the response with the write
already done, which is a 403 that lies.`,
  ],
  "scripts/check-policy.mjs#33": [
    "WHY",
    "why both files are named rather than one excluded",
    `THE OTHER DIRECTION: the smoke actor is CONSTRUCTED in exactly one place, so a caller that
believed it could write fails the day it is written rather than at the throw. TWO FILES ARE
NAMED, not one excluded, because an exclusion naming a file excludes everything else in it. A
third file still fails, which is the property.`,
  ],
  "scripts/check-policy.mjs#36": ["WHY", "zero-scope arm; two lines already"],
  "scripts/check-policy.mjs#37": [
    "WHY",
    "the unbounded-window trap and fail-closed; the plant and its date to Capsid",
    `THE ONE WAY A SMOKE GET COULD STILL 500: adminSessionContext is set for the HUMAN ADMIN ONLY
and context.get on an unset context THROWS, so a LOADER reading it is fine for Dustin and a
500 for every smoke request, on a page that renders in every other gate. SCOPED TO THE
ACTION'S BRACE-MATCHED BODY, because "after the action export begins" is a window to
end-of-file; fail closed, so a read delegated to a sibling is refused too.`,
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
    `What a save DID. Both cases current state cannot tell apart are asserted with their
negatives: a withdrawn post republished is NOT a first publication, and a live post edited
again is NOT a republication.`,
  ],
  "scripts/check-policy.mjs#47": [
    "WHY",
    "the ceremony performed twice, in two lines",
    `The negative that matters: a post published, withdrawn and published again must NOT read as
a first publication, or the editor performs the ceremony a second time.`,
  ],
  "scripts/check-policy.mjs#48": ["WHY", "one line already; kept"],
  "scripts/check-policy.mjs#49": ["WHY", "one line already; kept"],
  "scripts/check-policy.mjs#50": ["CONTRACT", "boxed heading, rule padding cut", `The Ask index is a public surface`],
  "scripts/check-policy.mjs#51": [
    "WHY",
    "least privilege and the real-module rule; the date and the narrative cut",
    `OPERATORS CANNOT DELETE. An actor refused a first publish through decide() was once
permitted to DESTROY the post over the network. Least privilege: the destructive verb needs
more authority than the publishing one, not less. Driven through the REAL predicates.`,
  ],
  "scripts/check-policy.mjs#52": [
    "WHY",
    "the property is the pair",
    `Asserted as a PAIR: the defect was not that delete was permissive in isolation, it was that
it was permissive while publish was not.`,
  ],
  "scripts/check-policy.mjs#54": [
    "WHY",
    "the predicate passing is not the call site asking",
    `AND THE CALL SITE REACHES IT: the predicate passing does not prove deletePost asks. Scoped
to its own body, because the file imports decide() for savePost.`,
  ],
  "scripts/check-policy.mjs#55": [
    "WHY",
    "the slug-probing leak a late guard leaves open",
    `BEFORE THE FILE READ. A later guard still refuses, but it lets an unauthorised caller probe
which slugs exist by the difference between two error messages.`,
  ],
  "scripts/check-policy.mjs#56": [
    "WHY",
    "why the method is the only defensible line",
    `ASK IS BILLED, SO IT MUST NOT BE REACHABLE BY A GET: a crawler, a prefetch, an unfurler or
an img src on somebody else's page all issue one without a person deciding to, and the METHOD
is the only part a third party cannot choose for us. Asserted from SOURCE.`,
  ],
  "scripts/check-policy.mjs#57": [
    "WHY",
    "why absence and a file-wide mention both pass on a defect",
    `The loader must exist and must REFUSE: asserting no loader exists passes for a route serving
GET another way, and asserting the file mentions 405 anywhere passes on a comment.`,
  ],
  "scripts/check-policy.mjs#58": [
    "WHY",
    "what a restored loader would bill on",
    `And the question is read from the BODY: a route still reading searchParams bills on a
hand-made GET the moment somebody restores a loader.`,
  ],
  "scripts/check-policy.mjs#59": [
    "WHY",
    "the attack and why order is the assertion",
    `THE ORIGIN GATE, AND ITS POSITION IS THE ASSERTION. Ask is anonymous, so this is not CSRF:
what a hostile page can do is make its own readers spend the shared budget, and the per-IP
limiter is blind because a thousand readers are a thousand IPs. Asserting the check EXISTS
passes on a version running it after the Durable Object, which is most of the cost.`,
  ],
  "scripts/check-policy.mjs#60": [
    "WHY",
    "hard rule 19's chain, why position beats presence, and the stated exclusion",
    `THE REST OF THE CHAIN: RATE, then CACHE, then BUDGET, then MODEL, which is hard rule 19's
order. All four calls exist in any arrangement, so presence passes on an action that reserves
budget before reading the cache; the ORDER is the property and the names only locate it.
Cheapest refusal first: rate is one Durable Object call, cache one KV read, budget the second
call, model the only billed step. ABSENT Origin is test/origin.test.mjs's.`,
  ],
  "scripts/check-policy.mjs#61": [
    "WHY",
    "the measured framework boundary and the four routes it leaves; the rename story cut",
    `EVERY MUTATING SURFACE TAKES THE SAME PREDICATE, measured rather than assumed:
throwIfPotentialCSRFAttack refuses a foreign origin on mutating DOCUMENT requests and does NOT
run for resource routes, which is what these four are. Asserted on the SOURCE calling the
predicate rather than on a status code, which is check:browser's to observe.`,
  ],
  "scripts/check-policy.mjs#62": [
    "WHY",
    "the exemption hard rule 9 requires, and that it is the easiest thing to tighten by accident",
    `AND THE ABSENT-ORIGIN EXEMPTION SURVIVES: a scriptless form post carries no Origin, so
refusing it breaks the no-script door hard rule 9 requires, and it is the easiest thing to
tighten by accident.`,
  ],
  "scripts/check-policy.mjs#63": [
    "WHY",
    "the work an unauthenticated caller can ask for, and the boundary",
    `REFUSED ON LENGTH BEFORE IT IS HASHED: constantTimeEqual hashes BOTH operands, so a megabyte
of bearer token is a megabyte of SHA-256 before anything has checked who is asking. Asserted
by POSITION, the instrument hard rule 19's ordering uses; source position, not runtime.`,
  ],
  "scripts/check-policy.mjs#64": [
    "WHY",
    "either half alone passes on metering both or neither",
    `AND DESCRIBE DOES NOT SPEND A RATE-LIMIT UNIT. Asserted as absence in the loader and
presence in the action, because either half alone passes on a build that meters both or
neither.`,
  ],
  "scripts/check-policy.mjs#65": [
    "WHY",
    "the raw-text escape, the no-hand-list rule and the stated exclusion",
    `EVERY JSON-LD BLOCK GOES THROUGH THE ESCAPING SERIALISER: a script element's contents are
RAW TEXT, so a title carrying the closing sequence ends the element early. FOUND BY SCANNING
rather than from a list, because the fifth emitter would be added without it. The
speculation-rules blocks are out of scope and their own test owns them.`,
  ],
  "scripts/check-policy.mjs#67": ["CONTRACT", "one line already; kept"],
  "scripts/check-policy.mjs#68": [
    "WHY",
    "why an offline half exists beside a stronger wire case that skips",
    `THE LIGHTBOX IS A REAL MODAL DIALOG, asserted on source. check:browser has the better
instrument and SKIPS, because no published post carries a body image, and a wire assertion
that never runs is not a gate. The div spelling is refused by name, because that is what this
replaced.`,
  ],
  "scripts/check-policy.mjs#69": [
    "WHY",
    "the same offline-half argument, and each property asserted by its mechanism",
    `WCAG 2.2 1.4.13 ON SOURCE, the same offline-half argument as the lightbox. Each property is
asserted by the MECHANISM that provides it rather than by a comment claiming it: a scheduled
hide, an Escape listener, and the ABSENCE of a scroll listener, the only one whose defect is a
line that exists rather than one that is missing.`,
  ],
  "scripts/check-policy.mjs#70": [
    "WHY",
    "why the two rejected spellings are rejected",
    `4.1.3: ONE role=status region, rather than controls relabelling themselves, which is a change
of NAME, or a pseudo-element, which is not in the accessibility tree.`,
  ],
  "scripts/check-policy.mjs#71": [
    "WHY",
    "assert the behaviour, not the comment claiming it",
    `And the permalink LANDS on the heading. Its comment claimed the anchor still navigated while
the code called preventDefault below it, so the assertion is on the focus move.`,
  ],
  "scripts/check-policy.mjs#72": ["CONTRACT", "section marker, rule padding cut", `the Ask index is kept in step by ship`],
  "scripts/check-policy.mjs#73": [
    "WHY",
    "why the index fell behind, and what position plus failure-path buys; the measurement to Capsid",
    `sync:content REBUILDS D1 AND BOTH FTS INDEXES AND DOES NOT TOUCH AI SEARCH, so the index
fell behind on every content ship, this site's writing landing mostly by COMMIT. Asserted on
POSITION and on the FAILURE PATH: a call before the deploy uploads to a Worker about to be
replaced, and a call nobody checks cannot fail.`,
  ],
  "scripts/check-policy.mjs#74": [
    "WHY",
    "why the upload runs last",
    `ORDER. The upload writes what the DEPLOYED Worker serves, through that Worker's bindings, so
it runs after the deploy and after the D1 sync that produced the records.`,
  ],
  "scripts/check-policy.mjs#75": [
    "WHY",
    "a discarded result cannot fail",
    `THE FAILURE PATH is what makes the step worth having: a step whose result is discarded
cannot fail, and this exists because a green ship over a stale index is the defect.`,
  ],
  "scripts/check-policy.mjs#76": [
    "WHY",
    "the window-around-an-anchor class; the plant and its date cut",
    `THE EXIT CONDITION ITSELF, never a mention of the variable near the exit: a block that still
PRINTS the miss on the way out keeps the name inside the window while control flow no longer
consults it.`,
  ],
  "scripts/check-policy.mjs#77": [
    "WHY",
    "why the version has to print first",
    `And the deploy STANDS: the record must print before the exit, or a missed sync hides the
version that is live, which is the one thing an operator needs then.`,
  ],
  "scripts/check-policy.mjs#78": [
    "WHY",
    "what five 200s are blind to, and why position is the assertion",
    `READINESS, BETWEEN THE DEPLOY AND THE FIRST WRITE. Five 200s prove the Worker answers and
are blind to a drifted Ask index, a media index that lost its rows, D1 out of step with the
repository and an empty FTS index, all of which /api/health reports. POSITION: earlier it
reports on the build being replaced, later it refuses with production half converged.`,
  ],
  "scripts/check-policy.mjs#79": [
    "WHY",
    "read the verdict from the body and act on it; why the decision is its own module",
    `THE VERDICT IS READ OUT OF THE BODY, never inferred from the status line, and it is ACTED
ON. The decision lives in readiness.mjs so node:test can drive every branch.`,
  ],
  "scripts/check-policy.mjs#80": [
    "WHY",
    "what stops the step passing against the wrong URL",
    `AND A BODY WITH NO CHECKS REFUSES: any JSON on the origin can carry ok:true, and only a
health report carries a checks array.`,
  ],
  "scripts/check-policy.mjs#81": [
    "WHY",
    "both halves and what each alone costs; the dated deadlock to Capsid",
    `BOTH HALVES: deferring without the late assertion drops the check, and asserting late
without deferring leaves the deadlock, a drifted corpus refusing at the step that runs before
its own repair.`,
  ],
  "scripts/check-policy.mjs#82": [
    "HISTORY",
    "which ruling pinned which shape and that the meaning is unchanged; the code below states the shape",
    null,
  ],
  "scripts/check-policy.mjs#83": [
    "WHY",
    "enumerate, because one name passes on a table that lost the others",
    `ALL THREE, ENUMERATED: a regex for content-drift alone passes on a table that had lost the
other two, which is how the deadlock returns without an assertion moving.`,
  ],
  "scripts/check-policy.mjs#84": [
    "WHY",
    "the needle's correctness, not the code's",
    `Upper case as well as lower: the values are capitalised, and a lower-case-only class matched
one of the three and reported the others as undeferred, which is a needle failing on correct
code.`,
  ],
  "scripts/check-policy.mjs#85": [
    "WHY",
    "the value is the test for whether a fourth check belongs",
    `EACH NAMES THE STEP THAT REPAIRS IT, which is the test for whether a fourth check belongs:
one with nothing to name has no later repair, so deferring it DROPS it.`,
  ],
  "scripts/check-policy.mjs#86": [
    "WHY",
    "existence would sit before the sync and be the deadlock again",
    `AND ASSERTED AFTER THE SYNC: a check that merely EXISTS could sit before it and would be the
deadlock again.`,
  ],
  "scripts/check-policy.mjs#87": [
    "WHY",
    "the N-1-of-N prohibition; the date it was added goes to Capsid",
    `THE MEDIA INDEX, ASSERTED SEPARATELY rather than by widening a regex: the two steps fail
independently, and an assertion satisfied by whichever is present passes on the commit that
deleted the other.`,
  ],
  "scripts/check-policy.mjs#88": [
    "WHY",
    "rule 18's repair path, and what a hand-written row makes the index",
    `RULE 18, ASSERTED RATHER THAN TRUSTED: the repair goes through the derivation, because a
tool writing rows itself would make the index a second truth.`,
  ],
  "scripts/check-policy.mjs#89": [
    "WHY",
    "a rebuild's own counters are not a verdict",
    `AND THE VERDICT IS READ BACK: rebuildMediaIndex returns what its loops think they wrote, and
only mediaIndexStatus re-enumerates the sources and reads D1 afterwards.`,
  ],
  "scripts/check-policy.mjs#90": ["CONTRACT", "section marker, rule padding cut", `the cache split, in config`],
  "scripts/check-policy.mjs#91": [
    "WHY",
    "the failure mode on each side, and why the value is a policy question check:config cannot answer",
    `WHICH ENTRYPOINT THE PLATFORM MAY CACHE, which check:config cannot judge: it reconciles the
two files and does not know which VALUE is right. A failure mode on each side: the gateway
cache ENABLED lets the platform answer without running the gateway, so readership becomes a
count of cache misses; the Renderer cache DISABLED renders every request silently.
cross_version_cache STAYS OFF so a deploy invalidates every entry, or a response can be served
from a build several generations old asking for a stylesheet the manifest no longer has.`,
  ],
  "scripts/check-policy.mjs#92": ["CONTRACT", "one line already; kept"],
  "scripts/check-policy.mjs#93": [
    "WHY",
    "absent rather than false, and why writing it would be a second owner",
    `ABSENT rather than false, and asserted as absent: writing it would be a second place to state
a default, and the default is the safe direction.`,
  ],
  "scripts/check-policy.mjs#94": [
    "CONTRACT",
    "why Ask cannot filter at query time; the dated leak goes to Capsid",
    `Drafts must never reach the AI index: /search/ask is unauthenticated and cites what it
answered from, so an uploaded draft is publicly readable by anyone who asks the right
question. The classic index filters at QUERY time and Ask cannot, so the exclusion happens at
UPLOAD time.`,
  ],
  "scripts/check-policy.mjs#96": [
    "WHY",
    "the silent-leak case in two lines",
    `The withdrawn case, which is the one that leaks silently: a post published and indexed, then
set back to draft, must be REMOVED rather than skipped on the next sync.`,
  ],
  "scripts/check-policy.mjs#97": ["WHY", "read the shipped module rather than restating; two lines already"],
  "scripts/check-policy.mjs#98": [
    "WHY",
    "the comment-satisfied anchor; the stale limit corrected to the shared tokenizer",
    `COMMENTS STRIPPED BEFORE MATCHING, and not for tidiness: a caller that stopped calling the
filter and wrote a comment EXPLAINING that it used to kept the count at two and the gate went
green on prose, which is hard rule 10's comment-satisfied anchor. The stripper is the gates'
tokenizer, so trailing comments go too and a string literal survives.`,
  ],
  "scripts/check-policy.mjs#99": [
    "HISTORY",
    "the plant proving trailing comments were unstripped, and a stripper inventory the shared tokenizer ended",
    null,
  ],
  "scripts/check-policy.mjs#100": [
    "WHY",
    "the guard's job; the dated ratio measurement goes to Capsid",
    `SCOPE, ASSERTED: an over-eager stripper empties the file while every assertion below reports
a missing filter that is present. The fraction is loose on purpose, this module being
comment-heavy.`,
  ],
  "scripts/check-policy.mjs#101": [
    "WHY",
    "the binding this gate owns, and the shape that leaks if either half goes",
    `The uploader reads askCorpusRecords, whose SQL composes visibilityClause (rule 1). What this
gate owns is the BINDING: the uploader sources from that one reader and nothing unfiltered. An
uploader that re-grew its own SELECT, or a reader that lost the clause, is the leak again.`,
  ],
  "scripts/check-policy.mjs#102": [
    "WHY",
    "compose rather than restate, and why the scope is the function body",
    `THE FILTER COMPOSES THE SHARED PREDICATE RATHER THAN RESTATING IT: the assertions above
prove it is CALLED and cannot see what it DOES, and what it did was restate the rule in a
third shape, agreeing with publiclyVisible() by inspection alone. Scoped by brace matching,
because the module's prose names both symbols.`,
  ],
  "scripts/check-policy.mjs#103": [
    "WHY",
    "the property that moved with the mechanism; the round-trip measurement to Capsid",
    `THE EXPECTED SET comes from search_docs rather than from recomputing the corpus, which cost
a large GitHub round trip on every admin page load. The property moved with it: from that
query, composing the shared predicate, and posts-only, or the records read as stale.`,
  ],
  "scripts/check-policy.mjs#106": ["CONTRACT", "where a top-level function ends here; two lines already"],
  "scripts/check-policy.mjs#107": [
    "WHY",
    "assert the binding, never one spelling of one line; the re-scoping story to Capsid",
    `ASSERTED AS THE BINDING, never as a LINE ARRANGEMENT: a needle pinning one spelling breaks
on a legitimate refactor while the property is intact.`,
  ],
  "scripts/check-policy.mjs#108": ["WHY", "both zero-scope arms; two lines already"],
  "scripts/check-policy.mjs#109": [
    "WHY",
    "the half that keeps a widening honest; the dated widening to Capsid",
    `Asserted in two halves, and the second keeps the widening honest: the paper half comes from
the module and NOT from a query this function grew.`,
  ],
  "scripts/check-policy.mjs#110": [
    "WHY",
    "the half a whole-line needle got for free",
    `AND FROM NOTHING ELSE, the half a whole-line needle got for free: recordsForPosts is the
corpus-recomputing producer this moved away from, caught anywhere in the body.`,
  ],
  "scripts/check-policy.mjs#111": [
    "WHY",
    "a neighbour composing the same predicate satisfies a character window; the plant story cut",
    `SCOPED TO THE FUNCTION BODY, never to a character window after its name: zeroState sits
directly below and composes visibilityClause itself, so a window reaching into it finds a
neighbour's compliance. That is hard rule 10's unanchored needle.`,
  ],
  "scripts/check-policy.mjs#112": [
    "WHY",
    "both zero-scope arms in two lines",
    `SCOPE, ASSERTED: an extractor returning nothing makes all three below report a missing
predicate that is present, and one returning the whole file makes them pass on a neighbour.`,
  ],
  "scripts/check-policy.mjs#113": ["CONTRACT", "section marker, rule padding cut", `Report`],
  "scripts/check-policy.mjs#114": [
    "NUMBER",
    "the floor is asserted on the line below; the seven dated re-measurements go to Capsid",
    `EXECUTED-COUNT FLOOR. This gate stands between an operator and the one operation reserved
for the human and covers hard rule 19's ordered cost chain, so a version that quietly stopped
asserting would keep its shape while nothing tested the transitions. RE-MEASURED BY RUNNING
THIS GATE, never by summing, and the floor MOVES WITH IT: slack is the defect, and one left
behind has been a third of this gate able to stop running unnoticed.`,
  ],
};
