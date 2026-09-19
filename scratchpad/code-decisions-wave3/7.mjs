// Chunk 7: enhance/theme.ts, workers/media-events.ts, routes/webmention.ts, routes/search.ask.ts
// and lib/media/core.server.ts.
//
// Two public unauthenticated write paths and the queue consumer behind the media index, so the
// bounds and the refusals are the content. The dated measurements they were derived from (the
// vitePreload bytes, the A004 bucket defect, the VP8L placeholder audit, the prompt echo) go to
// the history document; the rule each one produced stays.
export default {
  "app/enhance/theme.ts#0": [
    "CONTRACT",
    "the law, the no-flash rule and why the palette loader lives here; the bundle arithmetic goes to the history document",
    `Theme toggle enhancement, and the door the search palette comes through.

EVERYTHING HERE REMOVES A ROUND TRIP AND NOTHING HERE MAKES THE CONTROL WORK: with this file
absent the form posts to \`/theme\` and the server renders the chosen theme. Both paths end at the
same cookie.

There is deliberately no "apply the stored theme on load" step: the server already wrote the
attribute, so a script that re-applied it could only agree, or race.

WHY THE PALETTE LOADER LIVES HERE: the shortcut needs only a keydown listener on load, and this is
the smallest genuinely site-wide module. Putting it here costs one document nothing; a second
site-wide bundle costs every document.`,
  ],
  "app/enhance/theme.ts#1": [
    "CONTRACT",
    "why there is no re-run guard and why the listener is on the document",
    `Loaded by a script tag whose module executes once per document, so there is no re-run to guard
against: without hydration every navigation is a fresh document. Listening on the document keeps
the handler working wherever the toggle is placed.`,
  ],
  "app/enhance/theme.ts#2": ["CONTRACT", "why the submitter is read; two lines already"],
  "app/enhance/theme.ts#3": [
    "CONTRACT",
    "one predicate for both halves of the control",
    `THE WRITABLE SET, which is exactly what \`/theme\` accepts. One predicate for both, so the
enhancement cannot apply a value its own fallback would reject.`,
  ],
  "app/enhance/theme.ts#4": [
    "CONTRACT",
    "why an event rather than an import, and why no nonce is needed; the measured helper bytes go to history",
    `The event \`app/enhance/palette.ts\` listens for. One spelling, two files.

A custom event rather than a dynamic \`import()\`, because vite rewrites every \`import()\` into its
preload helper, which is a large fraction of this bundle in order to manage a preload graph that
does not exist: build-enhance emits one self-contained chunk per module.

A script element inserted by a script that is already trusted is allowed by \`script-src
'strict-dynamic'\` with no nonce, which is why this needs no access to the request nonce.`,
  ],
  "app/enhance/theme.ts#5": ["CONTRACT", "what the flag guards; one line already"],
  "app/enhance/theme.ts#6": [
    "CONTRACT",
    "the fallback rule and why the first gesture waits for load",
    `Opens the palette, fetching it first if this is the first gesture.

FAILURE FALLS BACK TO THE PAGE, NEVER TO NOTHING. The caller has already prevented the anchor's
default, so a load error would leave a reader who clicked with no response at all. \`/search\` is
the same destination the anchor carries.

The first gesture dispatches from the script's own \`load\`, because the listener on the other side
does not exist until the module has executed.`,
  ],
  "app/enhance/theme.ts#7": [
    "CONTRACT",
    "why the URL is read off the element and what its absence means",
    `The URL is hashed by the app build, so it cannot be written down here: the \`?url\` import in
\`search-trigger.tsx\` is the one statement of it. No attribute means no palette, rather than a
broken one.`,
  ],
  "app/enhance/theme.ts#8": [
    "CONTRACT",
    "why the stylesheets travel with the bundle, why awaited, and why a failed sheet resolves",
    `THE DIALOG'S STYLESHEETS TRAVEL WITH ITS BUNDLE, and they are awaited. The palette's CSS exists
for markup that does not exist until somebody searches, so it comes down here from
\`data-palette-css\` rather than on every document.

AWAITED, because the bundle calls \`showModal\` the moment it runs and a stylesheet still in flight
at that point is an unstyled modal on screen.

A FAILED STYLESHEET RESOLVES rather than rejecting: an unstyled dialog is bad and no dialog is
worse, so only the SCRIPT failing is treated as failure.`,
  ],
  "app/enhance/theme.ts#9": [
    "WHY",
    "why the helper went with its caller",
    `\`isTyping\` WENT WITH THE BARE SLASH. Cmd/Ctrl-K needs no such guard, and a helper kept past its
only caller is dead code that reads as load-bearing.`,
  ],
  "app/enhance/theme.ts#10": [
    "CONTRACT",
    "the honesty contract on the hint; the surface change goes to the history document",
    `Binds the two ways into search and makes the shortcut discoverable.

THE HINT IS TOLD HERE AND NOWHERE ELSE, which is the promise it has always made: nothing
advertises the shortcut until the shortcut works, so a reader whose script did not run is never
told about a key that would do nothing for them. The two surfaces are \`title\` for a pointer and
the \`aria-describedby\` region for a screen reader, and both are set from here.`,
  ],
  "app/enhance/theme.ts#11": [
    "CONTRACT",
    "one spelling of the chord, and why the detection may be best-effort; the measured divergence goes to history",
    `THE CHORD, SPELLED FOR THE PLATFORM, AND THE ONLY PLACE IT IS SPELLED. A chord spelled in two
places stops agreeing the day one is edited, and the half that rots is the one nobody can see.

\`userAgentData.platform\` first because \`navigator.platform\` is deprecated, then the old property,
then the userAgent string. Getting this wrong costs a reader the wrong modifier NAME, not a broken
control: the listener takes meta OR ctrl either way, which is why the detection may be best-effort
here and may not be in the handler.`,
  ],
  "app/enhance/theme.ts#12": [
    "CONTRACT",
    "the order of the two writes",
    `THE TEXT IS WRITTEN BEFORE THE UNHIDE, not after. Unhiding first would open a window, however
short, in which the stale server placeholder is the announced description.`,
  ],
  "app/enhance/theme.ts#13": [
    "CONTRACT",
    "why the tooltip is not server-rendered",
    `THE TOOLTIP IS SET HERE RATHER THAN SERVER-RENDERED: a \`title\` the server wrote would promise a
shortcut to a reader who has no script to answer it.`,
  ],
  "app/enhance/theme.ts#14": ["CONTRACT", "why a modified click is left alone; one line already"],
  "app/enhance/theme.ts#15": [
    "WHY",
    "why the slash is gone and why the chord stays",
    `THE BARE SLASH IS GONE. It collides with find-in-page, which is a browser affordance readers
already own. Cmd/Ctrl-K stays: it collides with nothing a browser binds, and it is not advertised
to a reader who has no script to answer it.`,
  ],
  "app/enhance/theme.ts#16": [
    "CONTRACT",
    "why the attribute is always written and why returning to the default needs no line",
    `A FLIP, so the attribute is always written. Returning to the default is not a submission and
needs no line here: a reader clears the cookie and the next render omits the attribute
server-side, which is where the default has always been applied.`,
  ],
  "app/enhance/theme.ts#17": [
    "CONTRACT",
    "the cascade owns the redraw, and why focus has to move anyway",
    `THE CONTROL REDRAWS ITSELF FROM THE ATTRIBUTE, so there is nothing here. Both buttons are in the
DOM and the sheet displays whichever matches \`data-theme\`; swapping an icon or a label from here
would be a second owner of a decision the cascade already makes.

FOCUS HAS TO MOVE, THOUGH, and that is not cosmetic. The button just activated is the one the
cascade hides, and \`display: none\` on the focused element drops focus to \`<body>\`. So focus moves
to the button that replaced it, but ONLY when the hidden one actually held focus: a pointer click
leaves focus wherever the browser put it, and stealing it there would be its own defect.`,
  ],

  "workers/media-events.ts#0": [
    "CONTRACT",
    "notification not dual write, who the authoritative writer is, idempotence, and why the object is re-read; the cost arithmetic goes to the history document",
    `The media index write path: R2 emits, a queue delivers, this derives the row.

AN EVENT NOTIFICATION, NOT A DUAL WRITE. Writing R2 and then D1 from one request is the dual-write
problem: one succeeds, the other fails, and the two diverge silently.

R2 IS THE WRITE THAT MATTERS AND THIS CONSUMER IS THE AUTHORITATIVE ROW WRITER. The upload route
writes a row for immediacy alone, non-fatally, precisely because this consumer re-derives and
overwrites it. R2 WINS any disagreement in both senses: the row is rebuilt from the object, never
the reverse, and a row whose object is gone is deleted.

IDEMPOTENT BY CONSTRUCTION RATHER THAN BY CHECKING, so a replay, a double delivery and an
out-of-order pair all converge. Queues guarantees at-least-once delivery, so this is a requirement.

THE OBJECT IS RE-READ RATHER THAN TRUSTED FROM THE EVENT: by the time a notification is handled
the object may have been replaced, which is what lets a \`PutObject\` for a vanished object
correctly delete the row instead of resurrecting it.`,
  ],
  "workers/media-events.ts#1": [
    "CONTRACT",
    "why the message is narrowed rather than typed",
    `The one thing this consumer needs out of a notification, read defensively rather than typed as a
contract. A queue message is external input, so declaring a message type would assert a shape
nothing verified. The key is NARROWED out of \`unknown\` and anything that fails to yield one is a
bad message rather than a crashed batch.`,
  ],
  "workers/media-events.ts#2": [
    "CONTRACT",
    "the prohibition on a second copy and what the wrong bucket does; the A004 defect goes to the history document",
    `\`bucketFor\` MOVED to \`classify.mjs\`, and it must be ONE function rather than three that happen
to agree. THIS MUST ASK, NOT ASSUME: a missing object is treated as a deletion, so reading the
wrong bucket for a key does not merely fail to index, it DELETES the row. Both buckets notify this
queue, so the rule has to hold in code rather than in dashboard configuration.
\`check:invariants\` fails if a second copy appears anywhere.`,
  ],
  "workers/media-events.ts#3": ["CONTRACT", "why a malformed message is acked; two lines already"],
  "workers/media-events.ts#4": [
    "CONTRACT",
    "why a transient failure is not acked",
    `RETRY, explicitly. A transient D1 or R2 failure must not be acked, or the row silently never
appears and only \`check:media\` would notice. After the configured attempts the platform moves the
message to the dead-letter queue.`,
  ],
  "workers/media-events.ts#5": [
    "CONTRACT",
    "why it does not branch on the action, and what a static key would mean",
    `Brings the index into line with the object, whatever the event claimed.

DELIBERATELY NOT BRANCHING ON THE ACTION. Asking R2 what is true now handles a \`PutObject\` for
something already deleted and a \`DeleteObject\` for something already replaced, which is what makes
out-of-order delivery safe; branching would make the answer depend on an ordering Queues does not
promise.

A \`static\` key can never arrive here: those objects are in no bucket and emit no notifications. If
one ever does, that is the bug to fix rather than this line.`,
  ],
  "workers/media-events.ts#6": [
    "CONTRACT",
    "R2 wins, and why the branch is logged",
    `R2 WINS. The object is gone, so the row goes. Never the reverse: nothing in this file writes to
the bucket. LOGGED, because this branch is indistinguishable from the bug it hides: a genuine
delete and a key looked for in the wrong bucket both land here and both ack silently.`,
  ],
  "workers/media-events.ts#7": [
    "CONTRACT",
    "why an unreadable image still gets a row",
    `An unreadable image still gets a row. NULL already means "not measured" in this schema, and
refusing the row outright would make the index disagree with the bucket, which is the one thing it
may never do.`,
  ],
  "workers/media-events.ts#8": [
    "CONTRACT",
    "why it is derived here, why a second get, and that null is a real answer; the deferral defect goes to the history document",
    `THE PLACEHOLDER, DERIVED HERE. Deferring it to the bulk rebuild did not postpone the work, it
destroyed it: the row this consumer writes carried no placeholder, and the upsert then erased
whatever the last bulk pass had derived.

A SECOND R2 GET, because a body is a stream and \`.info()\` has consumed the first. Same pattern the
rebuild uses, for one class B operation per uploaded image.

NULL IS A REAL ANSWER. An SVG, a PDF or a corrupt upload has no placeholder and gets a row anyway.
\`placeholderFor\` returns null rather than throwing, so it cannot send an otherwise good row to the
dead-letter queue.`,
  ],
  "workers/media-events.ts#9": [
    "CONTRACT",
    "why the name comes off the object, and what null means downstream",
    `Read off the OBJECT, so this path does not depend on the upload route's D1 write having
succeeded. That write is non-fatal by design and a content-addressed key cannot yield a filename,
so the name had one source that was allowed to fail. Null for anything uploaded without it, which
\`upsertDerivedMedia\` treats as "do not touch".`,
  ],
  "workers/media-events.ts#10": [
    "CONTRACT",
    "what null means here; trimmed to two lines",
    `Derived above, from a second read of the same object. Null when the transformer could not read
it, which \`upsertDerivedMedia\` treats as "do not touch" rather than as an instruction to erase.`,
  ],
  "workers/media-events.ts#11": [
    "CONTRACT",
    "same read, MEDIA only, nothing deletes a twin, and why failure is swallowed",
    `THE SECOND DERIVED ACTION: the mirror.

The row and the twin are derived from the SAME object read, so the mirror inherits every property
that makes this path replay-safe. It is not a dual write: the Worker writes only to MEDIA.

MEDIA ONLY. An \`r2-derived\` key is an OG card, regenerable by \`build:og\` and deliberately
emptiable, so mirroring it would back up the one thing that already has a rebuild door.

NOTHING HERE DELETES A TWIN, and the absence is the design. D1 is a projection of R2 and the
backup is not: it is the copy that survives the delete, so pruning the mirror is a human act.
\`check:destructive\` fails on a delete against MEDIA_BACKUP anywhere in this repository.

Failure is LOGGED AND SWALLOWED rather than retried: the row is already correct, and a missing
twin is drift the health poll sees and \`backup_media\` repairs.`,
  ],

  "app/routes/webmention.ts#0": [
    "CONTRACT",
    "the four bounds, the without-the-limiter rule, what it does not do, and the no-IP claim; the argument's provenance goes to the history document",
    `The webmention receiver.

THE SECOND PUBLIC, UNAUTHENTICATED POST ENDPOINT ON THIS SITE, and the first that writes a row. It
has to be public: a webmention is sent by another site's server with no credential to offer.
\`api.csp-report.ts\` refuses to write rows because an unauthenticated endpoint that writes them is
a storage-exhaustion primitive handed to the internet. This one cannot log instead, because the
deliverable IS the stored mention, so the argument is answered rather than avoided.

FOUR BOUNDS, AND THEY ARE THE WHOLE ANSWER:

1. Per-IP rate, on the existing \`AskBudget\` object under a \`wm:<ip>\` instance.
2. The target must already be a publicly visible post here, read through the DB chokepoint.
3. One row per (source, target), a unique index, so a re-send UPDATES and repetition costs nothing.
4. A global cap on open rows, answered 503. This is the bound that does not depend on the other
   three being right, and it is what makes the storage claim a fact rather than an argument.

WITHOUT \`ASK_BUDGET\` THIS DOES NOT SERVE, the stance every metered path here takes.

IT RENDERS NOTHING. An accepted mention reaches \`unverified\`, then \`pending\` if the source really
links here, and stops; approval is a human action.

IT STORES NO IP ADDRESS. The limiter's counter expires with its window, and the row carries only
what the sender's own page says.`,
  ],
  "app/routes/webmention.ts#1": ["NUMBER", "why the cap is generous; already short"],
  "app/routes/webmention.ts#2": [
    "NUMBER",
    "why the cap is small and why a 503; the corpus size goes to history",
    `The ceiling on \`unverified\` plus \`pending\` rows. The fourth bound.

WHY IT IS SMALL: a higher number buys a real sender nothing on a personal site and only raises the
storage an attacker who defeats bounds 1 to 3 can take. The refusal is RECOVERABLE by the action
that was needed anyway, which is the admin moderating the queue.

A 503 rather than a 429, because the condition is about this site's state rather than the caller's
rate, and a well-behaved sender retrying later is the right response.`,
  ],
  "app/routes/webmention.ts#3": ["CONTRACT", "why every answer carries it; one line already"],
  "app/routes/webmention.ts#4": [
    "CONTRACT",
    "one message for four problems, and the oracle it prevents; the hard rule citation stays",
    `WHAT A REFUSED SENDER IS TOLD, and it is deliberately one string for four different target
problems. Especially the draft: a distinct message would turn this endpoint into an oracle for
unpublished slugs, which is hard rule 1's leak arriving through a 400 instead of through a page.`,
  ],
  "app/routes/webmention.ts#5": [
    "CONTRACT",
    "why two origins rather than one",
    `The origins this site answers on, for both the target and the source checks. TWO RATHER THAN
ONE: the site is pre-cutover, so pinning to a constant would refuse every real request from
whichever host is not the constant at exactly the moment of the move. \`app/lib/origin.mjs\` makes
the argument at length.`,
  ],
  "app/routes/webmention.ts#6": ["CONTRACT", "why the fallback narrows; one line already"],
  "app/routes/webmention.ts#7": ["CONTRACT", "one construction site; one line already"],
  "app/routes/webmention.ts#8": ["CONTRACT", "the first gate; one line already"],
  "app/routes/webmention.ts#9": [
    "CONTRACT",
    "why the header check refuses but never permits",
    `CONTENT-LENGTH IS A HINT FROM THE CLIENT, so it refuses early and never permits. An honest
oversized header is rejected without touching the body; a missing or lying one falls through to
\`readCapped\`, which counts the bytes as they arrive.`,
  ],
  "app/routes/webmention.ts#10": ["CONTRACT", "what an absent limiter means; one line already"],
  "app/routes/webmention.ts#11": [
    "CONTRACT",
    "why the limiter precedes the body read; the hard rule citation stays",
    `THE RATE LIMIT PRECEDES THE BODY READ. Every check below it costs something: a materialised
body, a form parse, a D1 read. The limiter costs one Durable Object call and is the only thing
here that bounds how often the rest can be reached, which is hard rule 19's chain applied to this
route: each stage refuses before the next spends anything.

Keyed on the edge-set client IP rather than anything in the body, which the caller controls.`,
  ],
  "app/routes/webmention.ts#12": [
    "CONTRACT",
    "why one encoding only",
    `THE FORM ENCODING, checked on the HEADER before the body is read, because it is free there. The
protocol specifies this one encoding, so accepting JSON as well would be inventing a dialect
nobody sends and giving the parser a second shape to be wrong about.`,
  ],
  "app/routes/webmention.ts#13": ["CONTRACT", "the order of the two target checks; already short"],
  "app/routes/webmention.ts#14": ["CONTRACT", "why the source is refused before the write; two lines already"],
  "app/routes/webmention.ts#15": [
    "CONTRACT",
    "why the visibility read is last among the refusals",
    `THE VISIBILITY READ, AFTER the source check on purpose. Both are refusals; only this one costs a
query, and a caller sending garbage sources should not be able to make this site read D1 for each
one. A draft, a scheduled post and a slug that names nothing are one answer.`,
  ],
  "app/routes/webmention.ts#16": [
    "CONTRACT",
    "what the cap is and the race it accepts",
    `THE GLOBAL CAP, the fourth bound, read immediately before the write it guards. It is a count and
not a reservation, so two requests arriving together can both pass at the boundary. That is
accepted and stated rather than papered over: the failure is one row past a cap chosen with an
order of magnitude of headroom, and the alternative is a second Durable Object.`,
  ],
  "app/routes/webmention.ts#17": ["CONTRACT", "what the row means at this point; one line already"],
  "app/routes/webmention.ts#18": [
    "CONTRACT",
    "why the answer precedes verification and why waitUntil",
    `VERIFICATION AFTER THE ANSWER. The sender gets 202 immediately, which is what the protocol asks
for and what keeps a slow source off the critical path. \`waitUntil\` rather than a queue, which
would be new infrastructure for a load of zero. What a cut-short \`waitUntil\` leaves behind is on
\`verifyWebmention\`.`,
  ],
  "app/routes/webmention.ts#19": [
    "CONTRACT",
    "why a GET answers, and that it reveals nothing",
    `A GET says what this is rather than 404ing, so anyone who finds the endpoint knows what they are
looking at. It reveals nothing: the text is true of every webmention receiver on the internet.`,
  ],

  "app/routes/search.ask.ts#0": [
    "CONTRACT",
    "resource route, nothing waits on it, and the cheapest-first order",
    `Ask mode's streaming endpoint. Search Layer 2.

A RESOURCE ROUTE, deliberately: it has no default export, so it may return a raw Response.

NOTHING ELSE ON THE SITE WAITS ON THIS. It is fetched by the Ask panel after classic results have
rendered, and only when the server said the binding exists. With scripting off nothing requests it.

This is the only public endpoint on the site that costs money per request, so it is the only one
with guards in front of it, cheapest-first: refuse before spending, serve a cached answer before
generating, and only then reach the model.`,
  ],
  "app/routes/search.ask.ts#1": ["NUMBER", "what the bound balances; one line already"],
  "app/routes/search.ask.ts#2": [
    "CONTRACT",
    "what passes and what must not be replayed",
    `Whether every post a cached answer cites is still publicly visible. An answer with no resolvable
citations passes, since it cited nothing this site owns. An answer citing a post that is now a
draft, deleted or scheduled forward fails and MUST NOT BE REPLAYED.`,
  ],
  "app/routes/search.ask.ts#3": ["CONTRACT", "one reading of the chunk shape; two lines already"],
  "app/routes/search.ask.ts#4": ["CONTRACT", "what the headers are and why never cached; one line already"],
  "app/routes/search.ask.ts#5": ["CONTRACT", "why no edge caching; two lines already"],
  "app/routes/search.ask.ts#6": ["CONTRACT", "what the header defeats; one line already"],
  "app/routes/search.ask.ts#7": ["CONTRACT", "what the header makes testable; two lines already"],
  "app/routes/search.ask.ts#8": ["CONTRACT", "what it is and when 503; one line already"],
  "app/routes/search.ask.ts#9": [
    "CONTRACT",
    "why GET is refused and why 405 rather than 404",
    `GET IS REFUSED, EXPLICITLY. This endpoint spends money and per-IP budget, so it must not be
reachable by anything that follows a URL on its own initiative: a crawler, a prefetch, an
\`<img src>\` on any site, a preview unfurler. A GET that bills is a side-effecting GET, and the
method is the only part of that a third party cannot choose for us.

405 with \`Allow\` rather than 404: the endpoint exists, the method is wrong, and saying so is what
stops the next caller reinventing the GET.`,
  ],
  "app/routes/search.ask.ts#10": [
    "CONTRACT",
    "why origin is gate 0, what the per-IP limiter cannot see, and why absent is allowed",
    `GATE 0, AND IT IS FIRST BECAUSE IT IS FREE. One header read, no env, no body, no binding.

A foreign page cannot be allowed to spend the shared Ask budget using its own readers' browsers,
and the per-IP limiter cannot see that attack at all: a thousand readers of one hostile page are a
thousand addresses, each well inside its own allowance. Origin is the one field on a cross-site
POST the attacking page does not control.

ABSENT Origin is ALLOWED: a client that sends none is spending its own address's allowance, which
is already bounded, and refusing it would break a no-script form without buying anything.`,
  ],
  "app/routes/search.ask.ts#11": [
    "CONTRACT",
    "why 404 rather than 503",
    `404 rather than 503. With the binding absent this endpoint does not exist, which is the same
story the rest of the site tells: Ask is absent, not broken. A 503 would imply something is meant
to be here and is down.`,
  ],
  "app/routes/search.ask.ts#12": [
    "CONTRACT",
    "why the body is form-encoded",
    `The question travels in a FORM-ENCODED BODY, which is what an ordinary \`<form method="post">\`
sends. Ask has no no-script form today, but reading the body this way means adding one later is
markup and nothing else.`,
  ],
  "app/routes/search.ask.ts#13": ["CONTRACT", "one statement of the read; two lines already"],
  "app/routes/search.ask.ts#14": [
    "CONTRACT",
    "why the limiter is in front of the cache",
    `Gate 1, per IP. In front of everything, including the cache: a cached answer is cheap but not
free. NOTHING PAST THIS LINE HAS TOUCHED WORKERS AI.`,
  ],
  "app/routes/search.ask.ts#15": [
    "CONTRACT",
    "the replay must prove its citations, and why it is checked on replay; the leak's provenance goes to history",
    `Gate 2, the cache. A hit is one KV read, reaches no model, consumes no budget, and is replayed
in the same SSE shape so the client cannot tell a replay from a generation.

A HIT MUST STILL PROVE ITS CITATIONS ARE PUBLIC. The cache is dropped on publish by a KV \`list\`,
which is eventually consistent, so an answer written moments before a post is unpublished can
survive the invalidation meant to remove it.

Checked on REPLAY rather than at write time, because the corpus can change after the answer is
already in KV. One indexed D1 read buys the property that no unpublished post is citable.`,
  ],
  "app/routes/search.ask.ts#16": ["CONTRACT", "what a stale hit does; two lines already"],
  "app/routes/search.ask.ts#17": [
    "CONTRACT",
    "there is no single-flight and why the ceiling is the real bound; the generation timings go to the history document",
    `Gate 3, the exact daily ceiling. Reserved here and nowhere else, because this is the last point
before the only line in the file that costs money.

THERE IS DELIBERATELY NO SINGLE-FLIGHT. Concurrent misses of one question each reserve and each
generate, and the bound is what makes that acceptable: deduplicating does not lower the worst
case, since an attacker with N addresses spends the same N units asking N DIFFERENT questions.

What it would recover is duplicated work in the benign case, for one generation's window, at the
cost of a Durable Object instance per distinct question and a follower that must block.`,
  ],
  "app/routes/search.ask.ts#18": [
    "CONTRACT",
    "the order of the guard and the tee",
    `GUARD FIRST, THEN TEE, and the order is the whole point. The guard can replace a zero-chunk
generation with the no-answer text, and the cache has to accumulate what the READER saw. Teeing
first would store the model's original while showing the reader the substitution.`,
  ],
  "app/routes/search.ask.ts#19": ["CONTRACT", "why caching happens after the reader; two lines already"],
  "app/routes/search.ask.ts#20": [
    "CONTRACT",
    "the two refusals and what each one bounds; the audit's measurement goes to history",
    `TWO REFUSALS, and neither is the other's backstop.

An answer with NO CHUNKS was not drawn from this site. The guard has already replaced it for the
reader, and caching the substitution would make "I could not find anything" the permanent answer
for a week, including after the post that answers it is published.

An answer that ECHOES THE PROMPT is a successful injection. Not caching it is what keeps the blast
radius at the one request that performed it, rather than serving it from KV to everyone who asks
the same thing.`,
  ],
  "app/routes/search.ask.ts#21": [
    "CONTRACT",
    "why a stream failure is not a 500",
    `The instance being unreachable must not surface as a 500 on a page that already rendered its
real results. The client treats any non-200 as "Ask is unavailable" and removes the panel.`,
  ],

  "app/lib/media/core.server.ts#0": [
    "CONTRACT",
    "content-agnostic by construction and what that buys",
    `MEDIA CORE. Library listing, upload, thumbnails, metadata and delete mechanics.

This module knows nothing about what cites an object. CONTENT-AGNOSTIC BY CONSTRUCTION, NOT BY
CONVENTION: there is no import of anything post-shaped in this file and no parameter that could
carry one. "Who cites this key?" is asked through the resolver seam and the answer arrives as data
the core never inspects, which is what lets another type register later without this file changing.`,
  ],
  "app/lib/media/core.server.ts#1": ["CONTRACT", "what the page size is for; one line already"],
  "app/lib/media/core.server.ts#2": [
    "CONTRACT",
    "what the constant was for and why it is gone",
    `\`DERIVED_PREFIX\` is GONE. It excluded \`og/\` keys beside its own copy of the key grammar, and the
grammar now has one owner whose pattern admits no slash, so an \`og/\` key fails the shape test
itself and the prefix check had nothing left to refuse.`,
  ],
  "app/lib/media/core.server.ts#3": [
    "CONTRACT",
    "why the set is closed",
    `Widths the thumbnail route will honour. A CLOSED SET, because the width lands in a cache key and
an open one lets any caller mint unlimited distinct transforms of the same object, each a billed
transformation.`,
  ],
  "app/lib/media/core.server.ts#4": ["CONTRACT", "what it holds; one line already"],
  "app/lib/media/core.server.ts#5": ["CONTRACT", "the stored form; one line already"],
  "app/lib/media/core.server.ts#6": ["CONTRACT", "what false means; one line already"],
  "app/lib/media/core.server.ts#7": [
    "CONTRACT",
    "URL-derived, and nothing written back",
    `The URL that renders this object at a thumbnail width. URL-DERIVED: the width is in the URL, the
transform happens on request from the single original in R2, and no variant is ever written back.`,
  ],
  "app/lib/media/core.server.ts#8": [
    "CONTRACT",
    "why a static key is returned untouched and what that costs; the 58 broken rows go to history",
    `A STATIC ASSET IS ITS OWN PUBLIC PATH and already begins with \`/\`, so prefixing \`/media/\` yields
a double slash the R2 route 404s on. It is served by the assets host directly, so it needs no
transform URL and gets none.

The cost is that it is delivered at full size into a thumbnail box. These are small files and a
correct image beats a resized 404; serving static transforms would mean teaching \`/media/*\` to
read through ASSETS.`,
  ],
  "app/lib/media/core.server.ts#9": ["CONTRACT", "what it answers; one line already"],
  "app/lib/media/core.server.ts#10": [
    "CONTRACT",
    "why the type is derived and what the gate asserts; the twelve-axis defect goes to the history document",
    `The listing axes, DERIVED from \`listMediaPage\` rather than restated here.

Restating them is what broke \`listMedia\`: the options type named half the axes, the loader
forwarded all of them through an object SPREAD, and spreads are exempt from excess-property
checking, so the rest were accepted by the compiler and dropped on the floor.

Deriving the type means a new axis is covered by construction instead of by somebody remembering.
\`check:media-axes\` asserts both halves: that this stays derived, and that the forwarding stays a
spread.`,
  ],
  "app/lib/media/core.server.ts#11": [
    "CONTRACT",
    "why it reads D1 and why reading a derived copy is legitimate here",
    `Lists one page of the library FROM D1.

IT NO LONGER TOUCHES R2, and that is the point of the index. Listing from the bucket could only
paginate in key order, which stopped meaning anything when keys became content-addressed digests,
and every question the library asks is a query.

D1 is DERIVED, so this is reading a copy, and that is legitimate for one reason: the copy is
exhaustively reconcilable against its source and \`check:media\` reconciles it in both directions.
R2 remains the truth for what exists.`,
  ],
  "app/lib/media/core.server.ts#12": ["CONTRACT", "why a spread and not a key list; two lines already"],
  "app/lib/media/core.server.ts#13": ["CONTRACT", "why a static asset is not routed; already short"],
  "app/lib/media/core.server.ts#14": [
    "CONTRACT",
    "why the measurement comes before the key",
    `Intrinsic dimensions of bytes in hand, before anything has been stored. The upload path needs
the measurement BEFORE it has a key, because the key carries the dimensions, so it is an INPUT to
the key rather than a lookup after the fact. Measuring once for both means the key and the row
cannot disagree about the same image.`,
  ],
  "app/lib/media/core.server.ts#15": ["CONTRACT", "why an SVG records nothing; two lines already"],
  "app/lib/media/core.server.ts#16": ["NUMBER", "what it is and who measures its cost; one line already"],
  "app/lib/media/core.server.ts#17": [
    "CONTRACT",
    "why LQIP, why null is allowed, why the quality is not optional, and why it lives here; the VP8L audit goes to the history document. The rule pointer stays",
    `A tiny base64 data URI standing in for the image until it loads.

LQIP rather than ThumbHash or BlurHash: both need client-side decoding and the public plane ships
no framework script (rule 4). What it costs is MEASURED by \`check:image-weight\` and stated
nowhere else.

Returns null rather than throwing: an image the transformer cannot read simply has no placeholder,
and that must not fail a rebuild or a queue message.

THE QUALITY IS NOT OPTIONAL. The binding emits LOSSLESS WebP when none is given, which is the
worst possible answer in the one column whose purpose is to inline.

IT LIVES HERE because it has two callers, the bulk rebuild and the queue consumer, and a
measurement with two implementations is two answers.`,
  ],
  "app/lib/media/core.server.ts#18": [
    "CONTRACT",
    "mechanics only, and where the safety belongs",
    `Deletes one object. MECHANICS ONLY.

There is deliberately no reference check in here. This module cannot see citations and must not
appear to: a \`deleteMedia\` that sometimes refused would invite a caller to treat it as the safety,
and the safety belongs in the action where the resolver's answer is available.`,
  ],
  "app/lib/media/core.server.ts#19": [
    "CONTRACT",
    "it delegates, and what the shape test refuses; the stale regex goes to history",
    `True when the key is one this module is willing to touch. DELEGATES TO THE GRAMMAR'S OWNER and
carries no pattern of its own: a reader that restates a grammar fails exactly when the writer
moves, and \`isContentKey\` sits beside the writer.

What the shape test refuses on this module's behalf: anything with a slash, so a traversal
segment, a leading \`/\` static path and an \`og/\` derived key all fail, and anything that is not a
digest-plus-extension a real upload could have produced.`,
  ],
};
