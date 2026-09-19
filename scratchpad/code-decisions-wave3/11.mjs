// Chunk 11: twenty-three files, most of them already at the calibrated size.
//
// The weight is in eleven long headers. Two of them, secrets.server#0 and admin/types#2, are
// almost entirely boundary statement (what a gate CANNOT see; what the number is NOT) and barely
// move. organisms#0 and phage-hunters#0 are the opposite shape from everything else in the wave:
// their bulk is a REVIEWED EXCLUSION LIST and a ruling about a real person's name, both of which
// are the decision itself rather than the story of it.
export default {
  "app/lib/admin/secrets.server.ts#0": [
    "CONTRACT",
    "presence only, the three never-returns, and the one thing check:secrets cannot see here",
    `THE RUNTIME SECRETS AUDIT. PRESENCE ONLY, and that is a hard property rather than a habit.

\`check:secrets\` proves secrets are only READ inside the server boundary. It cannot prove they are
SET, because it never runs in the Worker. This answers the other half, at runtime, in the one place
the bindings exist.

**WHAT IT MAY RETURN IS A NAME AND A BOOLEAN. Nothing else, ever:**

  - never a VALUE, which would publish the credential to whoever opens the page and to any log
    that captures the loader payload
  - never a PARTIAL value, no prefix, no suffix, no masked middle. A masked value still leaks its
    shape, and four characters of an OAuth secret is four an attacker no longer has to guess
  - never a LENGTH, which narrows a guess for free and is the leak people forget, because it does
    not look like the secret

The boolean is computed and the value goes out of scope in the same expression, so there is no
intermediate object for a later edit to spread into the payload. \`test/secrets-audit.test.mjs\`
asserts all three refusals.

**ONE THING \`check:secrets\` CANNOT SEE HERE.** That gate finds reads by matching \`env.NAME\`; this
module reads \`env[name]\` dynamically, so the scan does not count these. Not a hole in the
boundary, because this is a \`.server\` module, which is what the rule requires. Recorded because a
reader comparing the gate's read count against the code will come up short.`,
  ],
  "app/lib/admin/secrets.server.ts#1": ["CONTRACT", "relative not the alias, and what the alias broke; at the budget"],
  "app/lib/admin/secrets.server.ts#2": ["CONTRACT", "what one entry is; one line already"],
  "app/lib/admin/secrets.server.ts#3": ["CONTRACT", "what present means and why empty is absence; at the budget"],
  "app/lib/admin/secrets.server.ts#4": ["WHY", "tested and discarded in one expression; three lines already"],

  "app/lib/auth.server.ts#0": ["CONTRACT", "per-request instance, where sessions live, and the single-admin hook; at the budget"],
  "app/lib/auth.server.ts#1": ["NUMBER", "why the floor beside the call; one line already"],
  "app/lib/auth.server.ts#2": ["CONTRACT", "what it resolves and who reads it; already short"],
  "app/lib/auth.server.ts#3": [
    "CONTRACT",
    "why two marks and not one; the diagnosis goes to history",
    `Optional collector. Absent on every request that did not ask for timing.

SPLIT INTO TWO MARKS ON PURPOSE. \`createAuth\` and \`getSession\` are one line together and two
completely different costs: CPU building an auth instance and a Drizzle adapter from scratch, then
IO against KV. A single \`auth_total\` would leave the next session guessing which, and guessing is
what the instrument exists to replace.`,
  ],
  "app/lib/auth.server.ts#4": [
    "CONTRACT",
    "set for the human admin only, and what reading it asserts",
    `Set by the admin middleware after the gate passes, so loaders under /admin read the session
without a second KV round trip.

**SET FOR THE HUMAN ADMIN ONLY.** The read-only smoke credential has no Better Auth session and
never will, so anything reading this context is asserting a human is present. That is the right
failure mode for the one remaining reader on a write path: if it were ever reached by a machine
actor it would throw rather than attribute a revision to nobody.

Anything that only needs to know WHO IS ASKING reads \`adminActorContext\`.`,
  ],
  "app/lib/auth.server.ts#5": [
    "CONTRACT",
    "the split, why it is not decorative, and why both kinds carry the same email",
    `WHO IS ASKING, for the whole \`/admin\` subtree. Always set once the gate passes.

Separate from \`adminSessionContext\` because one is a Better Auth SESSION and the other is an
IDENTITY, and only one kind of caller has a session. Collapsing them would mean synthesising a fake
\`AdminSession\` for the machine, which is the stub this repo refuses because it authenticates
through a path production does not have.

\`email\` is the SAME address for both kinds, deliberately, and it is part of the stated residue:
the smoke render has to be the page Dustin sees, down to the topbar's widest unbreakable token, or
the layout numbers taken through it are numbers about a different page.`,
  ],

  "app/lib/timing.ts#0": [
    "CONTRACT",
    "a header not a log, and that it changes no behaviour; the p50 measurement goes to history",
    `Attribution for a slow route, reported as \`Server-Timing\`.

A real response header rather than a log, because the question is about the LIVE path and a header
can be read by whatever is already making the request. Nothing here changes behaviour: the marks
are collected and emitted, and a route that never creates a collector pays nothing.`,
  ],
  "app/lib/timing.ts#1": [
    "CONTRACT",
    "why a shared collector and why a wrapper object; the unattributed measurement goes to history",
    `The per-request collector, so a MIDDLEWARE and a child LOADER can write into one list and the
route emits a single header. The admin plane needs it because the auth gate runs in \`admin.tsx\`
and the queries live in child routes, so without a shared collector the session lookup is
measurable only by subtracting one route's total from another's.

Held in a WRAPPER OBJECT whose \`timings\` is optional, rather than as a nullable context value. The
context default then describes "nobody asked" without the type admitting undefined, so a route
that reads this before any middleware ran gets the same answer as a request without \`?timing=1\`.`,
  ],
  "app/lib/timing.ts#2": ["CONTRACT", "what asks to be measured; one line already"],
  "app/lib/timing.ts#3": ["CONTRACT", "optional so the wrapper degrades to a plain call; already short"],
  "app/lib/timing.ts#4": ["WHY", "in a finally, so a throwing call still reports; three lines already"],
  "app/lib/timing.ts#5": [
    "WHY",
    "the instrument may not change what it measures",
    `Runs \`fn\` and records how long it took, for a SYNCHRONOUS call.

\`createAuth()\` is the reason this exists: it is synchronous, so wrapping it in the async \`timed\`
would add an await to the UNINSTRUMENTED path as well. That would be an instrument changing the
thing it measures, which is the one thing an instrument may not do.

Same contract as \`timed\`: no collector, no cost.`,
  ],
  "app/lib/timing.ts#6": ["CONTRACT", "names are stripped to a token, and what a malformed header costs; already short"],

  "app/lib/admin/types.ts#0": ["CONTRACT", "type-only, so nothing here may execute or touch bindings; already short"],
  "app/lib/admin/types.ts#1": [
    "CONTRACT",
    "two arms and the prohibition the third one broke; the removed interface goes to history",
    `What a panel receives from a source that can fail.

TWO ARMS, and the third is what was removed. It was \`{ status: "stub"; data: T; note: string }\`,
so a panel could render invented data while announcing that the real integration was pending.
AN ARM THAT SAYS "THIS NUMBER IS NOT REAL" IS A LICENCE TO SHOW A NUMBER THAT IS NOT REAL. Nothing
renders invented data any more.`,
  ],
  "app/lib/admin/types.ts#2": [
    "CONTRACT",
    "origin requests are a floor not a measure, and the number is sampling weighted; both are boundary statements",
    `One row of the origin-requests panel.

ORIGIN REQUESTS, not reads. Analytics Engine is written from the Worker's response path, and with
the Workers cache on an edge HIT serves a reader without the Worker running at all. The number is
therefore a FLOOR under readership rather than a measure of it, and every label on this panel says
so.

\`originRequests\` is SAMPLING WEIGHTED: it is \`SUM(_sample_interval)\`, not a row count, because
Analytics Engine samples under load and a raw count silently undercounts once it does. \`rows\`
carries the unweighted count purely as the diagnostic that shows whether sampling is engaged.`,
  ],
  "app/lib/admin/types.ts#3": ["CONTRACT", "what it is; one line already"],
  "app/lib/admin/types.ts#4": ["CONTRACT", "why the total is carried; one line already"],
  "app/lib/admin/types.ts#5": ["CONTRACT", "what it counts; one line already"],
  "app/lib/admin/types.ts#6": [
    "CONTRACT",
    "why complete exists: a missing slug is a measured zero or unknown, and the column must render them differently",
    `Origin requests for the whole window, indexed by path, for the post list.

\`byPath\` carries only paths that HAD activity, so a missing slug means one of two different things
and \`complete\` is the difference: with it true a missing slug is a MEASURED ZERO; with it false the
query's limit cut the result and a missing slug is UNKNOWN. The column renders those differently
and must.

The number is \`SUM(_sample_interval)\` and is a FLOOR under readership, for the reason \`TrafficRow\`
states.`,
  ],
  "app/lib/admin/types.ts#7": ["CONTRACT", "what it is; one line already"],
  "app/lib/admin/types.ts#8": ["CONTRACT", "what an absent path means; one line already"],
  "app/lib/admin/types.ts#9": ["CONTRACT", "what it counts; one line already"],
  "app/lib/admin/types.ts#10": ["CONTRACT", "what it says; one line already"],

  "app/lib/blog-view.ts#0": [
    "CONTRACT",
    "one projection so the preview's claim cannot go quietly false, and that it is pure",
    `The loader payload one post page renders from, built in ONE place.

Two routes render a post, \`/blog/:slug\` and \`/preview/:token\`, and they differ in exactly one
respect: the row they are allowed to fetch. Everything after that is identical, and this is the
"identical" written down.

THE PREVIEW'S WHOLE CLAIM is that a reviewer sees what a reader would see. A second projection
would let that claim go quietly false, because a column added to the public page and not to this
one shows up as a section missing from the preview, which is the drift a preview exists to make
impossible.

Pure, and it reads no clock and no environment, so the two routes cannot differ by timing either.`,
  ],
  "app/lib/blog-view.ts#1": ["CONTRACT", "what it is; one line already"],
  "app/lib/blog-view.ts#2": [
    "CONTRACT",
    "why the neighbours are widened, and what disproves the inferred type",
    `A blog row as either reader hands it over.

The neighbours are WIDENED to nullable here rather than taken as \`getBlogPost\` infers them: its
\`previous ?? null\` narrows back to non-null, because the array destructure it comes from is not
index-checked, so the inferred type says a post always has a neighbour. Every post at either end
of the corpus disproves that, and a draft preview has neither by design.`,
  ],
  "app/lib/blog-view.ts#3": ["CONTRACT", "a malformed column costs a section, never the page; already short"],
  "app/lib/blog-view.ts#4": ["CONTRACT", "type annotation only; kept"],
  "app/lib/blog-view.ts#5": ["CONTRACT", "the pointer; one line already"],
  "app/lib/blog-view.ts#6": ["WHY", "a malformed toc costs a contents list, not the page; one line already"],
  "app/lib/blog-view.ts#7": [
    "CONTRACT",
    "why it is top level, what types the name, and why it is derived rather than stored",
    `AT THE TOP LEVEL OF THE PAYLOAD, not inside \`post\`, because root reads it with
\`useRouteLoaderData\` and a nested field would make root know the shape of this route's \`post\` as
well as its own name for the flag. The name is the contract between the two files and NOTHING TYPES
IT: root casts what the hook returns, so \`check:page-payload\` asserts both spellings against each
other.

Derived from the html rather than stored, so nothing has to migrate, sync or stay true.`,
  ],
  "app/lib/blog-view.ts#8": [
    "CONTRACT",
    "optional because it is a migration, and what an old row degrades to; the date goes to history",
    `OPTIONAL, and that is the migration rather than sloppiness. Rows written before the field was
added to the stored blob carry none until the next sync or save rewrites them, and the renderer
shows it only when present, so an old row degrades to the bare title it always was instead of
rendering "undefined".`,
  ],

  "app/lib/editor/draft-buffer.ts#0": [
    "CONTRACT",
    "local and only local, never publishes, and the base-commit key rule",
    `The editor's crash net.

Save equals commit here, so autosaving to the server would write git history every few seconds.
The buffer is therefore LOCAL AND ONLY LOCAL, it is never the thing that publishes, and nothing in
this module touches the network.

The key carries the BASE COMMIT the editor loaded against. A buffer written on top of commit A is
not safely restorable over content loaded from commit B, so rather than offering a restore that
would silently revert someone else's change, a buffer from a different base does not match the key
and is never offered. The editor's conflict rule refuses the save in that situation anyway.`,
  ],
  "app/lib/editor/draft-buffer.ts#1": ["CONTRACT", "what it is; one line already"],
  "app/lib/editor/draft-buffer.ts#2": ["CONTRACT", "what it holds; one line already"],
  "app/lib/editor/draft-buffer.ts#3": ["CONTRACT", "why these are never restored; already short"],
  "app/lib/editor/draft-buffer.ts#4": ["CONTRACT", "what a new post keys on; three lines already"],
  "app/lib/editor/draft-buffer.ts#5": ["CONTRACT", "what it reads; one line already"],
  "app/lib/editor/draft-buffer.ts#6": ["WHY", "the editor still works without a crash net, and says so; two lines already"],
  "app/lib/editor/draft-buffer.ts#7": ["CONTRACT", "why every base commit is dropped after a save; at the budget"],
  "app/lib/editor/draft-buffer.ts#8": ["CONTRACT", "as above; one line already"],
  "app/lib/editor/draft-buffer.ts#9": [
    "CONTRACT",
    "the two key schemes and how they are told apart; the three found in a browser go to history",
    `Removes buffers written under the pre-Session-2 key scheme, \`post-draft:<slug>\` and
\`post-draft:new\`, which carried no base commit. A legacy key can never match a lookup and is never
offered, so it is dead storage rather than a hazard.

A slug is kebab-case and cannot contain a colon, so the two schemes are told apart by counting
segments: three means current, two means legacy.`,
  ],
  "app/lib/editor/draft-buffer.ts#10": ["CONTRACT", "why a matching buffer is not offered; at the budget"],

  "app/lib/media/resolvers.server.ts#0": [
    "CONTRACT",
    "the seam's cost stated so it can be judged, and the structured-result rule",
    `THE RESOLVER SEAM. Shape 2 of media-module-architecture.md.

The media core asks "who cites this key?" and content types answer. This is the ONLY part that
varies per content type, because everything else about an object is true regardless of what links
to it.

**What adding a second content type costs, stated so the seam can be judged rather than trusted:**
one \`resolvers/<type>.server.ts\` exporting a \`ReferenceResolver\`, and one line in \`RESOLVERS\`
below. Nothing else, because the core, the media page, the delete action and the refusal message
are each written against \`MediaCitation\`. If a future type needed more, the seam is wrong and
should be fixed rather than worked around.

Resolvers return STRUCTURED results, never booleans. A boolean would have to be widened at every
call site the first time a refusal needed to say which post and which reference form.`,
  ],
  "app/lib/media/resolvers.server.ts#1": ["CONTRACT", "what it is; one line already"],
  "app/lib/media/resolvers.server.ts#2": ["CONTRACT", "what it is; one line already"],
  "app/lib/media/resolvers.server.ts#3": ["CONTRACT", "what it is; one line already"],
  "app/lib/media/resolvers.server.ts#4": ["CONTRACT", "what it is; one line already"],
  "app/lib/media/resolvers.server.ts#5": ["CONTRACT", "what it is; one line already"],
  "app/lib/media/resolvers.server.ts#6": ["CONTRACT", "what it is; one line already"],
  "app/lib/media/resolvers.server.ts#7": ["CONTRACT", "why batched and not per key; already short"],
  "app/lib/media/resolvers.server.ts#8": ["CONTRACT", "why an array and not a runtime register(); at the budget"],
  "app/lib/media/resolvers.server.ts#9": ["CONTRACT", "what false means for a delete; already short"],
  "app/lib/media/resolvers.server.ts#10": ["CONTRACT", "what it carries; one line already"],
  "app/lib/media/resolvers.server.ts#11": ["WHY", "failure is reported, never swallowed, and delete fails closed; at the budget"],

  "app/routes/api.operator.ts#0": [
    "CONTRACT",
    "why a resource route and why one POST taking tool and args; the MCP timing goes to history",
    `The operator publish endpoint.

A RESOURCE ROUTE, no default export, so the action can return a raw Response. A document route's
loader hands its return value to a component and 500s on the first property read; the same reason
/search/ask and the markdown twins are resource routes.

One POST endpoint taking \`{ tool, args }\` rather than five REST paths, so an MCP front end can be
layered over it later without reshaping anything: \`tools/call\` carries exactly a name and an
argument object.`,
  ],
  "app/routes/api.operator.ts#1": ["CONTRACT", "never cached and never indexed; one line already"],
  "app/routes/api.operator.ts#2": [
    "CONTRACT",
    "metered here because this is the call that does something; the split date goes to history",
    `METERED HERE, because this is the call that does something, and immediately after the identity is
proven, so the limiter is keyed to a real operator and an unauthenticated flood cannot reach a
Durable Object. Grounds on \`meterOperator\`.`,
  ],
  "app/routes/api.operator.ts#3": [
    "CONTRACT",
    "authenticated, spends no limit, and derived from the descriptors; the drift story goes to history",
    `GET describes the tools, behind the same token: an unauthenticated caller learns nothing,
including whether the endpoint exists in a useful form.

IT SPENDS NO RATE LIMIT. This call takes no arguments and changes nothing, so it authenticates and
stops there. Metering it meant a client that read the description before each publish halved its
own allowance.

DERIVED from \`TOOL_DESCRIPTORS\`, never written here. A local copy of the list drifted exactly as
rule 17 says a second copy does, leaving tools callable that the description named nowhere. The
table is keyed by \`ToolName\`, so a tool this list omits is a typecheck failure in \`api.server.ts\`,
not a silent gap on the wire.`,
  ],

  "app/lib/editor/divergence.server.ts#0": [
    "CONTRACT",
    "why KV, why one key per slug, and the eventual-consistency boundary",
    `Where a recorded D1 divergence lives, and how the status surface reads it.

**IT IS KV, AND THAT IS THE WHOLE DESIGN DECISION.** The record says "D1 could not be written", so
putting it in D1 would make it absent in exactly the circumstance it exists to describe.

**ONE KEY PER SLUG, not one list.** A single key holding an array would be a read-modify-write, and
two saves failing at once would lose one record to the race. A key per slug has no race and is
naturally idempotent.

**OBSERVATION BOUNDARY.** \`listDivergences\` uses KV \`list\`, which is EVENTUALLY CONSISTENT, so an
empty result is "none visible", not "none exist". That is acceptable because the operator has
already been told directly, in the error that raised it; this surface is the second reader. It
would NOT be acceptable as the only alarm, and nothing treats it as one.`,
  ],
  "app/lib/editor/divergence.server.ts#1": ["CONTRACT", "what it is; already short"],
  "app/lib/editor/divergence.server.ts#2": ["WHY", "no TTL, and the reassuring-silence failure it avoids; at the budget"],
  "app/lib/editor/divergence.server.ts#3": ["CONTRACT", "what clears it; one line already"],
  "app/lib/editor/divergence.server.ts#4": ["CONTRACT", "fails soft in its return value rather than throwing; at the budget"],
  "app/lib/editor/divergence.server.ts#5": ["WHY", "an unparseable key is still evidence; two lines already"],

  "app/lib/health/snapshot.server.ts#0": ["CONTRACT", "one writer, one reader, and what a writing reader would undo; at the budget"],
  "app/lib/health/snapshot.server.ts#1": [
    "CONTRACT",
    "never throws, awaited rather than deferred, no expiry, and the stated degradation",
    `Stores the verdict. NEVER throws.

A failed snapshot write must not turn a healthy site into a 500 on the one endpoint the alerting
workflow reads, nor turn an unhealthy site into a different failure that hides which check broke.
Bookkeeping never costs a caller their response. THE CONSEQUENCE IS STATED RATHER THAN HIDDEN: if
KV is failing the snapshot ages, and the home tile reports it as stale.

Awaited rather than deferred to \`waitUntil\`, so a caller that reads this endpoint and then reads
the home page sees a consistent pair.

NO EXPIRY. A snapshot that expired would report \`missing\`, which reads as "something is
misconfigured"; one that ages reports \`stale\` WITH ITS AGE, which is the more useful sentence when
the poller has stopped.`,
  ],
  "app/lib/health/snapshot.server.ts#2": ["WHY", "a snapshot write must not cost the verdict; one line already"],
  "app/lib/health/snapshot.server.ts#3": ["CONTRACT", "a throw is treated as absence, and why they read the same; already short"],

  "app/lib/content/render-snippet.server.ts#0": ["CONTRACT", "imported for its side effect, and why Workers need it; already short"],
  "app/lib/content/render-snippet.server.ts#1": [
    "CONTRACT",
    "why a named export is what removes it from the client build, and that the resolver refuses",
    `The playground's markdown demo, as one server-only call.

**WHY A NAMED EXPORT.** React Router removes server-only code by tracing which route exports USE an
import, so \`search.server\` referenced only inside \`loader\` goes with the loader. A BARE
SIDE-EFFECT IMPORT BINDS NO NAME: there is nothing to trace, nothing to attribute to \`loader\`, and
the only safe conclusion the bundler can draw is that the client needs it. The build refuses it in
as many words. So the side effect moves behind a named export the route uses only in its loader.

**THE RESOLVER REFUSES, and that is this module's other job.** The playground's snippets cite no
media and none may: the alternative is a resolver reaching a bucket from a public page on behalf
of committed fixture text. Refusing here rather than in the route means the refusal cannot be
forgotten by the next caller, and \`check:features\` asserts the same thing about the snippets so
the failure names the snippet rather than the render.

@param slug the snippet's slug, used only to label a refusal
@param body the committed snippet source`,
  ],

  "app/lib/editor/feedback.ts#0": [
    "CONTRACT",
    "why the URL carries a success, why a failure cannot, and that everything parsed is untrusted",
    `The editor's one feedback slot: what it can say, and how a success survives the redirect.

A save is post/redirect/get, so the outcome crosses a navigation. It crosses in the URL rather than
a flash cookie: no server state, identical with scripting off, and a reload re-renders rather than
re-posting.

A FAILURE cannot travel this way, because a redirect would throw away the body the author just
typed, so failures stay in the action result. Both sources feed the same component, so there is
still one place a save can speak from.

Everything parsed here is UNTRUSTED, because the address bar is editable. A value that does not
match its shape is dropped rather than rendered, which is why the shas and the date are
pattern-checked and the slug is never read from the query at all.`,
  ],
  "app/lib/editor/feedback.ts#1": [
    "CONTRACT",
    "what the two fields are and why they are optional; the date goes to history",
    `\`field\` and \`line\` come from \`EditorError\`, which has carried both since it was written.
Optional because most refusals have neither; the display renders what it is given and says nothing
when it is given nothing.`,
  ],
  "app/lib/editor/feedback.ts#2": ["CONTRACT", "why short; one line already"],
  "app/lib/editor/feedback.ts#3": ["CONTRACT", "always the edit route, and why; at the budget"],
  "app/lib/editor/feedback.ts#4": ["CONTRACT", "null for anything that does not match, and what a missing date degrades to; at the budget"],

  "app/routes/theme.ts#0": ["CONTRACT", "why the Referer and why it is checked against this origin; at the budget"],
  "app/routes/theme.ts#1": [
    "WHY",
    "origin first, and the absent-Origin allowance the no-script half needs; the measurement goes to history",
    `ORIGIN FIRST, before the body is even read. A POST here sets a cookie, so it is a mutating route
and takes the same predicate \`/search/ask\` and the admin plane take.

AN ABSENT ORIGIN IS STILL ALLOWED, and that is the whole reason this is a predicate rather than a
same-origin comparison written inline: this form is the NO-SCRIPT half of the theme toggle, a
scriptless form post carries no \`Origin\`, and refusing it would break the fallback hard rule 9
requires. The literal string "null" is a different thing and is refused.`,
  ],
  "app/routes/theme.ts#2": [
    "WHY",
    "a refusal rather than a default, and why the refusal is no-store; the date goes to history",
    `ONLY THE WRITABLE THEMES ARE ACCEPTED. Substituting a default for anything unrecognised is the
fail-open direction hard rule 13 is about: a malformed request became a silent theme change rather
than an error.

A REFUSAL RATHER THAN A DEFAULT. Nothing legitimate reaches this branch, because the control posts
the value of the button that was visible and both carry a writable theme, so a request arriving
with anything else is hand-made and 400 tells its author the truth.

\`no-store\` for the reason the origin refusal above carries it: a refusal that could be cached is a
refusal served to somebody else.`,
  ],
  "app/routes/theme.ts#3": ["CONTRACT", "what a GET means; one line already"],

  "app/routes/blog.feed[.json].ts#0": [
    "CONTRACT",
    "the shared visibility read, where the shape is asserted, and why the cap is in the query",
    `JSON Feed 1.1, alongside RSS.

Reads through listBlogPostsFullText, so publiclyVisible() applies on exactly the same terms as the
index, the RSS feed and llms-full.txt. Each item is built by \`feedItem\` in app/lib/json-feed.mjs,
where \`node:test\` asserts the shape: THIS FILE ONCE PROMISED \`content_text\` IN A COMMENT WHILE
THE ITEM MAP EMITTED NO CONTENT FIELD AT ALL, which JSON Feed 1.1 forbids, and no gate could see a
comment disagreeing with a map three lines under it.

The cap is applied in the query, not by slicing a full read, because every item carries its whole
markdown body.`,
  ],
  "app/routes/blog.feed[.json].ts#1": ["CONTRACT", "one envelope, and which member a copy would get wrong; at the budget"],
  "app/routes/blog.feed[.json].ts#2": [
    "NUMBER",
    "why the content type is not the SHOULD, with the size that decided it; the grounds stay beside the header",
    `\`application/json\`, NOT \`application/feed+json\`, and the reason is 160 KB.

JSON Feed 1.1 says the content type SHOULD be \`application/feed+json\`. Cloudflare compresses a
fixed list of content types and \`+json\` suffixed types are not on it, so obeying the SHOULD made
the largest response on the site the only one shipping raw and uncompressed.

Every reader identifies this document by the \`version\` member inside it, which is unchanged; the
content type is how it travels. Trading a SHOULD for what a subscriber actually downloads is the
right way round.`,
  ],

  "app/data/organisms.ts#0": [
    "CONTRACT",
    "an allowlist, the ordering and case rules, and the reviewed exclusions, which ARE the decision",
    `Organism names to italicize when rendering publication titles and abstracts.

A REVIEWED ALLOWLIST, NOT A PATTERN. Matching on "Capitalized lowercase" pairs would italicize Rio
Grande, Cancer Handbook, Phage Therapy and dozens of ordinary sentence openings, so every entry
here was read in context first.

Order matters: longest first. The matcher takes the first alternative that fits, so "Meleagris
gallopavo intermedia" has to precede "Meleagris gallopavo" or the subspecies epithet is left
upright. Matching is case sensitive, so the genus capital is required, which keeps the bare genus
"Mycobacterium" from colliding with ordinary prose.

Deliberately NOT included: virus AGENT names, because ICTV italicizes formal taxa rather than
vernacular agent names and these titles use the agent form throughout; PHAGE ISOLATE names, which
are strain names and stay upright; common names and protein families, such as "Rhesus macaques"
and "Rho family"; and "Siphoviridae", a formal ICTV family-rank taxon that arguably belongs here,
left open rather than decided silently.`,
  ],
  "app/data/organisms.ts#1": ["CONTRACT", "the ordering rule; one line already"],
  "app/data/organisms.ts#2": ["CONTRACT", "the section label; one line already"],
  "app/data/organisms.ts#3": ["CONTRACT", "why only this genus is bare; three lines already"],

  "app/components/admin/disclosure.ts#0": [
    "CONTRACT",
    "why it is shared, why the disclosure stays markup, and the ARIA ruling",
    `The three behaviours a bare \`<details>\` disclosure does not have.

Shared by \`OverflowMenu\` and \`RowMenu\`, because the alternative is two implementations of Escape,
arrow keys and close-on-outside-click that would drift the first time one of them was fixed.

THE DISCLOSURE ITSELF STAYS MARKUP. What hides behind these controls are REPAIR operations, which
is exactly the set you reach for when something is already broken, so opening one must not require
script. As markup it opens, closes and reports its own expanded state with nothing loaded; this
only adds the keyboard and dismissal manners on top.

ARIA: deliberately a DISCLOSURE, not \`role="menu"\`. Every item is a submit button inside its own
form, and a \`role="menu"\` container owes \`menuitem\` children it directly owns; interleaving forms
breaks that, and the menu roles would suppress the native button semantics the items already have.

@param ref The \`<details>\` element this manages.`,
  ],
  "app/components/admin/disclosure.ts#1": ["CONTRACT", "why focus returns to the control; two lines already"],
  "app/components/admin/disclosure.ts#2": ["CONTRACT", "pointerdown rather than click, and why; two lines already"],
  "app/components/admin/disclosure.ts#3": ["CONTRACT", "why it closes on activation; three lines already"],

  "app/routes/admin.preview.ts#0": [
    "CONTRACT",
    "one renderer, read-only despite the POST, and that it is behind the admin gate",
    `The exact preview.

It renders a submitted body through \`app/lib/content/pipeline.mjs\`, the same module the build
script and the Worker import. There is ONE renderer on this site and this route does not become a
second one: it returns what \`renderBody\` gives back, unmodified, so the preview IS what publishes.

READ ONLY, worth being precise about because it is a POST: it touches no database, writes no file,
commits nothing, and reaches R2 only to MEASURE images the body already references.

It sits under \`/admin\`, so the layout middleware has already required the single-admin session.
There is no unauthenticated way to make the Worker render arbitrary markdown.`,
  ],
  "app/routes/admin.preview.ts#1": [
    "CONTRACT",
    "the same transform from the same module; the 14-byte measurement goes to history",
    `THE SAME transform the save path applies, from the same module, so the two cannot drift again. A
multipart body arrives with every newline normalized to CRLF, and rendering that raw is what made
the preview differ from the published artifact.`,
  ],
  "app/routes/admin.preview.ts#2": ["CONTRACT", "labels errors as the save path does; two lines already"],
  "app/routes/admin.preview.ts#3": [
    "WHY",
    "why a preview failure is a 200",
    `A preview failure is ordinary: the author is mid-sentence and the directive is half typed. It
reports the pipeline's own message and a 200, because the REQUEST succeeded and it is the content
that is not ready. A non-2xx would make the client treat a routine typo as a broken endpoint and
stop previewing.`,
  ],

  "app/lib/webmention/advertise.ts#0": [
    "CONTRACT",
    "two readers one address, and why SITE_ORIGIN rather than the request's",
    `WHERE THIS SITE SAYS ITS WEBMENTION ENDPOINT IS.

TWO READERS, ONE ADDRESS. A post advertises the endpoint twice, because senders look in two
places: a \`Link\` header, readable from a HEAD request without parsing anything, and a
\`<link rel="webmention">\` in the head. Both are the protocol's discovery order and neither is
optional if the other exists, since a sender that finds one and not the other concludes the site
changed its mind. One constant here, because two spellings of an address is an address that goes
half-stale.

\`SITE_ORIGIN\`, matching \`linkToMarkdown\`, so the two values in one header name the same host by
construction. Deriving this from the REQUEST's origin would put two different hosts in one header
during the cutover, which is the window where a sender is most likely reading it for the first
time. The endpoint's own \`siteOrigins\` accepts both spellings on the way IN, which is the
asymmetry that makes this safe: this site advertises one address and answers to two.`,
  ],
  "app/lib/webmention/advertise.ts#1": ["CONTRACT", "why a function rather than a second constant; already short"],

  "app/lib/context.ts#0": ["CONTRACT", "what it carries and who sets it; already short"],
  "app/lib/context.ts#1": [
    "CONTRACT",
    "why a nonce cannot be an exit-path mutation, and why it is its own context",
    `The per-request CSP nonce.

**This is the one piece of response policy that is NOT an exit-path mutation.** \`UNCACHED\` and
\`SECURITY_HEADERS\` in \`workers/app.ts\` are stamped onto a finished response and need to know
nothing about the render. A nonce cannot work that way: the same value has to appear in the
\`Content-Security-Policy\` header AND on every \`<script>\` in the body, so it must exist BEFORE the
render and be readable from inside it.

A separate context rather than a field on \`cloudflareContext\`, because the nonce is not a binding
and every existing \`getEnv\` call site would otherwise have to learn about it.`,
  ],
  "app/lib/context.ts#2": ["CONTRACT", "what it returns when unset; one line already"],
  "app/lib/context.ts#3": ["CONTRACT", "what it is for, and never make a reader wait for bookkeeping; already short"],

  "app/lib/nav.ts#0": [
    "CONTRACT",
    "one consumer, and the mirror that is now unrepresentable; the dated second reader goes to history",
    `THE HEADER'S LINKS, in one place.

\`site-header.tsx\` renders a NavLink per entry and is the ONLY consumer. A second one read this
list to build a Speculation Rules payload, and **that mirror is gone**: the rules are document
rules now (\`~/lib/speculation.mjs\`), matching the links in the rendered document rather than a
list of paths, so a header link is covered because it is an \`<a href>\` and not because someone
kept two arrays in step. The drift this module was written to prevent is not merely gated, it is
unrepresentable.

\`HEADER_PATHS\` was deleted with it: a derived export whose only reader has gone is dead
configuration that reads as load-bearing.

Roster's LABEL and its PATH deliberately disagree; see site-header.tsx.`,
  ],
  "app/lib/nav.ts#1": ["CONTRACT", "the position is the decision; at the budget"],

  "app/routes/publications[.json].ts#0": [
    "CONTRACT",
    "why this export is unfiltered, and why it comes from the source file",
    `The whole corpus as CSL JSON.

**UNFILTERED, unlike every other export, and the reason is what CSL IS.** BibTeX and RIS are for
putting citations in a document, where a conference abstract beside the paper it became
double-counts a work. CSL JSON is the BIBLIOGRAPHIC RECORD: a consumer asking for this file is
asking what exists, not what the index chose to display.

**STRAIGHT FROM THE SOURCE FILE.** \`data/publications.csl.json\` already IS CSL JSON, so rebuilding
one from \`publications.ts\` would be a second, lossier derivation of something the repo holds
canonically. The one transformation is decoding character references, which are a property of this
site's markup rather than of the record.`,
  ],
  "app/routes/publications[.json].ts#1": ["CONTRACT", "why the specific media type and what the generic one would fail to say; already short"],

  "app/lib/editor/link-targets.server.ts#0": [
    "CONTRACT",
    "one module, every post is offered with its state, and why stateOf is called on the server",
    `The posts the editor's Cmd+K palette can link to.

ONE module, because both the edit route and the new-post route need the same list and a second
derivation is how they would come to disagree about which posts are public.

**Every post is offered, including the ones that are not live, and each carries its state.**
Offering only published posts is the safe default and the wrong one: an author who cannot find a
scheduled part in the palette pastes the path from memory, which is what produces a typo. What must
not happen is inserting a link that 404s WITHOUT SAYING SO, so the state travels with the target.

\`stateOf\` is the editor's own transition module, so "published" here means what it means
everywhere else on this plane. It reads the clock, so it is called HERE, on the server.`,
  ],
  "app/lib/editor/link-targets.server.ts#1": ["CONTRACT", "why the mapping happens here; three lines already"],

  "app/data/phage-hunters.ts#0": [
    "CONTRACT",
    "why it is a data file, the neutral-alt ruling, why alt is not empty, and the names ruling",
    `Year-by-year roster of the SEA-PHAGES research cohort at Tarleton State.

Structured content edited by commit, so it lives here rather than in the D1 \`posts\` table, whose
single body column would flatten the structure. Photo dimensions are the real output of
scripts/resize-phage-photos.mjs and differ by year, so they are recorded per photo to keep layout
shift at zero.

ALT TEXT IS DELIBERATELY NEUTRAL, on a page whose whole point is that it carries names and nothing
else; if descriptive copy returns here, the alt text is part of that decision. It is NOT emptied,
because these photos are half the page's content rather than decoration, and \`alt=""\` on a content
image is a WCAG failure.

**THE NAMES ARE AS GIVEN, and there is no open question about any of them.** A speculative
respelling of a real person's name, published on the page that lists them, is a worse error than an
unhyphenated one, and a comment inviting the next reader to make that edit is the same error with a
delay on it.`,
  ],
};
