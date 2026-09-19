// Chunk 10: markdown-twin, api.csp-report, bearer.server, citations.server, enhance/ask,
// editor/action.server, operator/auth.server, admin.media.upload, workers/ask-budget,
// webmention/decide.server, data/publications and media/resolvers/posts.server.
//
// Three headers here are the wave's densest measurement: markdown-twin#4 carries a cache-variant
// experiment and the paragraph it reversed, ask-budget#0 and #5 carry the concurrency runs that
// chose a Durable Object. The RULE each one establishes is one or two sentences; everything that
// established it goes to the document. posts.server#0 is the opposite case: its bulk is the
// "what it would MISS" list, which is the boundary statement a delete depends on, so the list
// survives and only its examples go.
export default {
  "app/lib/markdown-twin.ts#0": ["CONTRACT", "the two representations and why one module; at the header budget"],
  "app/lib/markdown-twin.ts#1": ["CONTRACT", "what the header points at; one line already"],
  "app/lib/markdown-twin.ts#2": ["CONTRACT", "what the header points at; one line already"],
  "app/lib/markdown-twin.ts#3": ["CONTRACT", "one parser, two callers, and why a drift would be silent; at the budget"],
  "app/lib/markdown-twin.ts#4": [
    "CONTRACT",
    "the never-stored rule, the per-caller policy and the Vary rule; the measurement and the reversed paragraph go to history",
    `The markdown representation of a post, with its headers.

**NEVER STORED UNDER \`/blog/:slug\`, and this is not a performance oversight.** That route sets
\`Vary: Accept, Cookie\`, and the \`Cookie\` dimension collapses once a second variant exists under
the key: a cookie-bearing request then HITs the stored cookieless variant, the Worker never runs,
and the \`private, no-store\` downgrade in \`workers/app.ts\` never fires. A response that is never
stored cannot become that second variant. Do not "optimise" this back to \`SHARED_CACHE_CONTROL\`.

**THE POLICY IS THE CALLER'S**, because the two face different situations. \`/blog/:slug\`
negotiating on Accept is never stored, for the whole reason above. \`/blog/:slug.md\` at its own URL
is publicly cached: one representation under that key, so there is no second variant for a Cookie
dimension to collapse against.

**\`Vary: Accept\` GOES ON THE NEGOTIATED RESPONSE ONLY.** Under \`/blog/:slug.md\` the body does not
depend on Accept at all, and advertising a dimension the Workers Cache key cannot honour is worse
than advertising none. \`media.$.ts\` records that mistake in full.`,
  ],
  "app/lib/markdown-twin.ts#5": ["CONTRACT", "keyed off the policy, and why not a second flag; already short"],

  "app/routes/api.csp-report.ts#0": [
    "CONTRACT",
    "the unauthenticated-sink argument, the three limits and the refusal; the window date goes to history",
    `The CSP violation sink. Under enforcement a report means something was BLOCKED.

**THIS IS A PUBLIC, UNAUTHENTICATED POST ENDPOINT.** It has to be: browsers send reports with no
credentials, and a report that needs a token is a report nobody sends. So it is written as a sink
that cannot be turned into anything useful, and the limits below are the whole of that argument.

**It LOGS the report and deliberately does not write D1.** An unauthenticated endpoint that writes
rows is a storage-exhaustion primitive handed to the internet. Persisting reports is a ruling with
its own retention and privacy questions, not a quiet schema change.

Three limits, cheapest first: METHOD, anything but POST is 405 and reads nothing; a BODY CAP
checked against \`Content-Length\` before the body is read; and a PER-IP RATE LIMIT on the existing
\`AskBudget\` Durable Object under \`csp:<ip>\`, no new class and no migration.

**The limit is deliberately loose**, because the deliverable here is the report itself and a page
that trips ten rules sends ten. A limit that silently ate them would make the observation window
lie in the safe direction, which is the worst direction for this endpoint.

**Without \`ASK_BUDGET\` the endpoint refuses**: an unprotected public write path does not serve.
Always 204 on success, because a browser does not read the body and an error status makes it
retry.`,
  ],
  "app/routes/api.csp-report.ts#1": ["NUMBER", "why 8 KB beside the constant; one line already"],
  "app/routes/api.csp-report.ts#2": [
    "WHY",
    "the header refuses early and never permits; the Number(?? '0') defect goes to history",
    `CONTENT-LENGTH IS A HINT FROM THE CLIENT, so it is used to refuse early and NEVER to permit. An
honest oversized header is rejected here without touching the body; a missing or lying one falls
through to \`readCapped\` below, which counts the bytes as they arrive.`,
  ],
  "app/routes/api.csp-report.ts#3": ["WHY", "not configured means not open; one line already"],
  "app/routes/api.csp-report.ts#4": ["CONTRACT", "keyed on the edge-set IP, not the body; two lines already"],
  "app/routes/api.csp-report.ts#5": [
    "WHY",
    "the cap is on the stream, not the slice; the previous comment's false claim goes to history",
    `READ THE STREAM AND STOP AT THE CAP. \`request.text()\` materialises the whole body before a
\`.slice()\` can shorten it, so a slice bounds what is LOGGED and never what is RECEIVED.
\`readCapped\` cancels the stream the moment the count crosses the limit, so a client that omits or
understates Content-Length gets the same treatment as one that declares it honestly.`,
  ],
  "app/routes/api.csp-report.ts#6": [
    "CONTRACT",
    "the two rules that survive: JSON-encoded so a body cannot forge log lines, and unparsed so neither report shape is dropped",
    `One line, prefixed so it can be filtered out of the log stream, and JSON-encoded so a body
containing newlines cannot forge additional lines past the [csp-report] prefix. The body stays
UNPARSED: both the legacy report-uri shape and the report-to batch shape land here, and a parser
that understood only one would silently drop the other.`,
  ],
  "app/routes/api.csp-report.ts#7": ["CONTRACT", "what a GET says and that it reveals nothing; already short"],

  "app/lib/bearer.server.ts#0": [
    "CONTRACT",
    "why one copy, and the path rule that keeps it a .server module; the extraction and the missing-test story go to history",
    `The two primitives every static bearer credential in this repo needs.

A SECOND COPY OF A CONSTANT-TIME COMPARISON is the rule 17 defect where it is least affordable: a
copy that drifts toward \`===\` is a token recoverable a byte at a time, and it drifts in silence,
because both spellings return the same booleans for every input a test would think to try.

BOTH BODIES WERE LIFTED VERBATIM and proven equivalent by differential over real inputs, with the
comparison shown able to discriminate, per hard rule 12.

\`test/bearer.test.mjs\` asserts that a PREFIX is refused, and carries the naive prefix-bounded
implementation as a control. It does NOT assert constant time: timing a comparison in-process
measures the garbage collector, and a flaky assertion in the suite that gates a deploy teaches
people to re-run until green. \`check:policy\` asserts the ordering below by position.

This is a \`.server\` module because hard rule 3 is a PATH rule. Neither function reads \`env\`, so
\`check:secrets\` has nothing to say about the file, and that is not a licence to move it.`,
  ],
  "app/lib/bearer.server.ts#1": [
    "WHY",
    "the timing leak and why both sides are hashed first; trimmed to the two rules",
    `Compares two strings without leaking where they diverge.

A plain \`===\` returns as soon as two bytes differ, so the time it takes is a function of how much
of the prefix the caller guessed, which is enough to recover a token a byte at a time. Both sides
are hashed to a fixed 32 bytes FIRST: comparing the raw strings would still leak their LENGTH
through the loop bound.`,
  ],
  "app/lib/bearer.server.ts#2": [
    "WHY",
    "why the length is folded in first and why the loop is branch-free",
    `THE LENGTH DIFFERENCE IS FOLDED IN FIRST, which is what makes the \`?? 0\` below safe: if the
lengths ever did differ, \`diff\` is already non-zero before the loop starts, so the read can never
flip the answer to "equal".

Branch-free on purpose. An early return inside the loop would be a data-dependent exit from a
function whose whole job is not to have one.`,
  ],
  "app/lib/bearer.server.ts#3": [
    "CONTRACT",
    "what the label supports and what it does not; the corrected sentence goes to history",
    `A short, stable, non-reversing label for a token holder. It goes into commit messages and
rate-limit keys, so it must identify the caller without being the secret: eight hex characters of
FNV-1a, stable across requests and different after a rotation.

**IT DOES NOT "REVEAL NOTHING".** A 32-bit non-cryptographic digest supports that the label is not
the token and cannot be read back into one. It does NOT support a claim about an attacker holding
the label and a guess, who can confirm the guess by hashing it. The security boundary is
\`constantTimeEqual\` above, and that distinction is why a non-cryptographic hash is acceptable
here at all.`,
  ],

  "app/lib/citations.server.ts#0": ["CONTRACT", "the four rules this file enforces; already a list of rules at the budget"],
  "app/lib/citations.server.ts#1": [
    "WHY",
    "why a URL and not an address, and why the address is not quoted here either; the removal date goes to history",
    `THE CALLER'S NAME, AND DELIBERATELY NOT AN ADDRESS. OpenAlex removed the \`mailto\` polite pool, so
an address buys nothing from the vendor, and \`check:config\` refuses a real configured value
appearing in a tracked file, which that address is: it is also the watchdog's ALERT_EMAIL.

The address is not written out here either, for the reason it was removed: that gate reads the
WHOLE file and does not strip comments, which is correct. A value quoted in a comment is still the
value, sitting in git.`,
  ],
  "app/lib/citations.server.ts#2": ["CONTRACT", "what the field is; one line already"],
  "app/lib/citations.server.ts#3": ["CONTRACT", "what the field is; one line already"],
  "app/lib/citations.server.ts#4": ["CONTRACT", "taken, never constructed; one line already"],
  "app/lib/citations.server.ts#5": ["CONTRACT", "why the prefix bumped; already short"],
  "app/lib/citations.server.ts#6": ["WHY", "a KV hiccup must not take the page down; one line already"],
  "app/lib/citations.server.ts#7": [
    "CONTRACT",
    "the key is mandatory, env not globalThis, and never the author endpoint; the vendor change and the old contract go to history",
    `ONE WORK BY DOI, WITH THE KEY, AND THE KEY IS MANDATORY.

A keyless request draws on a shared budget of about 100 credits before every later one is refused,
so the optional path is not a polite fallback, it is a guaranteed failure with a \`4xx\` that this
function converts to \`null\` and the page renders as silence. A missing key SHORT CIRCUITS rather
than firing a request that cannot succeed. The User-Agent stays: it identifies the caller, which
costs nothing.

**\`env\`, NOT \`globalThis\`.** Secrets and bindings arrive on \`env\`, per request; a
\`globalThis\` read is a no-op that looks like a feature flag and stays a no-op after the key is
set, which is the worst version of this bug. Portfolio rule and this repo's binding rule: read off
the request context, never a global.

Singleton lookup, 1 credit. Never the author endpoint, which has works by other people merged into
it, and never a filter query from here.`,
  ],
  "app/lib/citations.server.ts#8": ["CONTRACT", "what it returns and what a cold DOI renders; already short"],
  "app/lib/citations.server.ts#9": ["WHY", "an unset secret degrades to stale, never to blank or zero; at the budget"],
  "app/lib/citations.server.ts#10": ["WHY", "after the response, so a cold cache costs nothing; one line already"],
  "app/lib/citations.server.ts#11": ["CONTRACT", "nothing to do; one line already"],

  "app/enhance/ask.ts#0": [
    "CONTRACT",
    "the two load paths, the caller-owned container and the DOM guard; trimmed",
    `Ask mode's client. Search Layer 2, and the top of the enhancement stack.

Loaded only on surfaces that already rendered classic results, so with scripting off none of this
runs and \`/search\` is what it was before Layer 2. It renders into a container the CALLER owns.

The server renders the \`/search\` Ask button HIDDEN, because an inert control that looks live is
worse than no control, and the mount binding below unhides it. That binding is DOM-GUARDED because
both bundles execute this module's body on \`/search\`, and two listeners would stream two billed
answers per click.`,
  ],
  "app/enhance/ask.ts#1": ["CONTRACT", "what it matches; one line already"],
  "app/enhance/ask.ts#2": ["CONTRACT", "what it does; one line already"],
  "app/enhance/ask.ts#3": [
    "WHY",
    "appendChild never .append, and the compile error it avoids",
    `\`appendChild\`, never \`.append()\`. Client chunks here are type-checked with the Workers types in
scope, where the global \`Element\` is HTMLRewriter's and its \`append\` takes a string or a Response,
so the DOM spread form fails to compile with an error about \`ReadableStream\`. The palette chunk
uses \`appendChild\` for the same reason.`,
  ],
  "app/enhance/ask.ts#4": ["WHY", "every DOM write goes through textContent, and why; at the budget"],
  "app/enhance/ask.ts#5": ["CONTRACT", "why aria-live; one line already"],
  "app/enhance/ask.ts#6": [
    "WHY",
    "why the wording is this and not a chatbot placeholder; the date goes to history",
    `\`Looking it up.\` and not \`Thinking...\`. It is not thinking, it is retrieving: the request in
flight is an AI Search query over this site's own chunks, which is the entire claim the badge and
the source list beside this line make.

A full stop instead of an ellipsis for the same reason: the sentence is a statement, not a
trailing-off, and the three-dot form is every chatbot's placeholder, read as the interface
stalling rather than as this site saying what it is doing.`,
  ],
  "app/enhance/ask.ts#7": ["CONTRACT", "Ask failing must not look like search failing; two lines already"],
  "app/enhance/ask.ts#8": ["WHY", "POST because the endpoint bills, and what a GET is reachable by; three lines already"],
  "app/enhance/ask.ts#9": ["CONTRACT", "the frame separator and the partial frame; two lines already"],
  "app/enhance/ask.ts#10": ["CONTRACT", "sources arrive before the first token; two lines already"],
  "app/enhance/ask.ts#11": ["CONTRACT", "one key-to-URL mapping, shared with the upload path; four lines already"],
  "app/enhance/ask.ts#12": [
    "CONTRACT",
    "who owns the rule, and why the guard is on the DOM",
    `Binds the server-rendered Ask affordance on \`/search\`.

search.tsx owns the rule for when the button renders, so an empty question here means markup this
module does not own and the button stays hidden rather than being wired to do nothing. The guard is
on the DOM, not module state, because both copies of this module run on \`/search\`.`,
  ],
  "app/enhance/ask.ts#13": ["CONTRACT", "hidden rather than disabled while streaming; two lines already"],

  "app/lib/editor/action.server.ts#0": ["CONTRACT", "one implementation so the gates cannot be skipped on one path; already short"],
  "app/lib/editor/action.server.ts#1": ["CONTRACT", "why the fields come back, and that nothing was written; at the budget"],
  "app/lib/editor/action.server.ts#2": ["CONTRACT", "what it is; one line already"],
  "app/lib/editor/action.server.ts#3": ["CONTRACT", "what it is; one line already"],
  "app/lib/editor/action.server.ts#4": ["CONTRACT", "threaded rather than defaulted, and why; at the budget"],
  "app/lib/editor/action.server.ts#5": [
    "WHY",
    "no default, and why an unknown intent is refused; the audit of submit sites goes to history",
    `NO DEFAULT. An absent intent is REFUSED, not treated as a save.

Defaulting it meant a malformed POST carrying no intent PERFORMED A WRITE: a commit to GitHub and
a D1 sync, from a request that never said what it wanted. Hard rule 13 on the worst possible
surface, since the substituted value was an action rather than a label.

THE INTENT ALSO CARRIES THE DRAFT FLAG, so an intent this module does not recognise is refused
below rather than run as a save. Falling through to one was survivable while \`draft\` was its own
field and is not now: an unknown intent would be a write whose publication state came from a
fallback.

The read lives in \`intent.mjs\` so the rule is testable; this file cannot be imported by
\`node:test\`.`,
  ],
  "app/lib/editor/action.server.ts#6": ["CONTRACT", "re-read head so a retry is against current state; one line already"],
  "app/lib/editor/action.server.ts#7": ["WHY", "refused before the try, and what fail() does instead; three lines already"],
  "app/lib/editor/action.server.ts#8": [
    "CONTRACT",
    "the allowlist is derived from the transition table, and refused before the try",
    `THE ALLOWLIST, and it is DERIVED rather than written out: \`DRAFT_BY_INTENT\` is built from the
transition table, so a transition added there is permitted without anybody widening a literal.
\`preview\` is named separately because it is not a transition.

Refused BEFORE the try, for the reason the absent intent is: an unrecognised intent is a malformed
request, not a save that failed.`,
  ],
  "app/lib/editor/action.server.ts#9": [
    "CONTRACT",
    "the ceremony is always opted into, and only the confirmed intent answers yes",
    `THE EDITOR OPTS INTO THE CEREMONY, always, with a real boolean, so a first publication reached
from the editor can never skip it. The confirmed intent is the ONLY thing that answers yes: it is
sent by the ceremony's own submits and by the server-rendered second step and by nothing else,
which is what makes a plain \`publish\` land on the confirmation rather than on the commit.`,
  ],
  "app/lib/editor/action.server.ts#10": ["CONTRACT", "not a failure, and why the submitted head is kept; at the budget"],

  "app/lib/operator/auth.server.ts#0": [
    "CONTRACT",
    "why a static bearer and not the other two, and the token prohibition; the extraction goes to history",
    `Authentication for the operator publish path.

A static bearer token, held as a wrangler secret. Not Better Auth, whose plane is a Google login
with a browser session in KV and an agent has no browser; not OAuth, because there is one caller
class and one owner, and an authorization-code dance with nobody to click "allow" is theatre.

The token is the whole boundary, so it is compared in constant time and it is never echoed, logged
or included in an error. The comparison and the caller label live in \`~/lib/bearer.server\`.`,
  ],
  "app/lib/operator/auth.server.ts#1": ["NUMBER", "why this floor beside the constant; one line already"],
  "app/lib/operator/auth.server.ts#2": ["WHY", "the ordering rule and what it prevents; at the budget"],
  "app/lib/operator/auth.server.ts#3": ["WHY", "no secret means not open; one line already"],
  "app/lib/operator/auth.server.ts#4": [
    "WHY",
    "the length bound, why twice and not equal, and that constant time is unchanged inside it",
    `REFUSED BEFORE THE HASH, on length alone, above twice the real token. \`constantTimeEqual\` hashes
BOTH operands, so hashing the input is work an unauthenticated caller can ask for in any quantity,
before anything has checked who is asking.

TWICE, NOT EQUAL, deliberately: an exact-length gate would be an oracle for the token's length, one
request at a time.

The constant-time property is UNCHANGED for every candidate that could possibly be right, since
anything inside the bound still goes through the same hash-and-compare.`,
  ],
  "app/lib/operator/auth.server.ts#5": ["WHY", "compared even when absent, so both take the same time; two lines already"],
  "app/lib/operator/auth.server.ts#6": [
    "CONTRACT",
    "the two questions are separate, and the order where both run; the DESCRIBE defect goes to history",
    `Spends one unit of the caller's rate limit.

SEPARATE FROM \`authenticateOperator\`, because the two questions are: "who is this" is cheap and
always asked, "may they spend one" is a Durable Object call asked only where something is spent.
Metering inside authentication meant the DESCRIBE call spent budget, halving a client's publish
allowance if it read the description first.

THE ORDER IS UNCHANGED where both run: authenticate, then meter, so the limiter is keyed to a proven
identity and an unauthenticated flood cannot reach a Durable Object at all.

@param env @param id the authenticated operator label`,
  ],
  "app/lib/operator/auth.server.ts#7": ["WHY", "a privileged endpoint without its limiter does not serve; two lines already"],

  "app/routes/admin.media.upload.ts#0": [
    "CONTRACT",
    "an adapter over the store, and what is left here; the ruling goes to history",
    `Image upload for the editor. Sits under /admin so the existing Better Auth middleware gates it;
there is no unauthenticated write path to the bucket.

AN ADAPTER over \`upload.server.ts\`, which owns everything after the bytes arrive. The
content-addressing ruling is at \`contentKey\` in \`classify.mjs\`, where the key is made.

WHAT IS LEFT HERE IS EXACTLY WHAT IS THIS ROUTE'S: parsing a multipart form, naming its own
missing-input refusal, and choosing between a redirect and a JSON body. All three are properties of
who is asking rather than of what is being stored, which is the line the extraction was cut along.`,
  ],
  "app/routes/admin.media.upload.ts#1": ["CONTRACT", "why the contract is a tested object; already short"],
  "app/routes/admin.media.upload.ts#2": [
    "HISTORY",
    "a removed helper and why it went; nothing in the file refers to it, so it goes to the document",
    null,
  ],
  "app/routes/admin.media.upload.ts#3": [
    "CONTRACT",
    "what stays is that this route is upload-only and where the lister lives; the URL change goes to history",
    `The upload endpoint only. The listing lives on the media page at /admin/media, so there is one
lister and one media surface.`,
  ],
  "app/routes/admin.media.upload.ts#4": [
    "CONTRACT",
    "the explicit field, and why the editors send nothing new",
    `WHICH CALLER IS THIS, decided by an EXPLICIT FIELD and by nothing else. The library posts a form
and navigates, declaring itself with a hidden \`intent=upload-form\`; the two editors \`fetch\` and
read JSON, and keep that path by SENDING NOTHING NEW, so their contract cannot be moved by a header
default changing under them. \`isFormUpload\` is an equality against one token, asserted in
test/upload-contract.test.mjs.`,
  ],
  "app/routes/admin.media.upload.ts#5": ["CONTRACT", "one refusal in the caller's language, with its params; already short"],
  "app/routes/admin.media.upload.ts#6": [
    "WHY",
    "why read-then-refuse costs nothing and what the old order bought",
    `READ, THEN REFUSE, and the ordering costs nothing measurable: \`request.formData()\` above has
already buffered the entire body into this isolate, so \`arrayBuffer()\` is a copy out of memory
rather than a read off the wire. What the old order bought was a second statement of the size rule
living in this file, which is the thing the extraction was for.

Read once, too: the bytes are needed to hash and to store, and a File's stream cannot be consumed
twice.`,
  ],
  "app/routes/admin.media.upload.ts#7": ["CONTRACT", "same upload, two answers, one branch; two lines already"],

  "workers/ask-budget.ts#0": [
    "CONTRACT",
    "why a Durable Object and why synchronous SQL; both concurrency runs go to history",
    `The exact spend ceiling for Ask mode.

WHY NOT THE \`ratelimit\` BINDING OR A KV COUNTER. Cloudflare documents the binding as "permissive,
eventually consistent, and intentionally designed to not be used as an accurate accounting
system", and a KV counter is worse, because concurrent read-modify-writes each read the same stale
value.

WHY SYNCHRONOUS SQL rather than \`storage.get\`/\`storage.put\`. A Durable Object is single-threaded,
but that does NOT make a sequence spanning \`await\` atomic. The SQLite storage API is synchronous,
so the read and the write below sit in one uninterrupted block and the count cannot be raced,
which is the entire reason this class is a \`new_sqlite_classes\` migration.`,
  ],
  "workers/ask-budget.ts#1": ["CONTRACT", "synchronous, so no call observes the table missing; one line already"],
  "workers/ask-budget.ts#2": ["CONTRACT", "no await in the body, and what the returned count means; already short"],
  "workers/ask-budget.ts#3": ["CONTRACT", "the value is read once and guarded, not the row count; three lines already"],
  "workers/ask-budget.ts#4": ["CONTRACT", "one statement, and why old days are dropped; three lines already"],
  "workers/ask-budget.ts#5": [
    "WHY",
    "why not the binding, and why synchronous; the four-run measurement goes to history",
    `Per-IP burst counting, on a fixed window. One instance per IP.

WHY NOT THE \`ratelimit\` BINDING. It is documented permissive and eventually consistent, which is
fine for shedding sustained load and is not fine as the only thing between one abusive client and
the entire daily budget: a client that burns the day's answers in a burst has denied Ask to every
other reader until tomorrow. That needs a real count rather than a hint.

Synchronous, for the reason \`consume\` is: a read and a write spanning \`await\` inside a Durable
Object is not atomic.`,
  ],
  "workers/ask-budget.ts#6": ["CONTRACT", "the value is read once and guarded, not the row count; three lines already"],
  "workers/ask-budget.ts#7": ["CONTRACT", "only the current window is kept, so an instance cannot grow; two lines already"],
  "workers/ask-budget.ts#8": ["CONTRACT", "reads without consuming; one line already"],
  "workers/ask-budget.ts#9": ["CONTRACT", "admin-only, never reachable from a page; one line already"],

  "app/lib/webmention/decide.server.ts#0": [
    "CONTRACT",
    "the pair is one door, the capability table answers two questions, and why the admin page passes no actor",
    `DECIDING A MENTION, AND PURGING WHAT THAT CHANGED. One door, two callers.

Copying "write, then purge" into the second caller would be a second place to forget the purge, and
that failure is invisible from both ends: the write reports success and a page that is never
invalidated simply stays stale. Nothing errors. So the pair is one function.

THE CAPABILITY CHECK IS THE EXISTING TABLE, NOT A NEW ONE. \`WRITE_CAPABILITIES\` is keyed by actor
kind, so a new kind is a typecheck failure rather than a silent permission:

  approve, reject   need \`write\`. Reversible, which is why the decidable set holds approved and
                    rejected alongside pending.
  delete            needs \`destroy\` as well. It removes the only copy of what a stranger sent;
                    no repository stands behind this table.

**THE ADMIN PAGE DOES NOT PASS AN ACTOR AND DOES NOT NEED TO.** Every \`/admin\` write is already
refused for the smoke credential by the layout middleware's method allowlist, before any action
runs. The actor argument is optional and the operator path supplies it.`,
  ],
  "app/lib/webmention/decide.server.ts#1": ["CONTRACT", "a fourth value is a typecheck failure; one line already"],
  "app/lib/webmention/decide.server.ts#2": ["CONTRACT", "why the names exist; one line already"],
  "app/lib/webmention/decide.server.ts#3": ["CONTRACT", "what it does, with its params; already short"],
  "app/lib/webmention/decide.server.ts#4": ["CONTRACT", "the slug comes from the statement that moved the row; already short"],
  "app/lib/webmention/decide.server.ts#5": ["CONTRACT", "null means nothing moved, and nothing is purged; already short"],

  "app/data/publications.ts#0": [
    "CONTRACT",
    "why it is a data file, why access is always carried, and which year wins",
    `Publication record for the CV and publications surfaces.

Structured content edited by commit, following phage-hunters.ts. PDFs are committed under
public/publications/ and served as static assets, which cost the Worker bundle nothing.

Every record carries \`access\` even though most are self-hosted, so one can be switched to an
external link without a schema change. Year is the Crossref published-print year, which is
authoritative here and disagrees with ORCID on some records.`,
  ],
  "app/data/publications.ts#1": [
    "CONTRACT",
    "the precision rule and which field is the grouping key; the record count goes to history",
    `The deposited date at its own precision: YYYY-MM-DD, YYYY-MM or YYYY. \`year\` stays the grouping
key; this is what \`citation_publication_date\` needs.`,
  ],
  "app/data/publications.ts#2": ["CONTRACT", "when it is set; one line already"],
  "app/data/publications.ts#3": ["CONTRACT", "when it is set; one line already"],
  "app/data/publications.ts#4": ["CONTRACT", "when it is set; one line already"],
  "app/data/publications.ts#5": ["CONTRACT", "what it is; one line already"],
  "app/data/publications.ts#6": ["CONTRACT", "tdm-only is a measured answer, not an absence; at the budget"],
  "app/data/publications.ts#7": [
    "CONTRACT",
    "what the sentence must be, that null is a state, and what the gate cannot enforce",
    `A PLAIN-LANGUAGE LINE, written by hand, or null.

One sentence, under 200 characters, saying what the paper found in words a non-specialist reads.
NOT a summary of the abstract, which is already on the page.

Null until one is written, and the page renders it only where it exists, so an empty field is a
state rather than a gap. \`check:publications\` enforces the length, the single sentence and the
house dash rule; IT CANNOT ENFORCE THAT THE SENTENCE IS ANY GOOD.`,
  ],
  "app/data/publications.ts#8": [
    "CONTRACT",
    "why the field exists before any record needs it, and whose DOI it is; the survey date goes to history",
    `A RETRACTION, CORRECTION OR EXPRESSION OF CONCERN, or null.

Null on every record. The field exists so that the day one arrives is a data change and not a code
change, which is the day nobody wants to be writing this. \`doi\` is the NOTICE's DOI: a paper
carries \`updated-by\` pointing at the notice, and the notice carries \`update-to\` pointing back.

The shape and the sentence belong to \`app/lib/publications/update-notice.mjs\`, which
\`check:publications\` validates every record through.`,
  ],
  "app/data/publications.ts#9": [
    "CONTRACT",
    "read from the data-availability statement only, and why a regex would be wrong",
    `SEQUENCE ACCESSIONS THIS PAPER DEPOSITED, read from its own data-availability statement and from
nowhere else.

A bare accession regex over a PDF returns the COMPARISON organisms' deposits, which is a wrong
citation rather than a missing one: the grounds are on \`app/lib/publications/accessions.mjs\`.
\`check:publications\` reconciles this against the extracted text in both directions.`,
  ],
  "app/data/publications.ts#10": ["CONTRACT", "the order; one line already"],

  "app/lib/media/resolvers/posts.server.ts#0": [
    "CONTRACT",
    "the coverage statement and the miss list, which is the boundary a delete depends on; the replaced artifact read goes to history",
    `The POSTS resolver. The one registered content type today. It scans every post's markdown out of
D1, drafts included, for each key.

**Coverage, stated rather than assumed.** Detection is by SUBSTRING and classification is by
pattern, which is the right way round: a form this module has never heard of is still detected and
merely lands in \`other\`. Parsing only known syntaxes would report an unrecognised citation as NO
citation, and an "unused" label that is wrong is worse than no label.

**What it would MISS**, which is the part that matters for a delete:

  - a reference assembled at runtime from pieces, which is not detectable in principle
  - a citation from OUTSIDE the post corpus: another site, a scraped social card, an email, a
    printed link. That is why deletion is a considered act rather than hygiene, and why ruling 2
    exists
  - a citation committed from a clone and not yet synced, a window the scheduled health check
    bounds at its poll interval
  - the \`og/\` social cards, which are not listed: no post cites them by name, so a usage scan
    would call every one unused`,
  ],
  "app/lib/media/resolvers/posts.server.ts#1": ["WHY", "deliberately not caught, so the delete fails closed; three lines already"],
  "app/lib/media/resolvers/posts.server.ts#2": ["CONTRACT", "a lookbehind, not a parse, and what getting it wrong costs; at the budget"],
  "app/lib/media/resolvers/posts.server.ts#3": ["CONTRACT", "what it returns; one line already"],
};
