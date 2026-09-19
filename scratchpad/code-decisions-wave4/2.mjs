// Chunk 2: app/components/admin/post-editor.tsx, blocks 0-64. The three-region editor.
//
// Same rule as chunk 1: every contract at 180 bytes or less, function and component headers at
// the calibration's ~370, separators keep their label and lose the dashes.
//
// This file's protected class is the no-script path, and it is unusually load-bearing: the
// textarea IS the editor with nothing loaded (#52), the zero-JS render and image path exist
// only for that reader (#44, #53), scheduling is script-only because a datetime-local means
// two different instants in the two worlds (#48), and the frontmatter controls sit in the page
// rather than the drawer because a <dialog> needs script to open (#55). Those stay.
//
// Where a block carried several prohibitions the LOAD-BEARING one stays, named so the loss is
// visible: #24 keeps enhancement-not-a-gate and the pathname comparison, losing the
// beforeunload half; #33 keeps the buffer rewrite, losing the dismissed-offer hazard; #31 keeps
// the explicit intent and hard rule 13, losing the 2026-08-01 discovery.
export default {
  "app/components/admin/post-editor.tsx#0": [
    "CONTRACT",
    "header: the three regions and the payload contract; the checkbox era and the baseline move go to the history document",
    `The three-region post editor: a sticky command bar, a writing canvas, and a
settings drawer holding everything that is not writing. The body is still a
textarea.

THERE IS NO \`draft\` FIELD. The transition rides in the submitter's \`intent\`,
because a payload assembled by click handlers cannot be sent by a browser that
is not running them.`,
  ],
  "app/components/admin/post-editor.tsx#1": [
    "CONTRACT",
    "the ruling 6 boundary and what the no-script reader keeps",
    `Ruling 6: editor machinery never reaches a public-plane bundle, and this
dynamic import is the chunk boundary that makes it true. It also means the
first paint is the textarea below, which is what a reader with no script keeps.`,
  ],
  "app/components/admin/post-editor.tsx#2": ["CONTRACT", "already one line"],
  "app/components/admin/post-editor.tsx#3": [
    "NUMBER",
    "why this interval and not a second",
    `Thirty seconds against a value that reads in whole minutes: the label can lag
its own truth by at most half the smallest unit it shows, and a one-second tick
would re-render the bar sixty times to change the text once.`,
  ],
  "app/components/admin/post-editor.tsx#4": [
    "CONTRACT",
    "header: the adjacency rule that stops it reading as a save",
    `Ruling 3's copy, as a pure function so it cannot drift into the JSX.

Rendered ONLY beside "Unsaved changes". That adjacency is what stops it reading
as a save: the buffer is local and uncommitted, and nothing here uses the word
saved. Under a minute is "just now", the honest form for a value that rounds
down.`,
  ],
  "app/components/admin/post-editor.tsx#5": ["CONTRACT", "already one line"],
  "app/components/admin/post-editor.tsx#6": [
    "CONTRACT",
    "header: why it strips rather than transliterates",
    `Title to slug, matching the shape the save gate accepts and nothing more.
Deliberately conservative: it strips rather than transliterates, because a wrong
guess at a non-ASCII character lands in a permanent URL. The field stays
editable.`,
  ],
  "app/components/admin/post-editor.tsx#7": ["CONTRACT", "already one line"],
  "app/components/admin/post-editor.tsx#8": ["CONTRACT", "already one line"],
  "app/components/admin/post-editor.tsx#9": ["CONTRACT", "already one line"],
  "app/components/admin/post-editor.tsx#10": ["CONTRACT", "already one line"],
  "app/components/admin/post-editor.tsx#11": [
    "CONTRACT",
    "the no-script property: server state, so the step is in the first byte",
    `Whether the action refused an unconfirmed first publication. Server state, so
the step exists in the first byte of HTML and needs nothing to run to appear.`,
  ],
  "app/components/admin/post-editor.tsx#12": [
    "CONTRACT",
    "header: the prohibition on rewriting a chosen slug",
    `Whether the author has taken the slug over. Until they do it tracks the title,
which is what makes the new-post flow one field. The moment they type in it, it
stops moving: silently rewriting a slug somebody chose would change a URL they
had already decided on.`,
  ],
  "app/components/admin/post-editor.tsx#13": [
    "CONTRACT",
    "why a second input is needed; the unused-savedAt story goes to the history document",
    `The clock the buffer age is measured against, ticked ONLY while dirty. A
relative time needs a second input that changes on its own, which is this.`,
  ],
  "app/components/admin/post-editor.tsx#14": [
    "CONTRACT",
    "the two nulls that must not read the same",
    `Whether a persist has been ATTEMPTED, which \`savedAt\` alone cannot say:
\`writeBuffer\` returns null both before it has ever run and when storage refuses
it, and saying so beats pretending.`,
  ],
  "app/components/admin/post-editor.tsx#15": [
    "CONTRACT",
    "why the editor states it",
    `The sha a revision was loaded from, or null. Loading old content changes what
the buffer and the save mean, and an author who walked away mid-task must not
come back to a document that silently is not the current one.`,
  ],
  "app/components/admin/post-editor.tsx#16": ["CONTRACT", "already one line"],
  "app/components/admin/post-editor.tsx#17": ["CONTRACT", "already one line"],
  "app/components/admin/post-editor.tsx#18": ["CONTRACT", "already at size; carries the never-commits prohibition"],
  "app/components/admin/post-editor.tsx#19": [
    "CONTRACT",
    "the bit that separates a failure from a first run",
    `\`bufferTried\` separates "the net failed" from "the net has not run yet". Both
leave \`savedAt\` null, and without it the bar would stay silent through a real
storage failure to avoid crying wolf before the first persist.`,
  ],
  "app/components/admin/post-editor.tsx#20": ["CONTRACT", "already at size"],
  "app/components/admin/post-editor.tsx#21": [
    "WHY",
    "the prohibition on automatic restore",
    `Offered only when the buffer differs from what the server just handed back.
Restoring is never automatic: silently replacing committed content with older
local text is the surprise this exists to prevent.`,
  ],
  "app/components/admin/post-editor.tsx#22": ["CONTRACT", "already at size"],
  "app/components/admin/post-editor.tsx#23": ["CONTRACT", "already at size"],
  "app/components/admin/post-editor.tsx#24": [
    "CONTRACT",
    "keeps enhancement-not-a-gate and the pathname comparison; the beforeunload half goes to the history document",
    `An ENHANCEMENT, not a gate: nothing here refuses a save, and with scripting off
none of it runs. The pathname comparison lets a save's own redirect through,
which the flag it is about to clear would otherwise block.`,
  ],
  "app/components/admin/post-editor.tsx#25": [
    "WHY",
    "why a stale block is released",
    `A block that is no longer warranted is RELEASED rather than left standing: the
state is the router's, so a \`dirty\` that goes false underneath would leave the
author answering a question about changes that no longer exist.`,
  ],
  "app/components/admin/post-editor.tsx#26": [
    "WHY",
    "the overlap this avoids; the dependency reasoning goes to the history document",
    `Ticks ONLY while dirty. A clean editor's bar already reads "Saved <sha>", and a
second freshness line there would leave the reader working out which one is
about the file.`,
  ],
  "app/components/admin/post-editor.tsx#27": [
    "CONTRACT",
    "the hydration boundary and where the preference lives",
    `A browser preference, not a fact about the post, so it lives in localStorage
and never reaches the server. Read after mount rather than during render, so the
server and the first client paint agree.`,
  ],
  "app/components/admin/post-editor.tsx#28": ["CONTRACT", "already at size"],
  "app/components/admin/post-editor.tsx#29": ["CONTRACT", "already at size"],
  "app/components/admin/post-editor.tsx#30": [
    "CONTRACT",
    "header: the one-renderer claim and the stale-response guard",
    `The exact preview, debounced. It posts the body to an admin-only route that
renders it through \`pipeline.mjs\`, the module the build and the Worker import,
so this is not an approximation of the published page; it IS the published
markup.

A sequence number guards the response, because a fast typist can have two
renders in flight and the slower one can land last.`,
  ],
  "app/components/admin/post-editor.tsx#31": [
    "CONTRACT",
    "header: the explicit intent and hard rule 13; the 2026-08-01 discovery goes to the history document",
    `Cmd+S SAVES, and it can never do anything else: it submits the form directly,
naming the transition that preserves publication status rather than changing it.

IT SENDS THE IN-PLACE INTENT EXPLICITLY, by enabling a disabled hidden field
just before submitting. An absent intent on a WRITE path would let a malformed
POST perform a write, which is hard rule 13. The field is DISABLED at rest, so a
button submit sends only the submitter's own intent.

No keyboard shortcut opens the ceremony.`,
  ],
  "app/components/admin/post-editor.tsx#32": ["CONTRACT", "already at size"],
  "app/components/admin/post-editor.tsx#33": [
    "CONTRACT",
    "keeps ruling 1 and the buffer rewrite; the dismissed-offer hazard goes to the history document",
    `Ruling 1: a revision LOADS, it does not write, and everything below is
\`setState\`. The buffer is rewritten immediately, so a tab closed after a restore
cannot offer to recover the author out of it.`,
  ],
  "app/components/admin/post-editor.tsx#34": ["CONTRACT", "already at size"],
  "app/components/admin/post-editor.tsx#35": [
    "CONTRACT",
    "the modality prohibition, which is the accessibility half",
    `\`role="alert"\` rather than a \`<dialog>\`: the navigation is already stopped by
the router, so nothing needs modality, and a modal would trap focus around a
question the author can answer by continuing to type.`,
  ],
  "app/components/admin/post-editor.tsx#36": [
    "CONTRACT",
    "why the value is carried at all",
    `Server-owned, carried only so a browser save PRESERVES it: \`serializePost\`
writes exactly the keys it is handed, so a value this form did not carry would
be dropped and a published post would read as never published.`,
  ],
  "app/components/admin/post-editor.tsx#37": [
    "CONTRACT",
    "why this one stays hidden; the B004 relay list goes to the history document",
    `\`updated\` stays a hidden input because it is the one key the author does not
own: the build derives it from the last commit and the editor stamps it on save.`,
  ],
  "app/components/admin/post-editor.tsx#38": [
    "WHY",
    "the no-script defect the absence fixes",
    `THERE IS NO \`draft\` FIELD, and its absence is the fix. Flipped by an onClick,
it meant a scriptless request carried the post's current state instead of the
transition the author pressed, and all three transitions were wrong.`,
  ],
  "app/components/admin/post-editor.tsx#39": ["CONTRACT", "separator: label kept, dashes dropped", `Region 1: the command bar`],
  "app/components/admin/post-editor.tsx#40": [
    "CONTRACT",
    "the required-and-hidden prohibition, which is why the two conditions are one",
    `Gated on CodeMirror having mounted, and not for tidiness: in the preview layout
the write pane is \`display:none\`, and a REQUIRED control that is not displayed
blocks submission with a message the author can neither see nor reach.`,
  ],
  "app/components/admin/post-editor.tsx#41": [
    "CONTRACT",
    "why it is an element rather than prose; the wrapping measurement goes to the history document",
    `Dirty state as a first-class element rather than a line of prose at the bottom
of a form: it is the one thing the author checks before closing the tab.`,
  ],
  "app/components/admin/post-editor.tsx#42": [
    "CONTRACT",
    "the render conditions and the harness property",
    `Renders only while dirty and only once a persist has happened, so the clean
state keeps saying "Saved <sha>" alone. Nothing renders on the server, so the
static harness render is unchanged and this adds no submission.`,
  ],
  "app/components/admin/post-editor.tsx#43": [
    "CONTRACT",
    "the absent-safety-net rule and the tint budget",
    `An absent safety net must say so. MUTED, not warning: its neighbour is already
warning-tinted whenever this renders, and two warning items side by side read as
two problems rather than one fact qualifying another.`,
  ],
  "app/components/admin/post-editor.tsx#44": [
    "CONTRACT",
    "the no-script path and why it is removed rather than hidden",
    `The zero-JS render: with no script the layout toggle cannot render and this
submit is the ONLY way to see rendered output. REMOVED rather than hidden
because, unlike the textarea, it carries no value the save path needs.`,
  ],
  "app/components/admin/post-editor.tsx#45": ["CONTRACT", "already at size; carries the accessible-name rule"],
  "app/components/admin/post-editor.tsx#46": [
    "CONTRACT",
    "separator: label kept, dashes dropped",
    `Region 2: the canvas`,
  ],
  "app/components/admin/post-editor.tsx#47": [
    "CONTRACT",
    "the live-region guarantees",
    `Always in the DOM so the live region exists before its content does, polite
because every message follows a submit the author just made, and persistent
until the next action.`,
  ],
  "app/components/admin/post-editor.tsx#48": [
    "CONTRACT",
    "keeps the two-meanings prohibition; the delete-confirmation contrast goes to the history document",
    `INSIDE the editing form: a publish re-sends the whole post. Scheduling is
script-only rather than silently wrong, because a datetime-local reads as the
author's local time in the browser and as UTC on the server.`,
  ],
  "app/components/admin/post-editor.tsx#49": [
    "CONTRACT",
    "ruling 1 made visible; the tint reasoning goes to the history document",
    `The editor is holding old content and nothing has been written, so it says
both: an author returning to this tab must not mistake a loaded revision for the
live post.`,
  ],
  "app/components/admin/post-editor.tsx#50": [
    "CONTRACT",
    "the one-spelling rule; the shipped no-op goes to the history document",
    `DERIVED FROM SLUG_PATTERN, never a third spelling, and the anchors are
stripped at the constant rather than here.`,
  ],
  "app/components/admin/post-editor.tsx#51": [
    "CONTRACT",
    "why the bound is its own attribute, which is the no-script half",
    `The other half of the rule, from the same module. An HTML pattern cannot carry
a length without a lookahead, so the bound is its own attribute, which is also
what makes it work with scripting off.`,
  ],
  "app/components/admin/post-editor.tsx#52": [
    "CONTRACT",
    "the no-script path and the required-and-hidden prohibition",
    `THE SUBMITTED FIELD, always, and it stays in the DOM because it is also the
no-script path: with nothing loaded, this IS the editor. \`required\` drops once
CodeMirror mounts, since a hidden required control blocks submission unreachably.`,
  ],
  "app/components/admin/post-editor.tsx#53": [
    "CONTRACT",
    "the zero-JS image path and the payload guarantee",
    `The zero-JS image path, and ONLY that: once CodeMirror is mounted the same job
is done by drag-drop, paste and the toolbar. It contributes nothing to the
payload in either state.`,
  ],
  "app/components/admin/post-editor.tsx#54": [
    "CONTRACT",
    "separator: label kept, dashes dropped",
    `Region 2b: the frontmatter controls`,
  ],
  "app/components/admin/post-editor.tsx#55": [
    "CONTRACT",
    "the no-script reason these are not in the drawer",
    `IN THE PAGE, not in the drawer, because the drawer is a \`<dialog>\` that only
opens with script and these have to be usable without it.`,
  ],
  "app/components/admin/post-editor.tsx#56": [
    "CONTRACT",
    "separator: label kept, dashes dropped",
    `Region 3: the settings drawer`,
  ],
  "app/components/admin/post-editor.tsx#57": [
    "CONTRACT",
    "header: the untouched-HTML claim and the frame isolation; the 2026-08-01 measurement goes to the history document",
    `The live preview, in a sandboxed frame.

The HTML is passed through UNTOUCHED, because the whole claim of ruling 3 is
that what you see is what publishes; sanitising here would void it.

So the isolation is the FRAME, not the markup. \`sandbox\` with no
\`allow-scripts\` and no \`allow-same-origin\` means nothing inside can execute,
reach this document or navigate the parent. That is not belt and braces: the
pipeline passes \`javascript:\` URLs through from ordinary markdown links.`,
  ],
  "app/components/admin/post-editor.tsx#58": [
    "CONTRACT",
    "the no-second-copy rule",
    `\`.post\` and \`.prose\` come from the site stylesheet linked above, so the
preview cannot drift from the published page: there is no second copy of either
rule to keep in step. Only the frame's own padding is declared here.`,
  ],
  "app/components/admin/post-editor.tsx#59": [
    "CONTRACT",
    "the division of labour; the overlap story goes to the history document",
    `The pane says only what the command bar cannot: the save state lives in the
bar, and this reports only the two TRANSIENT conditions, saying nothing at rest.`,
  ],
  "app/components/admin/post-editor.tsx#60": [
    "CONTRACT",
    "header: both ways out are explicit",
    `The recovery banner. Both ways out are explicit and neither is the default: an
automatic restore would overwrite committed content with older local text, and an
automatic discard would throw away the thing this exists to save.`,
  ],
  "app/components/admin/post-editor.tsx#61": [
    "CONTRACT",
    "header: why every state carries the sha",
    `The four things a save can have done, said in words. Every state carries the
commit sha, because that is the fact that makes the claim checkable: the author
can look the save up in \`git log\` rather than take the page's word for it.`,
  ],
  "app/components/admin/post-editor.tsx#62": [
    "CONTRACT",
    "why a location is shown only when present",
    `Each is shown only when present, because most refusals carry neither and a
location invented for the ones that do not would be worse than none. A second
line, so the message stays the sentence the gate wrote.`,
  ],
  "app/components/admin/post-editor.tsx#63": ["CONTRACT", "already at size; carries the inline-SVG rule"],
  "app/components/admin/post-editor.tsx#64": [
    "CONTRACT",
    "header: why alt is required at insert time",
    `Uploads an image to R2 and hands back a markdown snippet. Alt text is required
at insert time rather than left for later, because an image inserted without it
is the one that ships without it.`,
  ],
};
