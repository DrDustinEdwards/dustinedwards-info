// Chunk 3: app/routes/admin.tsx, blocks 0-58. The admin layout, its gate and its shell.
//
// Same rule: every contract at 180 bytes or less, headers at ~370, separators keep their label.
//
// This file holds the plane's SECURITY contracts and they are the ones that stay: the smoke
// credential is read-only and the method allowlist is where that is enforced for every action
// (#7), the Origin check exists to cover resource routes the framework's document check never
// sees (#3), and an absent Origin is allowed. Those are prohibitions, not description.
//
// The five icon blocks (#22 to #25, #21) argued a silhouette against the others. That is a
// rejected-alternatives argument, which the calibration sends to the history document; each
// keeps one line saying what it draws.
//
// Where a block carried several prohibitions the LOAD-BEARING one stays: #3 keeps resource
// routes, the ordering and the absent-Origin exemption and loses the React Router measurement;
// #7 keeps allowlist-not-denylist and refused-before-next and loses the capability-table
// inventory; #46 keeps the no-script arrangement and loses the OverflowMenu account.
export default {
  "app/routes/admin.tsx#0": [
    "CONTRACT",
    "header: the payload boundary; the 109,318 built bytes go to the history document",
    `THE ADMIN PLANE'S CSS, and this import is what keeps it off the public plane.
This route is the layout every \`/admin/*\` child nests under, so importing here
covers the whole subtree exactly once. \`/login\` imports it too and is the one
other place that may.`,
  ],
  "app/routes/admin.tsx#1": [
    "CONTRACT",
    "the hydration boundary and the rule 9 exemption",
    `The admin plane HYDRATES, and this is the one flag that says so for the whole
/admin subtree: root renders \`<Scripts>\` only when a match carries it. The
public plane does not; this is rule 9's stated exemption.`,
  ],
  "app/routes/admin.tsx#2": [
    "CONTRACT",
    "header: the one gate, and the two doors with only one writer",
    `One gate for the whole /admin subtree, before every child loader and action.

TWO WAYS IN, AND ONLY ONE MAY WRITE. The human admin arrives with a Better Auth
session. A machine may instead present the read-only SMOKE bearer, which gets
GET and HEAD and is refused every other method here, before any child runs.`,
  ],
  "app/routes/admin.tsx#3": [
    "WHY",
    "keeps resource routes, the ordering and the absent-Origin exemption; the React Router measurement goes to the history document",
    `Covers RESOURCE ROUTES, which the framework's document check never sees: a
route with no default export is not a document request. BEFORE the session
lookup, the cheapest-first order hard rule 19 states. AN ABSENT ORIGIN IS
ALLOWED.`,
  ],
  "app/routes/admin.tsx#4": [
    "WHY",
    "why the collector is read rather than created",
    `READ rather than created: root's middleware makes one for every route and runs
first, so creating a second here would REPLACE the array root had already put in
the context and discard anything recorded before this point.`,
  ],
  "app/routes/admin.tsx#5": [
    "CONTRACT",
    "the ordering that leaves the human path untouched",
    `THE SMOKE DOOR, only reachable with no admin session. A browser carries no
\`Authorization\` header, so \`authenticateSmoke\` returns \`absent\` without
reading the secret or touching the limiter.`,
  ],
  "app/routes/admin.tsx#6": [
    "WHY",
    "why a presented credential gets an answer",
    `A PRESENTED CREDENTIAL GETS AN ANSWER, not a login page: rejected, not
configured and rate limited need three different repairs, and a 302 to /login
names none of them.`,
  ],
  "app/routes/admin.tsx#7": [
    "WHY",
    "keeps the allowlist inversion and the ordering; the capability-table inventory goes to the history document",
    `READ ONLY FOR THE WHOLE PLANE. AN ALLOWLIST, NOT A DENYLIST, the inversion
hard rule 19 is ordered for: a route answering PUT tomorrow is refused the day it
is written. Refused BEFORE \`next()\`.`,
  ],
  "app/routes/admin.tsx#8": [
    "CONTRACT",
    "why the real email is the stated residue",
    `THE SAME EMAIL THE ADMIN SEES, a stated residue rather than an oversight: the
topbar's binding constraint at narrow widths IS this string, and a placeholder
would change the measurement the credential exists to take.`,
  ],
  "app/routes/admin.tsx#9": [
    "CONTRACT",
    "one listing per request; the removed artifact reader goes to the history document",
    `Lazy and memoized: this loader wants a drift COUNT and /admin/posts wants the
full status, so sharing the reader means one listing per request rather than
two, and a route that never asks never pays.`,
  ],
  "app/routes/admin.tsx#10": [
    "WHY",
    "tagged by what STAYS; the measured gap goes to the history document",
    `This loader runs on EVERY admin request, which is why both of its calls are
named.`,
  ],
  "app/routes/admin.tsx#11": [
    "WHY",
    "why they run in parallel; the object-literal diagnosis goes to the history document",
    `IN PARALLEL, because neither reads the other's result: the only reason for the
old ordering was where the lines happened to sit.`,
  ],
  "app/routes/admin.tsx#12": [
    "CONTRACT",
    "keeps the cached-vs-fresh split; the measured variance goes to the history document",
    `THE BADGE READS A CACHED COUNT, NOT THE INDEX: \`askDriftCount\` returns from KV
and never touches AI Search. /admin/posts still calls the full reader uncached,
because the page that fixes drift must not act on a stale number.`,
  ],
  "app/routes/admin.tsx#13": [
    "CONTRACT",
    "why the context is required rather than optional",
    `The ExecutionContext travels with the env because the miss path finishes its
cache write on \`waitUntil\`. Required rather than optional, so this call site
cannot quietly go back to a floating write.`,
  ],
  "app/routes/admin.tsx#14": [
    "CONTRACT",
    "the prohibition on badging a hardcoded array; the mockup's four go to the history document",
    `Posts and Media are real rows in D1, so these two are real numbers. The nav
carries exactly the counts something has counted: a numeral in the sidebar is
read as a measurement.`,
  ],
  "app/routes/admin.tsx#15": [
    "CONTRACT",
    "why one number, and what it counts",
    `ONE number, not the status object: the badge is a count and the repair lives on
/admin/posts. It counts drift in BOTH directions, since an item the corpus does
not know about is as much a defect as a record the index lacks.`,
  ],
  "app/routes/admin.tsx#16": [
    "CONTRACT",
    "the honest rendering of no evidence",
    `NULL BECOMES 0, which renders NO BADGE rather than a clean one: an unavailable
index and an index in agreement look the same to a reader, and the alternative
is a numeral asserting agreement nobody measured.`,
  ],
  "app/routes/admin.tsx#17": [
    "CONTRACT",
    "tier 1.5, and why the number travels to the UI",
    `TIER 1.5 FORBIDS ADDING A CACHE TO HIDE A SLOW PATH WITHOUT SAYING SO, and a
source comment says it to the next engineer rather than to the operator looking
at the badge. So the number travels and the badge's own title states it.`,
  ],
  "app/routes/admin.tsx#18": [
    "CONTRACT",
    "why the total exists; the 2026-08-21 measurement goes to the history document",
    `THE LAYOUT'S OWN TOTAL, and it is what makes the other routes' arithmetic
close. The layout's marks ride on every admin response, its two big marks run in
PARALLEL and one NESTS inside the other, so summing them overcounts twice over.`,
  ],
  "app/routes/admin.tsx#19": [
    "CONTRACT",
    "header: where the state lives and the consequence that follows",
    `localStorage per the ruling: a per-device preference, not server state and not
a cookie. That has one consequence, and it is the whole reason for the script
below: the server cannot know the state, so without help the shell would render
expanded and snap narrow after hydration.`,
  ],
  "app/routes/admin.tsx#20": [
    "CONTRACT",
    "header: the paint boundary, the plane boundary and the hydration property",
    `Sets the attribute BEFORE the sidebar is painted, so nothing is corrected
afterwards. A blocking inline script, which this site otherwise avoids.

It lives in the ADMIN layout, not in root, so the public plane never carries it.
The markup does not branch, so hydration has nothing to disagree about.`,
  ],
  "app/routes/admin.tsx#21": ["CONTRACT", "already at size; carries the glyph idiom"],
  "app/routes/admin.tsx#22": [
    "WHY",
    "the silhouette argument goes to the history document",
    `A speech bubble, which is what a mention from another site is.`,
  ],
  "app/routes/admin.tsx#23": [
    "WHY",
    "the silhouette argument goes to the history document",
    `Ascending bars on a baseline, which is what the panel draws.`,
  ],
  "app/routes/admin.tsx#24": [
    "WHY",
    "the silhouette argument goes to the history document",
    `A picture: frame, horizon, sun. Not a pencil, which reads as compose, and that
is Posts' job.`,
  ],
  "app/routes/admin.tsx#25": [
    "WHY",
    "keeps the one distinction that changed the drawing",
    `Sliders, not a pencil: a pencil reads as COMPOSE, which is what Posts does.`,
  ],
  "app/routes/admin.tsx#26": [
    "CONTRACT",
    "the two claims are different",
    `\`drift\` is the ALARM, a fact about the post corpus with its repair on this
page. \`count\` is the neutral size of the section. Different claims, so they
render differently.`,
  ],
  "app/routes/admin.tsx#27": [
    "WHY",
    "the ordering reason; the unlinked-library story goes to the history document",
    `After Posts and before Tools, because it is content the posts consume rather
than an admin control.`,
  ],
  "app/routes/admin.tsx#28": [
    "CONTRACT",
    "why the label is the long one",
    `The label matches the panel heading exactly: this counts origin requests, and
anything shorter would put a claim in the sidebar that the page spends a caption
correcting.`,
  ],
  "app/routes/admin.tsx#29": [
    "CONTRACT",
    "why there is no third query",
    `NO COUNT BADGE: a pending mention is not urgent enough to make every admin page
pay for a third query. The page itself is where the queue is read.`,
  ],
  "app/routes/admin.tsx#30": [
    "CONTRACT",
    "header: the count is announced as words",
    `The accessible name for a nav item, count included as WORDS. A badge that is
only a numeral announces "Posts 3", which names no unit and reads as a position
as easily as a quantity, so the digits are decoration over this string and the
numeral itself is aria-hidden.`,
  ],
  "app/routes/admin.tsx#31": [
    "CONTRACT",
    "header: tier 1.5 stated to the operator, and why only on the drifted branch",
    `Where the CACHING IS STATED TO THE READER. A source comment says it to the next
engineer; this says it to the operator looking at the badge, who would otherwise
act on a number without knowing how old it can be.

Only on the drifted branch: a badge showing nothing has nothing to qualify.`,
  ],
  "app/routes/admin.tsx#32": ["CONTRACT", "already one line"],
  "app/routes/admin.tsx#33": [
    "CONTRACT",
    "header: one owner, and the no-script property of the folded control",
    `Sign out, in the two places the topbar renders it.

ONE STATEMENT OF THE FORM, because a copied \`<Form>\` is a second owner of the
logout route. A REAL FORM in both branches: \`menu\` changes presentation only,
so the folded control works with scripting off exactly as the wide one does.`,
  ],
  "app/routes/admin.tsx#34": [
    "CONTRACT",
    "the accessible-name defect and its repair; the measurement goes to the history document",
    `THE NAME IS "Sign out" IN BOTH VARIANTS, and it took an explicit label: the
hint is a CHILD of the button, so name-from-content swallowed it.
\`aria-describedby\` keeps the sentence as a DESCRIPTION, announced after the
name and skippable.`,
  ],
  "app/routes/admin.tsx#35": [
    "CONTRACT",
    "why the read is optional; the un-nonced history goes to the history document",
    `The CSP nonce, read OPTIONALLY: on the error boundary path the root loader
never ran, and a made-up fallback nonce would be worse than none.`,
  ],
  "app/routes/admin.tsx#36": [
    "CONTRACT",
    "the hydration boundary and what it actually keeps honest",
    `Initialised \`false\` so the hydration render matches the server's, then
corrected in a LAYOUT effect, which runs before paint. The width never depended
on this, so what it keeps honest is \`aria-expanded\`.`,
  ],
  "app/routes/admin.tsx#37": [
    "CONTRACT",
    "the focus contract",
    `It does NOT move focus: the button is the same node before and after, never
unmounted, so the browser keeps focus on it with nothing to restore.`,
  ],
  "app/routes/admin.tsx#38": ["CONTRACT", "already at size"],
  "app/routes/admin.tsx#39": ["CONTRACT", "already one line"],
  "app/routes/admin.tsx#40": ["CONTRACT", "already at size"],
  "app/routes/admin.tsx#41": [
    "WHY",
    "why it spans both columns; the old placement goes to the history document",
    `THE FULL-WIDTH HEADER, above both columns. Spanning both is what lets the mark
land at the same coordinates as the public header by construction rather than by
tuning.`,
  ],
  "app/routes/admin.tsx#42": [
    "CONTRACT",
    "the imported-never-copied rule and the gate it buys",
    `The component is imported, never copied, so check:logo covers this instance
too. It links to /admin, the home of the plane you are on.`,
  ],
  "app/routes/admin.tsx#43": ["CONTRACT", "already at size"],
  "app/routes/admin.tsx#44": [
    "CONTRACT",
    "why the wrapper exists",
    `WRAPPED so it can truncate: a bare text node cannot carry \`text-overflow\`,
and the mark beside it still identifies the plane.`,
  ],
  "app/routes/admin.tsx#45": [
    "CONTRACT",
    "why the two classes are split",
    `\`.muted\` is the colour and \`.admin-topbar-email\` is the box: the truncation
needs a selector that means THIS element.`,
  ],
  "app/routes/admin.tsx#46": [
    "CONTRACT",
    "keeps the no-script arrangement and the a11y-tree property; the OverflowMenu account goes to the history document",
    `THE FOLD. Both branches are in the document and CSS picks one, the only
arrangement that works with no script. \`display: none\` takes the hidden branch
out of the accessibility tree too, so exactly one of each is ever exposed.`,
  ],
  "app/routes/admin.tsx#47": [
    "CONTRACT",
    "why the address stays visible",
    `The signed-in address, as INFORMATION: it is the one thing the wide bar shows
that is not a control, and knowing which account you are in is why it is there.`,
  ],
  "app/routes/admin.tsx#48": [
    "WHY",
    "the placement consequence",
    `The brand moved to the topbar, which spans both columns, so the mark sits at
the same coordinates on both planes.`,
  ],
  "app/routes/admin.tsx#49": [
    "CONTRACT",
    "the null-is-not-zero prohibition",
    `\`null\` means this section HAS no count, which is not the same as a count of
zero and must not render as one.`,
  ],
  "app/routes/admin.tsx#50": [
    "CONTRACT",
    "the accessible name survives the label being hidden",
    `The accessible name is on the element, always, so it survives the label being
hidden in the rail. \`title\` is the sighted tooltip, redundant beside a visible
label and native.`,
  ],
  "app/routes/admin.tsx#51": [
    "CONTRACT",
    "the two claims and the zero rule; the collapsing alternative goes to the history document",
    `THE COUNT AND THE DRIFT BADGE ARE DIFFERENT CLAIMS, so they are different
elements and both can be present: the count is how big the section is, the badge
is an alarm. A count of ZERO still renders, unlike the badge.`,
  ],
  "app/routes/admin.tsx#52": [
    "CONTRACT",
    "why zero renders nothing here",
    `Zero renders NOTHING rather than a 0 badge: a permanent badge stops being a
signal. aria-hidden, because the name above already says it in words.`,
  ],
  "app/routes/admin.tsx#53": [
    "WHY",
    "what the zone means",
    `The foot is a ZONE, not two more sections: both items leave the list of places
you can be.`,
  ],
  "app/routes/admin.tsx#54": [
    "CONTRACT",
    "the accessible name carries what the glyph cannot",
    `The accessible name says it in words, because an arrow leaving a box is not a
name.`,
  ],
  "app/routes/admin.tsx#55": [
    "CONTRACT",
    "the direction rule and the verb rule; the centring argument goes to the history document",
    `The chevron points at what pressing it DOES: left to collapse, right to expand,
one glyph rotated by CSS so the markup does not branch. Its label is the VERB.`,
  ],
  "app/routes/admin.tsx#56": ["CONTRACT", "already at size"],
  "app/routes/admin.tsx#57": ["CONTRACT", "already one line"],
  "app/routes/admin.tsx#58": [
    "CONTRACT",
    "what the id is for; the gate that found it goes to the history document",
    `\`id="main"\` for root's unconditional skip link.`,
  ],
};
