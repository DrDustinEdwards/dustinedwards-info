// Chunk 6: app/routes/admin.mentions.tsx (0-31), app/components/admin/markdown-editor.tsx
// (0-49) and app/components/admin/media-inspector.tsx (0-24). 107 blocks.
//
// Same rule: contracts at 180 bytes or less, headers at ~370, separators keep their label.
//
// ONE HEADER IS DELIBERATELY OVER, admin.mentions #0, and it is named here so the exception is
// visible. It carries three separate prohibitions: the smoke refusal lives in the middleware
// and must not be re-enforced here, every value on the page came from a stranger and is
// therefore text and not a link, and the filter is resolved in the loader. Cutting it to 370
// would mean dropping one of the three, and each forbids something different.
//
// markdown-editor #16 is the other long survivor: the CSP nonce is read off the DOCUMENT and
// deliberately not off loader data, and the argument for that is the correctness argument.
// Compressing it to a sentence would leave the next reader free to "simplify" it back.
//
// media-inspector's protected class is the no-script path: the scrim is a LINK (#2), the role
// is on a div because `<dialog>` needs `showModal()` (#3), the address field is a readonly
// input so it copies with the platform's own shortcut (#5), and every chip is a submit button
// (#11).
export default {
  "app/routes/admin.mentions.tsx#0": [
    "CONTRACT",
    "header, over 370 on purpose: three prohibitions, none of which the others cover",
    `/admin/mentions: the webmention moderation queue.

THE SMOKE ACTOR IS REFUSED, AND NOT BY ANYTHING IN THIS FILE. \`admin.tsx\`'s
middleware is a METHOD ALLOWLIST that refuses every write before a child action
runs, and none of the three actions below is a publish, so a capability read
here would be a SECOND enforcement point for a rule that already has one, which
is the shape hard rule 17 refuses: two owners of one fact, free to disagree.

EVERY VALUE ON IT CAME FROM A STRANGER. They are rendered as React children,
which escapes them, and the source URL is shown as TEXT rather than as a link:
an admin page is not a place to put a one-click navigation to a URL an
unauthenticated POST chose.

NO CLIENT JAVASCRIPT, and THE FILTER IS RESOLVED IN THE LOADER, so the component
is a pure function of what the server handed it.`,
  ],
  "app/routes/admin.mentions.tsx#1": ["CONTRACT", "already one line"],
  "app/routes/admin.mentions.tsx#2": [
    "CONTRACT",
    "the ordering reason and the adding-up property; the four-panel history goes to the history document",
    `The order is a decision rather than an alphabet: pending first because it is
the only one that wants an action, failed second because it is the only one that
might mean something is broken.

\`all\` LISTS EVERY ROW INCLUDING \`unverified\`, which is what makes the counts
add up and lets a reader see that nothing is hiding.`,
  ],
  "app/routes/admin.mentions.tsx#3": [
    "CONTRACT",
    "why the record is keyed by the union",
    `KEYED BY THE UNION ITSELF, so it is total by typecheck, which is what rule 13
asks for in \`app/\`: a filter added with no line here is a compile error rather
than a lookup that substitutes a different filter's sentence.`,
  ],
  "app/routes/admin.mentions.tsx#4": [
    "CONTRACT",
    "what an absent parameter means",
    `AN ABSENT \`?status=\` IS NOT \`all\`, and neither is an unrecognised one. The
default lands on the set that wants a decision when there is one, so arriving
with nothing pending shows the log rather than a quiet line about an empty
queue.`,
  ],
  "app/routes/admin.mentions.tsx#5": [
    "WHY",
    "why the count is read in the loader",
    `The sweep button is LABELLED with it, and a label is a fact the page states
rather than one the action discovers. It is what turns "Sweep expired mentions"
into "Remove 3 expired" and lets the control disable itself.`,
  ],
  "app/routes/admin.mentions.tsx#6": ["CONTRACT", "already at size"],
  "app/routes/admin.mentions.tsx#7": [
    "CONTRACT",
    "why the flag is a boolean",
    `Carried as a boolean because the alternative is classifying by string
matching, which is a second owner of a fact the action already knows: a page
that inferred failure would render a success in the error box the day somebody
rephrased a message.`,
  ],
  "app/routes/admin.mentions.tsx#8": ["CONTRACT", "already one line"],
  "app/routes/admin.mentions.tsx#9": ["CONTRACT", "already one line"],
  "app/routes/admin.mentions.tsx#10": [
    "WHY",
    "the no-script prohibition on handler guards",
    `A guard that runs in a handler is feedback, not a guard, because with scripting
off the handler never runs and the form posts anyway. So both destructive
intents refuse in the ACTION and the refusal renders a second step.`,
  ],
  "app/routes/admin.mentions.tsx#11": [
    "NUMBER",
    "why the typed count is 1",
    `THE COUNT IS 1, not the rows at risk: the operator is authorising the SWEEP,
and a typed row count read a moment before the delete would be invented
precision about a set that can change underneath it.`,
  ],
  "app/routes/admin.mentions.tsx#12": [
    "CONTRACT",
    "why the id is parsed and checked",
    `PARSED AND CHECKED, never passed through: it arrives in a form body and
\`Number("")\` is 0, which is a plausible-looking rowid. A non-positive integer is
a malformed request, not a row that happens not to exist.`,
  ],
  "app/routes/admin.mentions.tsx#13": [
    "NUMBER",
    "why one row is still a ceremony",
    `ONE ROW, SO THE COUNT IS 1. Deleting a mention removes the only copy of what
somebody sent: there is no repository behind this table and no derivation that
could produce the row again.`,
  ],
  "app/routes/admin.mentions.tsx#14": [
    "CONTRACT",
    "the one-door rule",
    `ONE DOOR, shared with the operator API. The write and the purge travel together
in \`decideMention\` so a second caller cannot take only half of them.`,
  ],
  "app/routes/admin.mentions.tsx#15": [
    "WHY",
    "tagged by what STAYS; the wire proof goes to the history document",
    `An approval purges the post's tag, so the section appears on the next fetch.
That is what the clause beside the Approve button is reporting.`,
  ],
  "app/routes/admin.mentions.tsx#16": ["CONTRACT", "already at size"],
  "app/routes/admin.mentions.tsx#17": [
    "WHY",
    "the branch shape is the prohibition; the first-draft story goes to the history document",
    `WRITTEN AS FOUR SEPARATE COMPARISONS RATHER THAN A TERNARY. \`check:destructive\`
matches a strict equality against a string literal ON THE RAW SOURCE, so an
intent handled as a ternary's else arm is INVISIBLE to it, and an unclassifiable
destructive path is the hole that gate exists to close.`,
  ],
  "app/routes/admin.mentions.tsx#18": [
    "CONTRACT",
    "header: why ISO, and why there is no null branch",
    `ISO rather than a friendly rendering: this is a moderation log and an
unambiguous instant is worth more than "3 days ago".

NO NULL BRANCH, which is rule 13 rather than an oversight: \`received_at\` is
\`notNull\`, so a placeholder would be a substituted value for a case that cannot
arrive.`,
  ],
  "app/routes/admin.mentions.tsx#19": ["CONTRACT", "already one line"],
  "app/routes/admin.mentions.tsx#20": [
    "CONTRACT",
    "header: the excerpt leads, and why",
    `THE EXCERPT LEADS, which is a change of subject rather than a reordering. The
reader is judging whether a mention is worth publishing and the quotation is the
evidence; the URL is how they would check it, which is a second question.`,
  ],
  "app/routes/admin.mentions.tsx#21": [
    "CONTRACT",
    "the absence is a statement, not a substituted value",
    `THE ABSENCE IS NAMED rather than left as a dangling verb. It is a statement
about what the fetch found, not a value substituted for one it did not find.`,
  ],
  "app/routes/admin.mentions.tsx#22": ["CONTRACT", "already at size; carries the whole prohibition"],
  "app/routes/admin.mentions.tsx#23": [
    "WHY",
    "why the stamp went; the timing detail goes to the history document",
    `The rows where a verified stamp matters are the ones that DO NOT have one,
which is what the unverified chip counts.`,
  ],
  "app/routes/admin.mentions.tsx#24": [
    "CONTRACT",
    "why approve stays on the row",
    `APPROVE STAYS ON THE ROW, because it is the decision the operator came to make.
Approve and reject are each hidden on the state they would produce, so the pair
reads as a decision that can be changed.`,
  ],
  "app/routes/admin.mentions.tsx#25": [
    "WHY",
    "why the other two move into the menu",
    `Three controls on every row compete with the excerpt the reader is actually
judging, and a menu is where an irreversible action belongs beside a reversible
one.`,
  ],
  "app/routes/admin.mentions.tsx#26": [
    "CONTRACT",
    "the one-array rule; the media library's defect goes to the history document",
    `ONE ARRAY FEEDS THE CHIPS AND THE LIST. A count derived from the same rows the
list is about cannot disagree with it.`,
  ],
  "app/routes/admin.mentions.tsx#27": [
    "CONTRACT",
    "why unverified is counted and not filtered",
    `COUNTED on the filter row rather than given a filter of its own: it is a state
that lasts seconds, and a row that STAYS unverified is worth a number rather
than a decision. Shown only above zero, because a chip reading 0 is an alarm
about nothing.`,
  ],
  "app/routes/admin.mentions.tsx#28": [
    "CONTRACT",
    "the box matches the outcome",
    `\`ok\` is a field on the action's result rather than a guess made from the
message text, so a success cannot render in the error box.`,
  ],
  "app/routes/admin.mentions.tsx#29": [
    "CONTRACT",
    "why the clause is rendered once; the amendment date goes to the history document",
    `THE PURGE CLAUSE, ONCE. It states a property of the whole pending filter, not
of any one mention, so it belongs where the filter is chosen. Rendered per row it
said the same sentence twelve times, which is how a page stops being read.`,
  ],
  "app/routes/admin.mentions.tsx#30": [
    "WHY",
    "keeps why it is not a cron; the sync:content objection goes to the history document",
    `A BUTTON RATHER THAN A CRON. The watchdog's cron repairs DRIFT, a derived
store out of step with the repository, under hard rule 18; a webmention is
neither derived nor repo-sourced, so there is nothing for it to find.

THE TWO WINDOWS ARE IMPORTED, never typed, which is hard rule 17: a button
labelled with one number beside a sweep that uses another is the drift the rule
exists to prevent.`,
  ],
  "app/routes/admin.mentions.tsx#31": [
    "CONTRACT",
    "why the label does not change",
    `DISABLED AT ZERO, WITH THE SAME LABEL: a control that changes its words when it
has nothing to do makes the reader read it twice to learn there is nothing to
do.`,
  ],
  "app/components/admin/markdown-editor.tsx#0": ["CONTRACT", "already at size; carries the split reason"],
  "app/components/admin/markdown-editor.tsx#1": [
    "CONTRACT",
    "header: ruling 2 and the chunk boundary",
    `The markdown body, in CodeMirror 6.

Ruling 2: the text edited IS the file. There is no document model, no serializer
and no round trip, so the fidelity risk that ruled out a rich-node editor does
not exist by construction.

Ruling 6 requires that CodeMirror never reaches a public-plane bundle; the
dynamic import is what makes it its own chunk.`,
  ],
  "app/components/admin/markdown-editor.tsx#2": [
    "CONTRACT",
    "separator plus the token prohibition",
    `Theme, entirely from tokens. Not one hex in here: every colour is a
\`var(--token)\` resolving through the same theme selectors as the rest of the
site, which is why there is no \`dark\` variant of this object.`,
  ],
  "app/components/admin/markdown-editor.tsx#3": [
    "CONTRACT",
    "why these tokens and not a seventh palette",
    `Drawn from the ratified ladder and the semantic text tokens rather than a
syntax theme of their own. These are admin-only and sit on \`--bg\`, so they
reuse tokens the contrast matrix already covers.`,
  ],
  "app/components/admin/markdown-editor.tsx#4": [
    "CONTRACT",
    "separator plus the one-path rule",
    `Syntax insertion. Every toolbar action and every shortcut goes through one of
these, so a keyboard user and a mouse user run identical code.`,
  ],
  "app/components/admin/markdown-editor.tsx#5": ["CONTRACT", "already one line"],
  "app/components/admin/markdown-editor.tsx#6": ["CONTRACT", "already one line"],
  "app/components/admin/markdown-editor.tsx#7": ["CONTRACT", "already one line"],
  "app/components/admin/markdown-editor.tsx#8": ["CONTRACT", "already at size"],
  "app/components/admin/markdown-editor.tsx#9": ["CONTRACT", "already one line"],
  "app/components/admin/markdown-editor.tsx#10": ["CONTRACT", "already at size"],
  "app/components/admin/markdown-editor.tsx#11": [
    "CONTRACT",
    "header: why alt is scaffolded",
    `Every one carries \`alt=""\` with the cursor inside it, because alt is mandatory
on both \`:::chart\` and \`:::diagram\` and the build FAILS without it. Scaffolding
the failure and putting the cursor in the hole is the difference between a
template and a trap.`,
  ],
  "app/components/admin/markdown-editor.tsx#12": [
    "CONTRACT",
    "the second-channel rule; the ruling citation stays",
    `A glyph per directive, in the house inline-SVG idiom (ruling 7). The accessible
name is still the word, so the drawing is the second channel and never the only
one.`,
  ],
  "app/components/admin/markdown-editor.tsx#13": [
    "CONTRACT",
    "why state rides along",
    `\`state\` rides along so the palette can mark a target that is not live: a
palette that silently inserted a link to a draft would produce a 404 on the
published page.`,
  ],
  "app/components/admin/markdown-editor.tsx#14": ["CONTRACT", "already one line"],
  "app/components/admin/markdown-editor.tsx#15": [
    "CONTRACT",
    "why a literal destination is taken as one",
    `An author linking OUT has nothing to search for, so a string that already names
a destination is taken literally. Covers absolute URLs, mail, site-root paths
and bare fragments.`,
  ],
  "app/components/admin/markdown-editor.tsx#16": [
    "CONTRACT",
    "header, kept long: the read-off-the-document argument is the correctness argument",
    `THE NONCE THIS DOCUMENT'S CSP WILL ACTUALLY ACCEPT.

READ OFF THE DOCUMENT, DELIBERATELY NOT OFF LOADER DATA. The root loader RE-RUNS
on client-side navigation, so its \`nonce\` is the one minted for that \`.data\`
request, which is a different value from the one in the enforced header of the
document still on screen. The document's own nonce is the only value the
document's own policy accepts, and it does not change when the route does.

The \`nonce\` IDL PROPERTY, not \`getAttribute\`: browsers hide the content
attribute after parsing precisely so an injected script cannot read a nonce back
out of the DOM.

FAILS CLOSED. Fabricating a value would satisfy the facet while matching no
policy, which is hard rule 13's substituted fallback wearing a different hat.`,
  ],
  "app/components/admin/markdown-editor.tsx#17": ["CONTRACT", "already one line"],
  "app/components/admin/markdown-editor.tsx#18": [
    "CONTRACT",
    "the no-script defect this flag closes",
    `React 19 resolves a lazy component during SSR, so this module's markup IS in
the server-rendered document even though the editor mounts in an effect. Without
this the no-script reader was handed a dead toolbar and a strip telling them to
drag and drop an image.`,
  ],
  "app/components/admin/markdown-editor.tsx#19": [
    "CONTRACT",
    "why the numbers are seeded",
    `Seeded from the initial value so the numbers are right before the first
keystroke rather than reading zero on a post that already has 2000 words.`,
  ],
  "app/components/admin/markdown-editor.tsx#20": [
    "CONTRACT",
    "why the range is captured",
    `\`from\`/\`to\` are the selection AT THE MOMENT Cmd+K was pressed, captured
because focus is about to leave the editor: without them the insertion would
land wherever the selection happened to be after the blur.`,
  ],
  "app/components/admin/markdown-editor.tsx#21": ["CONTRACT", "already one line"],
  "app/components/admin/markdown-editor.tsx#22": ["CONTRACT", "already one line"],
  "app/components/admin/markdown-editor.tsx#23": [
    "CONTRACT",
    "why the route's reason is reported",
    `The route names the real reason, so it is reported rather than replaced with a
status code the author cannot act on. The code is the fallback, not the message.`,
  ],
  "app/components/admin/markdown-editor.tsx#24": [
    "CONTRACT",
    "why the query is seeded from the selection",
    `Seeding the QUERY with the selection means the search has already been
performed by the time the palette appears. The selection is still the link TEXT
on insert, so it costs nothing if the author wanted something else.`,
  ],
  "app/components/admin/markdown-editor.tsx#25": ["CONTRACT", "already one line"],
  "app/components/admin/markdown-editor.tsx#26": ["CONTRACT", "already at size"],
  "app/components/admin/markdown-editor.tsx#27": [
    "CONTRACT",
    "why the cursor lands after",
    `AFTER it rather than inside it, because the author's next keystroke is almost
always the sentence continuing, and landing inside the label would make them
arrow out of their own link.`,
  ],
  "app/components/admin/markdown-editor.tsx#28": ["CONTRACT", "already one line"],
  "app/components/admin/markdown-editor.tsx#29": ["CONTRACT", "already at size"],
  "app/components/admin/markdown-editor.tsx#30": [
    "CONTRACT",
    "why the nonce facet comes first",
    `FIRST, because everything below that styles anything reaches the DOM through
the same injected element: without this the house appearance was dropped
alongside CodeMirror's base theme.`,
  ],
  "app/components/admin/markdown-editor.tsx#31": [
    "CONTRACT",
    "counted from the document, and the identity bail-out",
    `Counted from the DOCUMENT, not the parent's copy, so the number cannot lag a
keystroke behind the screen. The update bails out by identity, so typing within
a word does not re-render.`,
  ],
  "app/components/admin/markdown-editor.tsx#32": [
    "CONTRACT",
    "why the trigger is narrow",
    `Deliberately narrow: markdown is full of slashes, and a menu that opened inside
a URL would be unusable.`,
  ],
  "app/components/admin/markdown-editor.tsx#33": [
    "WHY",
    "tagged by what STAYS; the old stub goes to the history document",
    `Cmd+K SEARCHES the site's own posts. A typed URL still works, so nothing that
used to be possible stopped being possible.`,
  ],
  "app/components/admin/markdown-editor.tsx#34": [
    "CONTRACT",
    "why Cmd+S is not handled here",
    `Cmd+S is handled by the editor shell, which knows which transition the primary
button is armed for. Swallowing it here would save with whatever draft flag the
last press left behind.`,
  ],
  "app/components/admin/markdown-editor.tsx#35": ["CONTRACT", "already at size"],
  "app/components/admin/markdown-editor.tsx#36": [
    "CONTRACT",
    "carries an eslint directive, so it is kept byte-identical and not rewritten",
  ],
  "app/components/admin/markdown-editor.tsx#37": [
    "CONTRACT",
    "why the guard is on the text differing",
    `Guarded on the text actually differing, or every keystroke would round trip
through the parent and dispatch a redundant transaction that resets the
selection. A restore is the only thing that legitimately replaces the whole
document while mounted.`,
  ],
  "app/components/admin/markdown-editor.tsx#38": ["CONTRACT", "already at size"],
  "app/components/admin/markdown-editor.tsx#39": [
    "CONTRACT",
    "why it is a hint and why it is aria-hidden",
    `A hint, not a control: nothing to focus, nothing to activate, and
\`aria-hidden\` because the same information reaches assistive tech through the
toolbar's named buttons and the alt prompt after an upload.`,
  ],
  "app/components/admin/markdown-editor.tsx#40": [
    "CONTRACT",
    "the placement reason and the live-region prohibition",
    `At the foot of the WRITING PANE, not the command bar, which carries the save
state. It is NOT a live region: it changes constantly, and announcing every
change would make the editor unusable with a screen reader.`,
  ],
  "app/components/admin/markdown-editor.tsx#41": ["CONTRACT", "already at size"],
  "app/components/admin/markdown-editor.tsx#42": [
    "CONTRACT",
    "why it searches posts; the rest is the palette's own shape",
    `A search over the site's own posts, because the overwhelmingly common link in
this corpus is to another post on it and the author knows the title rather than
the slug. Typing a destination still works.`,
  ],
  "app/components/admin/markdown-editor.tsx#43": ["CONTRACT", "already at size"],
  "app/components/admin/markdown-editor.tsx#44": [
    "CONTRACT",
    "why the event is stopped as well as prevented",
    `Stopped as well as prevented: this input sits inside the editor's DOM, and an
Escape that kept bubbling would reach the shell and close things the author did
not mean to close.`,
  ],
  "app/components/admin/markdown-editor.tsx#45": ["CONTRACT", "already at size"],
  "app/components/admin/markdown-editor.tsx#46": [
    "CONTRACT",
    "why both drive one highlight",
    `Mouse and keyboard drive the SAME highlight, so a pointer moving across the
list does not leave Enter pointing at a different row than the one under the
cursor.`,
  ],
  "app/components/admin/markdown-editor.tsx#47": ["CONTRACT", "already at size; carries the in-words rule"],
  "app/components/admin/markdown-editor.tsx#48": [
    "CONTRACT",
    "the alt policy, as the prohibition",
    `Blocked until alt exists: an image inserted without alt is the one that ships
without it, so the insert is what waits, not a reminder to fix it later.`,
  ],
  "app/components/admin/markdown-editor.tsx#49": ["CONTRACT", "already one line"],
  "app/components/admin/media-inspector.tsx#0": [
    "CONTRACT",
    "header: the one-owner rule; the move date goes to the history document",
    `THE \`?key=\` INSPECTOR: the panel that opens over the library when a row is
addressed by key.

\`detail\` is the loader's own row, taken from the route's generated types rather
than restated here, so the shape has ONE owner and this file cannot drift from
what the loader returns.`,
  ],
  "app/components/admin/media-inspector.tsx#1": [
    "CONTRACT",
    "why the member is selected",
    `The loader returns a UNION of three shapes and only the listing carries
\`detail\`, so the member is selected rather than the property read off the union.
Still one owner: the loader.`,
  ],
  "app/components/admin/media-inspector.tsx#2": [
    "CONTRACT",
    "the no-script mechanism and the one-way-to-close rule",
    `THE SCRIM IS A LINK rather than a div with a handler: closing by clicking
outside must not depend on script. It is the same URL the Close control uses, so
there is one way to close and not two. \`preventScrollReset\`, because closing is
not a new place to be.`,
  ],
  "app/components/admin/media-inspector.tsx#3": [
    "CONTRACT",
    "why the role is on a div",
    `A DIALOG in role, not a \`<dialog>\` element: that would need \`showModal()\` to
behave, which is script, and this panel is server-rendered and has to work
without any.`,
  ],
  "app/components/admin/media-inspector.tsx#4": [
    "CONTRACT",
    "keeps the ellipsis reason and the repeated pill; the mockup note goes to the history document",
    `The name ELLIPSISES rather than wrapping: a content-addressed key can wrap to
three lines and push the whole panel down. The usage pill repeats the state the
panel explains below, deliberately: it is the one fact somebody opens this panel
to check.`,
  ],
  "app/components/admin/media-inspector.tsx#5": [
    "CONTRACT",
    "the no-script path for the page's one job",
    `THE NO-SCRIPT PATH FOR THE PAGE'S ONE JOB. A readonly input rather than a
\`<code>\`: it selects with a click and a keyboard and copies with the platform's
own shortcut, none of which needs this page to be running.`,
  ],
  "app/components/admin/media-inspector.tsx#6": [
    "CONTRACT",
    "why the panel says derived",
    `DERIVED, and the inspector says so: everything in this list is recomputable
from the object by \`rebuildMediaIndex\`, and an edit here would be overwritten by
the next rebuild.`,
  ],
  "app/components/admin/media-inspector.tsx#7": ["CONTRACT", "already at size"],
  "app/components/admin/media-inspector.tsx#8": [
    "CONTRACT",
    "why the field is images only; the counts go to the history document",
    `ALT TEXT, FOR IMAGES ONLY. A document does not take alt text, so offering the
field on one invents an obligation the author cannot discharge.`,
  ],
  "app/components/admin/media-inspector.tsx#9": [
    "CONTRACT",
    "keeps the one-writer rule and the empty-field condition; the value-on-the-button reasoning goes to the history document",
    `A SUBMIT BUTTON CARRYING ITS VALUE, through the SAME \`set-alt\` intent, so the
server keeps one writer. Offered only while the field is EMPTY: a suggestion
beside text somebody has written is an invitation to overwrite their sentence.
A FORM, not a click handler, so it works with scripting off.`,
  ],
  "app/components/admin/media-inspector.tsx#10": [
    "CONTRACT",
    "the parsed-not-storage rule",
    `The field carries the PARSED list joined back with commas, never the
delimiter-wrapped storage form. Nothing outside \`tags.mjs\` should ever see
\`,alpha,beta,\`.`,
  ],
  "app/components/admin/media-inspector.tsx#11": [
    "CONTRACT",
    "keeps the one-writer rule, the clear marker and the no-script property; the join-character history goes to the history document",
    `Every chip is a submit button on the SAME \`set-tags\` intent carrying the WHOLE
resulting list, with ONE exception: the chip whose removal would leave nothing
submits \`clear\`, because an empty value is no longer an instruction to clear.
\`setMediaTags\` stays the one writer and the one author of the delimiter rule,
and every chip works with scripting off.`,
  ],
  "app/components/admin/media-inspector.tsx#12": [
    "CONTRACT",
    "why clearing is deliberate, and why it hides at one",
    `CLEAR ALL, an explicit act with its own control: the point of the fix is that
clearing is DELIBERATE, not that it is tedious. Shown only above one tag,
because at one the chip beside it already does this.`,
  ],
  "app/components/admin/media-inspector.tsx#13": [
    "CONTRACT",
    "keeps the label rule and its owner; the seventy-row story goes to the history document",
    `THE LABELS CHANGE WITH THE FILE: an image goes into a post as \`![alt](src)\` and
a document as \`[title](href)\`, so a control labelled HTML has to produce a
different thing for each. \`copySnippetsFor\` owns both the label and the value,
so the two cannot disagree.`,
  ],
  "app/components/admin/media-inspector.tsx#14": [
    "CONTRACT",
    "exact identity only, and what makes the offer safe",
    `IDENTICAL BYTES, found by content hash: exact identity only, never a similarity
score. Trashing a twin hides it and BOTH addresses keep working, so nothing here
can cost a published page its image.`,
  ],
  "app/components/admin/media-inspector.tsx#15": [
    "CONTRACT",
    "what the sentence has to say; the mockup attribution goes to the history document",
    `"Byte-identical" says the comparison was exact, not a similarity score, and
"both addresses resolve to the same content" says what a reader needs before
trashing one. Naming the twin in the button is the other half.`,
  ],
  "app/components/admin/media-inspector.tsx#16": [
    "CONTRACT",
    "why a static row gets nothing",
    `Shown and never recomputed: the key already carries it. A static row has a path
rather than a hash, so it gets nothing rather than a truncated path dressed as a
digest.`,
  ],
  "app/components/admin/media-inspector.tsx#17": [
    "CONTRACT",
    "the claim, the boundary and the evidence; the old confession goes to the history document",
    `The heading is the CLAIM, the sentence is its BOUNDARY, and the list underneath
is what was actually found: posts for \`used\`, source files for \`in template\`.`,
  ],
  "app/components/admin/media-inspector.tsx#18": ["CONTRACT", "already at size"],
  "app/components/admin/media-inspector.tsx#19": [
    "CONTRACT",
    "why paths and why not links",
    `Repo-relative paths rather than prose labels, because a path is a fact the
reader can open and check. Not links, because the admin has no source browser
and a link to nothing is worse than text.`,
  ],
  "app/components/admin/media-inspector.tsx#20": [
    "CONTRACT",
    "the ladder, and why a static row may still be trashed",
    `NEITHER CARRIES A CONFIRM, and that is the friction ladder working: trashing is
reversible and changes nothing a reader can see, so ceremony that is always
harmless is ceremony people learn to click through. Offered on a static row too,
because trashing touches no file.`,
  ],
  "app/components/admin/media-inspector.tsx#21": [
    "CONTRACT",
    "why the refusal is explained",
    `A static asset shows WHY it cannot be deleted rather than simply lacking a
button. The action refuses it regardless; this is so the page explains the
refusal instead of leaving a gap.`,
  ],
  "app/components/admin/media-inspector.tsx#22": [
    "CONTRACT",
    "earlier feedback, not the gate",
    `EARLIER FEEDBACK, NOT THE GATE. The action checks the same thing server-side,
because this handler does not run for a reader without JavaScript and the R2
delete did.`,
  ],
  "app/components/admin/media-inspector.tsx#23": ["CONTRACT", "already at size"],
  "app/components/admin/media-inspector.tsx#24": ["CONTRACT", "already at size; carries the no-script statement"],
};
