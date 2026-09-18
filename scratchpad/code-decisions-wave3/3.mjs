// Chunk 3: publish.server.ts 0-49 and operator/api.server.ts 0-48. The write path, and the
// operator's door onto it.
//
// Written in one pass at the settled rate. These two files are almost entirely rules and the
// incidents that produced them, so the cut falls on the incidents and the rules stay.
//
// The findings keep their LETTERS where the letter is how the record refers to them (B002, B003),
// because the letter is a pointer into the audit and not a date.
export default {
  "app/lib/editor/publish.server.ts#0": [
    "CONTRACT",
    "the order and why the gates are here; the ruling date goes to the history document",
    `The editor's write path, end to end.

  browser -> action -> gates -> GitHub commit (one markdown file) -> render -> D1

THE ORDER MATTERS: files are the source of truth, so nothing reaches D1 that is not already
committed, and if GitHub is unreachable the save fails whole with both stores untouched.

The gates run here, server side, because a commit made through the GitHub API never touches the
local PreToolUse hooks.`,
  ],
  "app/lib/editor/publish.server.ts#1": ["CONTRACT", "what the side-effect import does; one line already"],
  "app/lib/editor/publish.server.ts#2": [
    "CONTRACT",
    "one statement of the rule; the seven restatements and the measurement go to the history document",
    `Where a post's source file lives, as ONE statement of the rule. It was module-private and the
path was consequently restated in seven other places, three of them their own definitions.`,
  ],
  "app/lib/editor/publish.server.ts#3": [
    "CONTRACT",
    "why it is re-exported; the date goes to the history document",
    `RE-EXPORTED, not defined here: the definition moved beside \`SLUG_PATTERN\` because the pipeline
built the same path independently, which made hard rule 6's "stated ONCE" false by one.`,
  ],
  "app/lib/editor/publish.server.ts#4": ["CONTRACT", "what it carries; one line already"],
  "app/lib/editor/publish.server.ts#5": [
    "CONTRACT",
    "why it is not an error and why thrown from here",
    `A first publication that nobody has confirmed yet. NOT AN ERROR: nothing failed and nothing was
refused, the write stopped one step short because the ceremony has not been answered.

Thrown rather than returned so it cannot be skipped by a caller that forgets a flag, and thrown
from \`savePost\` because that is where the prior file is read, which is the only place that knows
whether this IS a first publication.`,
  ],
  "app/lib/editor/publish.server.ts#6": ["CONTRACT", "the half this module reads; one line already"],
  "app/lib/editor/publish.server.ts#7": [
    "WHY",
    "the both-writers rule and the three things it forces; the finding keeps its letter, the arc goes to the history document",
    `Measures an image the editor referenced.

BOTH BRANCHES EXIST TO AGREE WITH \`scripts/lib/content.mjs\`, and finding B002 is that neither
did: dimensions go into the stored HTML, so whatever this returns the Node build must return too,
from a clone, with no bindings and no network. So \`/media/*\` resolves from the KEY, \`public/*\`
from the REPOSITORY at the pinned ref rather than the origin, and THE PLACEHOLDER FROM THAT SAME
REF rather than this Worker's bundled manifest, which is the manifest as of the last DEPLOY.

Exported so preview resolves images exactly as a save does: there must not be a second
implementation, preview's whole claim being that what it renders is what publishes.`,
  ],
  "app/lib/editor/publish.server.ts#8": ["CONTRACT", "what it caches; one line already"],
  "app/lib/editor/publish.server.ts#9": [
    "WHY",
    "why it does not fail the save and why it is logged",
    `A missing or unparseable manifest yields no placeholders rather than failing the save: refusing
to publish because a generated artifact could not be read would be a new way to lose an article.
Logged, because silence here is the drift.`,
  ],
  "app/lib/editor/publish.server.ts#10": [
    "CONTRACT",
    "absent is a real answer; one line already",
    `Absent for anything the manifest does not cover. Absent is a real answer: the image renders
without a placeholder, exactly as it did before this existed.`,
  ],
  "app/lib/editor/publish.server.ts#11": [
    "CONTRACT",
    "what runs and when; one line already",
    `Runs both gates against submitted markdown and renders it, before anything is written anywhere.
A rejection names the field or the line.`,
  ],
  "app/lib/editor/publish.server.ts#12": [
    "WHY",
    "why by value; one line already",
    `The first offender is guarded by VALUE rather than by list length, which is what lets the
message read its fields.`,
  ],
  "app/lib/editor/publish.server.ts#13": [
    "CONTRACT",
    "what is computed and what is not; the old path's equivalence goes to the history document",
    `The saved post's related list, computed against the D1 corpus. Only THIS post's list is written:
relatedness is a property of the whole corpus, so every other row's copy waits for the next bulk
sync, exactly as it did before.`,
  ],
  "app/lib/editor/publish.server.ts#14": [
    "CONTRACT",
    "why ISO strings; one line already",
    `ISO strings, matching what \`withRelated\` compares: string order over ISO timestamps IS
chronological order.`,
  ],
  "app/lib/editor/publish.server.ts#15": [
    "WHY",
    "why last, and the rule it avoids; one line",
    `The saved post goes LAST, so \`withRelated\` returns its entry at a position that cannot miss.
\`find\` with a fallback would be a substituting fallback on a can't-happen branch (rule 13).`,
  ],
  "app/lib/editor/publish.server.ts#16": [
    "CONTRACT",
    "the one-door rule and what the sha proves",
    `THE ONLY DOOR TO A RENDERED ROW. Nothing else may write one, because two writers of one row shape
is the drift the committed artifact used to exist to catch.

\`blobSha\` proves the rendered bytes ARE the committed bytes, so a truncated fetch fails here by
name instead of writing a row whose provenance lies.`,
  ],
  "app/lib/editor/publish.server.ts#17": [
    "CONTRACT",
    "why the widening; one line already",
    `\`related\` is corpus-scope and attached below, which the pipeline's inferred record type does not
carry.`,
  ],
  "app/lib/editor/publish.server.ts#18": [
    "WHY",
    "why at the door, why drafts too, and that it cannot fail the write; the ruling and the rate-limit note go to the history document",
    `THE CACHE PURGE, AT THE ONE DOOR, because every write that purges \`posts\` reaches D1 through this
function, which hard rule 18 already made the one door: wiring it here means a sixth writer added
later is purged by construction rather than by somebody remembering.

IT PURGES ON A DRAFT SAVE TOO, AND THAT IS THE ACCEPTED COST. The obvious condition is where this
gets subtly wrong: an UNPUBLISH writes a row whose status is draft while changing every public
listing, so "skip drafts" would skip the case that most needs it.

It cannot fail this write, which is hard rule 18's second clause applied to a cache.`,
  ],
  "app/lib/editor/publish.server.ts#19": ["CONTRACT", "what it records; one line already"],
  "app/lib/editor/publish.server.ts#20": [
    "WHY",
    "why the render runs twice",
    `Saves a post: gates, one-file commit, then the render door.

THE FULL RENDER RUNS TWICE BY DESIGN: once as the gate in FRONT of the commit, because a post
that fails validation must never land on main, and once inside \`renderAndWrite\` AFTER it, because
D1 is written only from a row the one door produced. Rendering is deterministic, and one
duplicated render costs a save less than a second door would cost the repo.`,
  ],
  "app/lib/editor/publish.server.ts#21": [
    "WHY",
    "why required and why there is no safe default; the four call sites and the date go to the history document",
    `WHO IS WRITING. REQUIRED, with no default: it defaulted to the most privileged principal on the
site, so a call site that forgot to say who was asking was granted everything, silently.

THERE IS NO SAFE DEFAULT FOR AN IDENTITY. The fail-closed choice is worse rather than safer: it
would quietly downgrade a real admin action into a refusal nobody could explain.`,
  ],
  "app/lib/editor/publish.server.ts#22": [
    "WHY",
    "why three-valued and why the check is an identity test",
    `WHETHER THIS REQUEST CARRIES THE AUTHOR'S CONFIRMATION. Three-valued, and the third value is the
useful one: ABSENT means this caller has no ceremony. So the check tests \`=== false\` rather than
falsiness, because a caller that says nothing is not a caller that said no.`,
  ],
  "app/lib/editor/publish.server.ts#23": [
    "WHY",
    "why the read comes first; one line",
    `The existing file is read BEFORE anything is rendered: it carries the only authoritative answer
to "has this post ever been published", and a write refused by policy should not pay for a render.`,
  ],
  "app/lib/editor/publish.server.ts#24": ["CONTRACT", "what it throws and what it stamps; one line already"],
  "app/lib/editor/publish.server.ts#25": [
    "WHY",
    "why here and why after the policy call",
    `THE CEREMONY, CHECKED AGAINST THE PRIOR FILE AND BEFORE ANY WORK, so \`published-first\` is the
authoritative answer rather than anything the request asserted about itself. Nothing has been
written when it throws.

AFTER \`decide()\` deliberately, so a policy refusal still wins: a credential that may not publish
at all is told that, not asked to confirm.`,
  ],
  "app/lib/editor/publish.server.ts#26": [
    "CONTRACT",
    "why the result is discarded; one line",
    `Rendered from the STAMPED markdown and BEFORE the commit: this is the gate, and its result is
deliberately discarded. The row D1 gets is the one \`renderAndWrite\` produces after the commit.`,
  ],
  "app/lib/editor/publish.server.ts#27": [
    "WHY",
    "the prohibition on compensating reverts and where a failure is recorded; the audit date goes to the history document",
    `ONLY NOW, WITH THE COMMIT LANDED, DOES THE DATABASE CHANGE.

**THERE IS NO COMPENSATING REVERT AND THERE MUST NEVER BE ONE**: undoing the commit to tidy the
index would destroy the authoritative copy to repair the derived one. A persistent failure is
recorded in KV rather than D1, because D1 is the store that just failed.`,
  ],
  "app/lib/editor/publish.server.ts#28": [
    "WHY",
    "why clearing matters and why it cannot throw",
    `A SUCCESSFUL WRITE CLEARS ANY EARLIER DIVERGENCE FOR THIS SLUG, or the status surface keeps
reporting a fault a later save already repaired, and a stale alarm is how a real one stops being
read. It does not throw: failing to clear is strictly less bad than failing the save.`,
  ],
  "app/lib/editor/publish.server.ts#29": [
    "WHY",
    "when it fires, why after the sync, and why a survivor is inert",
    `DRAFT PREVIEW LINKS DIE WHEN THE POST STOPS BEING A DRAFT, and AFTER the D1 sync: the read path
asks the database for \`status = 'draft'\`, so revoking first would open a window where the token
is gone and the row still says draft. It does not throw, because a surviving token is INERT.`,
  ],
  "app/lib/editor/publish.server.ts#30": [
    "WHY",
    "why a distinct value; one line already",
    `null already means "not attempted", so a failure needs its own value.`,
  ],
  "app/lib/editor/publish.server.ts#31": [
    "WHY",
    "the asymmetry; one line",
    `The AI index is downstream of D1 and MUST NOT be able to fail a save: a post briefly missing
from Ask is a degraded enhancement, where a save failing after the commit landed would leave the
repo and the database disagreeing about whether it happened.`,
  ],
  "app/lib/editor/publish.server.ts#32": [
    "CONTRACT",
    "why the flag exists; one line",
    `True when the first D1 write failed and the retry succeeded, so a retry is visible rather than silent.`,
  ],
  "app/lib/editor/publish.server.ts#33": [
    "CONTRACT",
    "why three states and not a count",
    `How many preview links this save revoked: \`null\` when nothing was attempted, \`-1\` when the
attempt threw. Three states rather than a count, because "0 revoked", "never asked" and "asked
and failed" are different facts a bare number tells apart only by accident.`,
  ],
  "app/lib/editor/publish.server.ts#34": [
    "CONTRACT",
    "why the policy module names it; one line",
    `What the save DID, named by the policy module because only it read the prior file, which is the
only thing that tells a first publication from a republication.`,
  ],
  "app/lib/editor/publish.server.ts#35": [
    "WHY",
    "why the marker names the operator; one line",
    `Marks who wrote the commit, naming the operator id rather than "an agent", so \`git log\` answers
which one without anyone cross-referencing.`,
  ],
  "app/lib/editor/publish.server.ts#36": [
    "CONTRACT",
    "what it returns and when null; one line already",
    `Pushes one post into the Ask index, reporting failure instead of raising. Null when Ask is not configured.`,
  ],
  "app/lib/editor/publish.server.ts#37": [
    "WHY",
    "why a partial upload is not ok; one line",
    `A PARTIAL UPLOAD IS NOT \`ok\`: without this the editor would be told the index write succeeded
while some of the post was missing from it.`,
  ],
  "app/lib/editor/publish.server.ts#38": ["CONTRACT", "what it does; one line already"],
  "app/lib/editor/publish.server.ts#39": [
    "WHY",
    "why required here too; the grounds stay on savePost",
    `\`actor\` is REQUIRED here for the reason \`savePost\` records: the default was the most privileged
principal, and deletion is the capability the table is strictest about.`,
  ],
  "app/lib/editor/publish.server.ts#40": [
    "WHY",
    "the least-privilege rule and why it is the first statement; the date goes to the history document",
    `**THE POLICY DECISION, BEFORE ANY READ OR WRITE.** There was no policy path here at all: an
operator forbidden from making a post public for the FIRST time was permitted to DESTROY it.

First statement deliberately: after the file read it would still refuse, but would let an
unauthorised caller probe which slugs exist from the difference between two error messages.`,
  ],
  "app/lib/editor/publish.server.ts#41": [
    "WHY",
    "the asymmetry and what matters here; one line",
    `Same asymmetry as the save path: the AI index cannot fail the delete. A deleted post still
answerable through Ask is the one failure that matters here, so it is reported rather than
swallowed.`,
  ],
  "app/lib/editor/publish.server.ts#42": [
    "CONTRACT",
    "why batch and why the rebuild; one line",
    `Writes one rendered post into D1 and rebuilds the search index, in a \`batch()\` so the row, its
tags and the index move together. The FTS index is rebuilt rather than left to the per-row
triggers, matching what the bulk sync does.`,
  ],
  "app/lib/editor/publish.server.ts#43": [
    "WHY",
    "the scope difference and why it shares the batch",
    `The media citations this post emitted, SCOPED TO THIS SLUG, which is the difference from the bulk
sync: this re-rendered one post and must not touch another's refs. In the same batch as the post
write, so a save either records its citations or does not happen.`,
  ],
  "app/lib/editor/publish.server.ts#44": [
    "WHY",
    "the separator argument, which is the correctness claim; the date and the dead-function history go to the history document",
    `The primary key includes form and detail, so one image cited twice in one form is one row.

THE SEPARATOR IS THE WHOLE CORRECTNESS ARGUMENT. A printable one COLLIDES: under a space,
\`("k", "inline", "line 3 alt")\` and \`("k", "inline line", "3 alt")\` give the same key, so a post
citing two images records one. Details really do carry spaces; NUL cannot occur in any of the
three, so the join is unambiguous.`,
  ],
  "app/lib/editor/publish.server.ts#45": [
    "CONTRACT",
    "why per-post replacement is safe here and not for related",
    `Statements that replace one post's search records. Safe to do incrementally where \`related\` is
not: a post's sections depend on nothing but that post's markdown, where relatedness is a
property of the whole corpus. One indexer, for the same reason there is one renderer.`,
  ],
  "app/lib/editor/publish.server.ts#46": [
    "WHY",
    "what the delete prevents; the finding keeps its letter, the repair history goes to the history document",
    `Removes a post's rows. Tag rows stay, matching the bulk sync.

THE \`media_refs\` DELETE IS FINDING B003, and the consequence was a PERMANENTLY REFUSED DELETE:
the resolver reported zero citations while the table still claimed one, so the image could never
be removed from the library.`,
  ],
  "app/lib/editor/publish.server.ts#47": [
    "WHY",
    "why both tags and why before the delete",
    `Both tags, because the page and the listings are different entries. Purged BEFORE the delete
deliberately: a purge that lands first can only cost a re-render of a page that still exists,
where one landing after a slow delete could re-store the page it was meant to remove.`,
  ],
  "app/lib/editor/publish.server.ts#48": [
    "CONTRACT",
    "what the door is and the rule it follows",
    `THE REBUILD DOOR, and the one RECOVERY.md points at: one directory listing, one read per file,
and \`renderAndWrite\` per post, so every row arrives through the same door a save uses, which is
rule 18's repair-through-the-derivation. The blob sha rides along so each render proves it
rendered the bytes the repository holds.`,
  ],
  "app/lib/editor/publish.server.ts#49": [
    "WHY",
    "the scope assertion and the destructive reading it refuses",
    `SCOPE, ASSERTED. An empty listing is a deleted content directory or a broken read, and "sync 0
posts, delete every row" is the destructive reading of both. Refuse rather than converge on an
empty corpus.`,
  ],
  "app/lib/operator/api.server.ts#0": [
    "CONTRACT",
    "the one-implementation rule; the ruling date and the refactor note go to the history document",
    `The operator publish tools.

EVERY WRITE HERE CALLS THE SAME FUNCTIONS THE BROWSER EDITOR'S ACTION CALLS. Nothing in this file
talks to GitHub, D1 or the AI index directly, and nothing re-implements a gate. The read tools go
through D1 and per-file repository reads the same way the admin surfaces do, so an operator sees
what the editor sees.`,
  ],
  "app/lib/operator/api.server.ts#1": [
    "WHY",
    "the traversal it refuses and why the pattern is imported; the audit date goes to the history document",
    `A slug, validated against the SAME predicate the write path enforces, because every one of these
is interpolated into a repository path and handed to an API that builds its URL with \`encodeURI\`,
which does NOT escape \`.\`, \`/\` or \`?\`. The WRITE path was always safe; the READ paths ran first
with no such check.`,
  ],
  "app/lib/operator/api.server.ts#2": [
    "WHY",
    "why the bound is applied here too; one line",
    `THE LENGTH BOUND IS APPLIED HERE TOO: a read path that accepts what the write schema refuses
interpolates a slug the repository can never hold into an API path. Same constant, imported.`,
  ],
  "app/lib/operator/api.server.ts#3": [
    "CONTRACT",
    "the typecheck idiom and why it moved; the drifted copy goes to the history document",
    `What GET /api/operator says about each tool, beside the dispatch that runs it.

KEYED BY \`ToolName\`, the \`WRITE_CAPABILITIES\` idiom (hard rule 13): a tool added without a
descriptor is a TYPECHECK failure, and a descriptor for a tool that does not exist is one too, so
the self-description cannot drift from the dispatch in either direction. The route carried a
hand-written copy and it had already drifted.`,
  ],
  "app/lib/operator/api.server.ts#4": [
    "CONTRACT",
    "why the operator has it and why unfiltered; the proof-by-clicking anecdote goes to the history document",
    `The moderation queue, over the operator token, because a step that can only be taken by hand is a
step that gets taken late.

UNFILTERED BY DEFAULT: a queue that hides its failures cannot tell "nothing arrived" from
"everything was refused". Read through the SAME function the admin page reads.`,
  ],
  "app/lib/operator/api.server.ts#5": [
    "WHY",
    "why a bad status is a 400; one line",
    `A STATUS THE COLUMN CANNOT HOLD IS A 400, not an empty list: an agent that mistyped one and got
\`[]\` would conclude the queue was empty, which is indistinguishable from the right answer.`,
  ],
  "app/lib/operator/api.server.ts#6": [
    "CONTRACT",
    "the one-door rule and where the capability check lives",
    `Approve, reject or delete one mention, and purge the page it changed. IT CALLS \`decideMention\` AND
NOTHING ELSE: the write and the purge travel together there, so this cannot ship the half that
changes the database without the half that makes it visible. The capability check is in that door
too, so the refusal is the same whichever caller asks.`,
  ],
  "app/lib/operator/api.server.ts#7": [
    "WHY",
    "why changed:false is an answer; one line",
    `\`changed: false\` IS A REAL ANSWER AND NOT AN ERROR: the row may be one the write refuses for
having no evidence to approve, and reporting that as a 404 would make a caller retry something
that will never succeed.`,
  ],
  "app/lib/operator/api.server.ts#8": [
    "CONTRACT",
    "why translation is the contract; one line",
    `Runs one tool. Errors are TRANSLATED here rather than thrown, and the translation IS the
contract: a gate rejection returns the gate's own message with the field and line it named,
verbatim, because an agent that gets "invalid frontmatter" and nothing else cannot fix its own
mistake.`,
  ],
  "app/lib/operator/api.server.ts#9": [
    "CONTRACT",
    "what it returns and why named; one line already",
    `Policy refusal. 403, and it names the policy so a caller can branch on it rather than
string-matching the prose.`,
  ],
  "app/lib/operator/api.server.ts#10": ["CONTRACT", "what is useful; one line already"],
  "app/lib/operator/api.server.ts#11": ["CONTRACT", "what a conflict means; one line already"],
  "app/lib/operator/api.server.ts#12": [
    "WHY",
    "why its own branch, why matched on name, and why 500",
    `DIVERGENCE IS ITS OWN BRANCH, because it means the OPPOSITE of the failures above: the commit
landed, the writing is safe, and retrying is the one response that does not help.

Matched on \`name\` rather than \`instanceof\`, a cross-module identity check through two build
graphs holding only until something duplicates the module. 500: the caller did nothing wrong.`,
  ],
  "app/lib/operator/api.server.ts#13": [
    "CONTRACT",
    "why D1 and what the field names mean; the arc goes to the history document",
    `D1, not the repository: the rows are what the site serves and they converge to the repo under
rule 18. Field names are the tool's contract and are unchanged.`,
  ],
  "app/lib/operator/api.server.ts#14": ["CONTRACT", "where the rendered half comes from; one line already"],
  "app/lib/operator/api.server.ts#15": ["CONTRACT", "why the full file; one line already"],
  "app/lib/operator/api.server.ts#16": [
    "WHY",
    "why it is answered from the file; one line",
    `Whether an operator may publish this post is a question about the FILE, so it is answered from
the file and reported rather than left to be discovered by a 403.`,
  ],
  "app/lib/operator/api.server.ts#17": [
    "WHY",
    "why unconditional is deliberate for this caller",
    `Absent \`expectedHeadSha\` the save is unconditional, deliberately for a non-browser caller: it
has no page to reload, and forcing a read-then-write would make every agent save a two-call
dance. A caller that wants the editor's conflict semantics passes the sha from \`get_post\`.`,
  ],
  "app/lib/operator/api.server.ts#18": [
    "CONTRACT",
    "why reported not raised; one line already",
    `The AI index cannot fail a save, so its outcome is reported rather than raised.`,
  ],
  "app/lib/operator/api.server.ts#19": [
    "CONTRACT",
    "why it exists, why idempotent and why the counts are read back; the measurement and its date go to the history document",
    `THE FULL-CORPUS ASK UPLOAD. \`savePost\` keeps Ask in step for a post published THROUGH the editor,
and nothing kept it in step for a post published by COMMIT, which is how most of this site's
writing lands.

IDEMPOTENT, which is what makes it safe as a pipeline step. THE COUNTS ARE READ BACK, NOT
ACCUMULATED, so a caller cannot be told this succeeded by an operation that merely ran.`,
  ],
  "app/lib/operator/api.server.ts#20": [
    "CONTRACT",
    "the stance on an absent binding; one line already",
    `Same stance the Ask endpoint takes: an absent binding means the feature is not here, rather than
here and broken.`,
  ],
  "app/lib/operator/api.server.ts#21": [
    "WHY",
    "why a drift read here can be a moment behind; one line",
    `READ BACK AFTER BOTH WRITES. The index is eventually consistent, so drift reported here can be a
moment behind rather than a fault, and the next scheduled poll is the tiebreaker.`,
  ],
  "app/lib/operator/api.server.ts#22": [
    "CONTRACT",
    "the rule-18 shape, why the button stays and why no poll; the ruling, the directive and the OFL row go to the history document",
    `REBUILDS THE MEDIA INDEX, THROUGH THE DERIVATION, AND PROVES IT AFTERWARDS.

RULE 18 IS THE WHOLE SHAPE: it takes no arguments describing what to write, and there is
deliberately no way to ask it to index one key, which is the shape that turns an index into a
second truth. THE VERDICT IS RECONCILED, NEVER SUPPLIED.

The manual button is not replaced: it stays as the repair for when something has gone wrong out
of band. NO POLL, structurally: the rebuild awaits every write and the read-back is in the SAME
request, which reads its own writes.`,
  ],
  "app/lib/operator/api.server.ts#23": [
    "CONTRACT",
    "why it is safe unattended and why the verdict is read back",
    `THE MIRROR REPAIR, deriving its work from the SAME comparison the drift check uses.

SAFE TO FIRE UNATTENDED because it has no delete branch in either bucket and never writes to the
primary, so the worst a spurious run does is rewrite a twin with the bytes it already had. The
counts come from a SECOND comparison after the writes.`,
  ],
  "app/lib/operator/api.server.ts#24": [
    "CONTRACT",
    "why it is not an error; one line already",
    `An object that vanished between the comparison and the copy. Not an error: its twin, if it had
one, is exactly what the mirror is for.`,
  ],
  "app/lib/operator/api.server.ts#25": [
    "WHY",
    "why parsed and why base64 only",
    `A \`data:\` URI's own declaration, or null when this is bare base64. Parsed rather than stripped,
because the prefix carries the MIME type. Only base64 payloads are accepted: a percent-encoded
URI is a different encoding, and silently mis-decoding one would store rubbish under a digest
that looks perfectly valid.`,
  ],
  "app/lib/operator/api.server.ts#26": ["CONTRACT", "what it returns; one line already"],
  "app/lib/operator/api.server.ts#27": [
    "WHY",
    "why whitespace is stripped; one line already",
    `Whitespace is what a base64 blob acquires travelling through a chat or a YAML block, and \`atob\`
throws on it.`,
  ],
  "app/lib/operator/api.server.ts#28": [
    "WHY",
    "why chunked and abandoned rather than buffered",
    `The response body, up to a cap, READ IN CHUNKS AND ABANDONED AT THE CAP rather than buffered and
length-checked: a \`Content-Length\` is a claim the far end makes and a body can simply not stop,
so buffering it whole to discover that lets a remote URL decide how much memory this isolate uses.`,
  ],
  "app/lib/operator/api.server.ts#29": [
    "CONTRACT",
    "the order and why; one line already",
    `What to record when the caller did not say: the URL's last path segment first, that being the
closest thing to a name a person chose, and otherwise a default that at least describes the
object.`,
  ],
  "app/lib/operator/api.server.ts#30": [
    "CONTRACT",
    "why caught anyway; one line already",
    `An unparseable URL never gets this far, the protocol having been checked already. Caught anyway
rather than thrown out of a naming helper.`,
  ],
  "app/lib/operator/api.server.ts#31": [
    "WHY",
    "why this is not a substituted default; one line",
    `NOT a substituted default (hard rule 13): a type outside the allowlist is one statement away from
being refused, so this name is never stored. Returning \`upload.bin\` would be the substitution.`,
  ],
  "app/lib/operator/api.server.ts#32": [
    "CONTRACT",
    "the adapter rule, the two ways in, the three guards and why the declared type wins; the ruling number stays",
    `THE BUCKET, as an operator operation. Ruling 32d.

IT IS AN ADAPTER and \`storeUpload\` is the write: the allowlist, the size limit and the key are the
same code the admin upload runs. What is here is only how bytes REACH that door.

THE PRIMARY CONTROL IS THE TOKEN AND THE RATE LIMITER, said plainly because the checks below are
secondary: HTTPS only, since a fetch is the one place a caller chooses where this Worker goes; a
capped read; and the same \`validateUpload\` contract a form upload meets.

THE TYPE THE CALLER DECLARES WINS, deliberately, because a good PNG served as
\`application/octet-stream\` is common. Safe, because it is checked against the allowlist AND the
bytes, the same treatment \`file.type\` gets on the form path.`,
  ],
  "app/lib/operator/api.server.ts#33": [
    "WHY",
    "why both is refused rather than resolved",
    `EXACTLY ONE SOURCE. Both given is refused rather than resolved by a precedence rule, because a
caller that supplied both has two different images in mind and silently picking one stores the
wrong photograph under a digest that will never look wrong.`,
  ],
  "app/lib/operator/api.server.ts#34": [
    "WHY",
    "why the explicit argument wins; one line already",
    `The URI's own type only when the caller named none: an explicit argument is the more deliberate
statement of the two.`,
  ],
  "app/lib/operator/api.server.ts#35": [
    "WHY",
    "why the encoded length and why it is generous",
    `REFUSED ON THE ENCODED LENGTH, before \`atob\` allocates anything: base64 is four characters per
three bytes, so this is arithmetic on the string in hand. Deliberately GENEROUS, since it only
has to stop an absurd payload being decoded and \`validateUpload\` states the real limit.`,
  ],
  "app/lib/operator/api.server.ts#36": [
    "WHY",
    "why the protocol is re-checked after redirects",
    `THE PROTOCOL IS CHECKED AGAIN, ON WHERE IT LANDED, because \`fetch\` follows redirects and an
\`https://\` URL is free to redirect to \`http://\`. Checking only what the caller typed would make
the rule a check on their typing rather than on where the bytes came from. The fallback keeps it
closed rather than open if the post-redirect URL is ever empty.`,
  ],
  "app/lib/operator/api.server.ts#37": [
    "WHY",
    "why the split; one line already",
    `The response's own claim, only when the caller made none. Split on \`;\`, because a charset
parameter is normal on one of these types and the allowlist holds bare types.`,
  ],
  "app/lib/operator/api.server.ts#38": [
    "WHY",
    "the two reasons, and which one would have hurt",
    `COPIED INTO A FRESH ArrayBuffer rather than handed \`bytes.buffer\`. Two reasons, and the second is
the one that would have hurt: \`.buffer\` does not satisfy the door's parameter type at all, and it
is the whole underlying allocation rather than the view. It happens to be exactly the content
today because the two producers size their arrays to what they read, which is a property of those
functions rather than of this call, so a later change to either would hash and store the wrong
bytes under a key that still looks valid.`,
  ],
  "app/lib/operator/api.server.ts#39": [
    "CONTRACT",
    "placeholder, replaced by f3",
    `The editor's own two keys, from the same function that builds theirs, so the string an agent puts
in markdown and the string the editor inserts are one statement rather than two that agree today.`,
  ],
  "app/lib/operator/api.server.ts#40": [
    "CONTRACT",
    "placeholder, replaced by f3",
    `THE ANNOTATION ROW IS REPORTED, not assumed. It is written non-fatally because the object is
already in R2 and a D1 hiccup must not report failure for a write that happened, which leaves an
operator with no way to see it. \`false\` means the object landed and the row did not; the repair
is \`sync_media\`, which re-derives it.`,
  ],
  "app/lib/operator/api.server.ts#41": [
    "CONTRACT",
    "placeholder, replaced by f3",
    `THE CONTENT-DRIFT REPAIR, deriving its work from the SAME comparison the health check uses, which
is what makes a markdown commit from any machine live within one poll with no deploy. RULE 18:
scoped, but never hand-written, every drifted slug going through the one door.`,
  ],
  "app/lib/operator/api.server.ts#42": [
    "CONTRACT",
    "placeholder, replaced by f3",
    `READ BACK AFTER THE WRITES. D1 reads its own writes in-request, so a correct repair can never
report drift here and a reported drift is real.`,
  ],
  "app/lib/operator/api.server.ts#43": [
    "CONTRACT",
    "placeholder, replaced by f3",
    `What the operator can see about the state of the pipeline without guessing. The three stores are
reported SEPARATELY, because they can disagree and the whole design assumes they fail
independently.`,
  ],
  "app/lib/operator/api.server.ts#44": [
    "CONTRACT",
    "placeholder, replaced by f3",
    `EXPORTED because the cockpit renders it: rule 17 says the page renders what an instrument reports
rather than computing a second answer, so it calls THIS function and there is no admin-side copy
of the store counts to drift from it.`,
  ],
  "app/lib/operator/api.server.ts#45": [
    "CONTRACT",
    "placeholder, replaced by f3",
    `The repository's post count, from ONE Contents directory listing. The field name is the tool's
contract and is unchanged; what it has always meant is how many posts the repository holds.`,
  ],
  "app/lib/operator/api.server.ts#46": [
    "CONTRACT",
    "placeholder, replaced by f3",
    `Counted through DRIZZLE, not by interpolating the predicate into a template string, which
stringifies the expression object and makes D1 answer \`no such column\`. Locally the tool failed
earlier, at a missing token, and never reached the query, so the live round trip was the only
place this could have been found.

Hard rule 1 is why the predicate is reused rather than rewritten in SQL: a hand-copied WHERE
clause here would be exactly the drift that rule exists to prevent.`,
  ],
  "app/lib/operator/api.server.ts#47": [
    "CONTRACT",
    "placeholder, replaced by f3",
    `Counted on the docsize shadow table, never \`COUNT(*)\` on the index itself, which reads THROUGH to
the content table and can never detect drift.`,
  ],
  "app/lib/operator/api.server.ts#48": [
    "CONTRACT",
    "placeholder, replaced by f3",
    `COMMITS THAT LANDED WHILE D1 DID NOT FOLLOW: the only store here whose absence is the interesting
state, so an empty list is the normal answer. Read from KV rather than D1, because a record of a
D1 failure kept in D1 is missing exactly when it matters.

\`known: false\` is a distinct answer from an empty list: a status tool that cannot read one of its
stores must say so rather than report zero.`,
  ],
};
