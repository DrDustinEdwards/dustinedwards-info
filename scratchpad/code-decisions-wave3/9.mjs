// Chunk 9: theme.ts, media/upload.server.ts, sitemap.ts, smoke.server.ts, preview-links.server.ts,
// editor/github.server.ts, media/backup.server.ts and cache-purge.server.ts.
//
// On the register the seat accepted: prohibitions and boundary statements stay whatever they
// cost, and what comes out is the dated measurement and the defect story. backup.server.ts and
// cache-purge.server.ts barely move, because their headers are almost entirely one or the other.
export default {
  "app/lib/theme.ts#0": [
    "CONTRACT",
    "the cookie rule and the absent-attribute rule; the flash mechanics go to history",
    `Theme choice, and the one place that knows how it is stored.

The choice is a COOKIE, not localStorage, and that is the whole anti-flash design: a cookie
arrives with the request, so the server writes the right \`data-theme\` into the first byte of HTML
and nothing is ever corrected.

"system" is stored as a value but rendered as the ABSENCE of the attribute, so the CSS falls
through to \`prefers-color-scheme\`. A reader with no script and no cookie is on that same path
already.`,
  ],
  "app/lib/theme.ts#1": ["NUMBER", "why this max-age beside the constant; one line already"],
  "app/lib/theme.ts#2": [
    "CONTRACT",
    "the three states and the not-writable rule; the dated addendum and its grep go to history",
    `The RESOLVED states. Three, and that is not the number of buttons.

"system" is what a reader who has chosen nothing is in: a real state, one of the three values the
Worker's cache key can carry, and NOT writable, because no control posts it and \`/theme\` refuses
it. This module is the one place that knows it was ever posted; everywhere else the site has two
themes and a default.`,
  ],
  "app/lib/theme.ts#3": ["WHY", "the refusal and why; already at the header budget"],
  "app/lib/theme.ts#4": [
    "CONTRACT",
    "the legacy-cookie rule and the convergence guarantee; the checking narrative goes to history",
    `Reads the stored choice off a request. Anything unrecognised, including a hand-edited cookie,
reads as "system" rather than throwing: a bad cookie should cost a reader the default theme,
never the page.

A LEGACY \`theme=system\` COOKIE IS HONOURED, AND IT IS THE NO-COOKIE PATH. Both mean follow the
machine, so both converge on one cache entry and one document: \`themeAttribute("system")\` returns
\`undefined\`, so the attribute is absent for either reader, and no stylesheet carries a
\`[data-theme="system"]\` selector.`,
  ],
  "app/lib/theme.ts#5": [
    "WHY",
    "the throw and where it lands; the finding test and its date go to history",
    `\`decodeURIComponent\` THROWS on malformed input, and \`workers/app.ts\` calls this on every request
to build the cache key: unguarded, a hand-edited cookie is a 500 on every page for that reader
until they find and clear a cookie nothing tells them about.`,
  ],
  "app/lib/theme.ts#6": [
    "CONTRACT",
    "the keying rule, one sentence shorter",
    `WRITABLE values are honoured as choices; everything else, \`system\` and junk alike, falls to the
default. Keyed on the WRITABLE set so "what may be stored" and "what may be posted" are one
question with one answer.`,
  ],
  "app/lib/theme.ts#7": ["CONTRACT", "what it returns and what omitting means; already short"],
  "app/lib/theme.ts#8": [
    "CONTRACT",
    "what the meta is for and why 'light dark'; the frame capture goes to history",
    `The \`<meta name="color-scheme">\` content for a resolved choice.

\`data-theme\` tells the STYLESHEET which palette to use and tells the BROWSER nothing, because the
browser cannot know what the attribute means until it has parsed the CSS that gives it meaning.
Until then the canvas it paints between documents is the default one, and the default is light.

"light dark" IS NOT A DEFAULT, IT IS THE HONEST ANSWER FOR "system": that reader has not chosen,
so the document supports both, and a single value would assert a choice nobody made.`,
  ],
  "app/lib/theme.ts#9": ["CONTRACT", "the Path and SameSite rules; three lines already"],

  "app/lib/media/upload.server.ts#0": [
    "CONTRACT",
    "the one-door law, the two callers and what it does not own; the ruling and finding go to history",
    `THE ONE DOOR TO THE MEDIA BUCKET, for bytes a person or an agent supplied.

Everything an upload does after the bytes are in hand happens here and nowhere else: refuse,
measure, address, put, annotate. Two thin adapters call it on the same law the publish tools live
under, \`admin.media.upload.ts\` with a multipart form and \`upload_media\` over the operator token.

WHAT IT STILL DOES NOT OWN: the \`no-file\` refusal, because each caller's missing input has a
different repair, and the branch between a redirect and a JSON body, because that is a property of
who is asking. Both stay in the adapters.`,
  ],
  "app/lib/media/upload.server.ts#1": [
    "CONTRACT",
    "the asserted-type rule; the three sources go to history",
    `The bytes and what the caller knows about them.

\`type\` is the MIME the caller ASSERTS. It is CHECKED against \`ALLOWED\` and never sniffed: every
path's type is a claim, and the allowlist is what makes a wrong claim harmless rather than the
claim being trusted.`,
  ],
  "app/lib/media/upload.server.ts#2": ["CONTRACT", "the only surviving copy; one line already"],
  "app/lib/media/upload.server.ts#3": ["CONTRACT", "what false means; one line already"],
  "app/lib/media/upload.server.ts#4": ["WHY", "refuses before it measures, and where the control sits; at the header budget"],
  "app/lib/media/upload.server.ts#5": [
    "WHY",
    "the unreachable fallback written as a throw, and the rule that forbids the default",
    `Present by construction: \`validateUpload\` refused every type outside ALLOWED one statement ago,
and the two read the SAME map. Written as a throw rather than a default extension:
hard rule 13 says a fallback that substitutes a different value is not failing closed, and
\`"bin"\` would put an unclassifiable object in the bucket that \`classify()\` throws on for every
later reader.`,
  ],
  "app/lib/media/upload.server.ts#6": [
    "CONTRACT",
    "the key carries the measurement, and null is a real answer; finding B002 goes to history",
    `MEASURED BEFORE THE KEY EXISTS, because the key carries the measurement: it holds \`-<w>x<h>\` so
both resolvers parse rather than fetch, which makes this an input to the key rather than something
read back off the object.

Null is a real answer and not a failure: an SVG has no intrinsic pixel size, so it gets a key with
no dimension segment, exactly as the \`media\` table records a NULL width.`,
  ],
  "app/lib/media/upload.server.ts#7": [
    "CONTRACT",
    "idempotent by construction and no existence check",
    `Unconditional, and idempotent BY CONSTRUCTION: the key is a function of the bytes, so re-uploading
the same image overwrites an object with a byte-identical one. There is deliberately no "does it
exist" check first.`,
  ],
  "app/lib/media/upload.server.ts#8": [
    "CONTRACT",
    "the filename belongs to the object; the audit that found it goes to history",
    `THE FILENAME LIVES ON THE OBJECT, not only in the row. A content-addressed key is a digest, so the
name the author chose is not recoverable from it, and the D1 write below is deliberately non-fatal.

Custom metadata makes it a property of the OBJECT, which is the rule the whole module runs on: R2
is the truth, D1 is derived, and anything derived must be re-derivable.`,
  ],
  "app/lib/media/upload.server.ts#9": [
    "CONTRACT",
    "non-fatal and reported; the backfill's history goes to the document",
    `The annotation row, created HERE rather than left to the backfill, so a fresh upload shows its
dimensions in the library without anyone remembering to run one. Alt starts empty.

NON-FATAL, deliberately: the object is already in R2 and the upload has succeeded, so a D1 hiccup
must not report failure for a write that happened. REPORTED rather than only logged, because an
operator calling this over HTTP cannot read a console line, and \`recorded: false\` is what lets it
say the object landed and the row did not.`,
  ],
  "app/lib/media/upload.server.ts#10": [
    "CONTRACT",
    "one measurement so the row and the key cannot disagree",
    `\`dimensions\` is the measurement the key was built from, reused rather than re-read: one
measurement means the row and the key cannot disagree.`,
  ],
  "app/lib/media/upload.server.ts#11": ["CONTRACT", "the only surviving copy; two lines already"],

  "app/routes/sitemap.ts#0": [
    "CONTRACT",
    "the derived-by-gate ruling; the rejected derivation and the found-by story go to history",
    `Static, always-present URLs: the hand-built pages that read typed data files rather than
\`kind = 'page'\` rows, so the D1 filter below cannot find them.

DERIVED-BY-GATE. The list stays a literal and \`check:invariants\` section 14 holds it against
\`routes.ts\`: every public page route must be listed here or exempted BY NAME with a reason. A
runtime derivation would cost a second generated artifact and could not say WHY a route is absent.`,
  ],
  "app/routes/sitemap.ts#1": [
    "CONTRACT",
    "why the second read is gone and what keeps it gone; the live count goes to history",
    `ONE READ. The second was \`listPublicPosts\`, filtered to \`kind = 'page'\` rows, and NO SUCH ROW CAN
EXIST: both writers into \`posts\` hardcode the literal \`'post'\`, and rule 18 makes
\`renderAndWrite\` the one door to a rendered row.

\`check:invariants\` section 14 asserts the writers still write only 'post', because deleting a dead
branch is only safe while the thing that made it dead is still true.`,
  ],
  "app/routes/sitemap.ts#2": [
    "CONTRACT",
    "the inherited predicate and the no-lastmod rule",
    `TAGS RIDE ALONG. \`listBlogTags\` is the SAME read the chip list makes and it composes
\`isBlogPost()\`, so a tag carried only by drafts or by future-dated posts is absent here for
exactly the reason its archive answers 404. A second predicate would be a second answer to which
tags are public, and the one that disagreed would be the one nobody tested.

NO \`lastmod\`: a tag has no modification date of its own, and deriving one from its newest post
would be a claim this read cannot support.`,
  ],
  "app/routes/sitemap.ts#3": [
    "CONTRACT",
    "three rules: the committed corpus, no lastmod, and no showcase filter",
    `ONE ENTRY PER PAPER, from the committed corpus rather than a query: \`publications.ts\` is
generated, gated and committed, so these are as reproducible as the static paths and need no read.

NO \`lastmod\`, deliberately. The file's commit date would mark every paper as changing together
whenever the registry refresh touches one field, and a lastmod that moves for unrelated reasons
teaches a crawler to stop believing the field.

The SHOWCASE filter is NOT applied here: the index hides conference abstracts to spare a reader
the same work twice, a crawler has no such problem, and a page that exists and is absent from the
sitemap is the gap \`check:invariants\` section 14 exists to refuse.`,
  ],
  "app/routes/sitemap.ts#4": ["CONTRACT", "the archives' terms, inherited; already at the header budget"],
  "app/routes/sitemap.ts#5": [
    "CONTRACT",
    "the shared constant and the no-Vary rule; the stale-post measurement goes to history",
    `THE SAME CONSTANT THE FEEDS USE: \`s-maxage\`, the SHARED cache only, plus
\`stale-while-revalidate\`, so a delete converges on the same schedule as \`blog.rss[.xml].ts\` and
\`blog.feed[.json].ts\`, which list the same posts from the same projection. A local \`max-age\` with
no \`Vary\` was not bustable by a cookie either.

NO \`Vary\`, and that is correct rather than an omission: this document embeds no reader state.
\`HTML_VARY\` exists for routes that put the theme in \`<html data-theme>\`, which is where rule 8
requires the pairing.`,
  ],

  "app/lib/smoke.server.ts#0": [
    "CONTRACT",
    "the three properties, the storage law and the residue pointer; the ruling goes to history",
    `The SMOKE credential: a read-only machine principal for the admin plane, so \`check:browser\` can
sweep the authenticated admin unattended rather than being handed the single admin's own session
cookie.

**IT IS ITS OWN PRINCIPAL, NOT A COPY OF THE ADMIN'S SESSION.** It READS AND CANNOT WRITE, and not
by convention: \`decide()\` and \`decideDelete()\` refuse it from the capability table, and the
\`/admin\` middleware refuses every non-GET method before an action runs. It is revocable alone, and
it is storable as a secret, which a Better Auth session cookie is not.

Storage and lifecycle are the OPERATOR TOKEN's exactly: never on a command line, never in a log,
never in an error body. What a read still exposes is stated on the \`smoke\` row of
\`WRITE_CAPABILITIES\` in \`app/lib/editor/publish-policy.mjs\`, where the kind is defined.`,
  ],
  "app/lib/smoke.server.ts#1": [
    "NUMBER",
    "why its own prefix and why the ceiling is high; the number's grounds stay beside it",
    `ITS OWN RATE-LIMIT KEY PREFIX on the existing Durable Object, joining \`ip:\`, \`auth:\`, \`op:\`,
\`preview:\` and \`csp:\`, so the two cannot exhaust each other: a CI sweep must never lock the
publish path out, and a runaway agent must never make the browser gate report a layout failure
that is really a 429.

**THE CEILING IS DELIBERATELY HIGH**, because nothing behind it spends money: every request it
admits is a D1 read the admin plane already does. Its job is to bound what a LEAKED token could
draw and to stop a runaway harness. A legitimate sweep is a burst of tens of loads in a few
seconds, which a tight limit would refuse for nothing.`,
  ],
  "app/lib/smoke.server.ts#2": ["NUMBER", "why this floor beside the constant; one line already"],
  "app/lib/smoke.server.ts#3": ["CONTRACT", "absent is its own state and why; at the header budget"],
  "app/lib/smoke.server.ts#4": ["WHY", "the ordering rule and what it prevents; at the header budget"],
  "app/lib/smoke.server.ts#5": ["CONTRACT", "the fall-through and what it must not touch; two lines already"],
  "app/lib/smoke.server.ts#6": ["WHY", "not configured means not open; already short"],
  "app/lib/smoke.server.ts#7": ["WHY", "constant time for both shapes; two lines already"],
  "app/lib/smoke.server.ts#8": ["WHY", "a privileged endpoint without its limiter does not serve; two lines already"],
  "app/lib/smoke.server.ts#9": [
    "CONTRACT",
    "the path rule that forces the placement, and the empty string; the gate's finding goes to history",
    `THE EMAIL IS RESOLVED HERE, INSIDE THE BOUNDARY. \`admin.tsx\` is a ROUTE and hard rule 3 is a PATH
rule, so a route reading a ratified secret is a violation whether or not the value ever leaves the
server. The session path already resolves the address inside \`auth.server.ts\`, so neither kind of
caller's route touches the secret.

Empty string when unset, matching \`getAdminSession\`. Not a substituted placeholder: an empty
topbar label is visibly wrong, where an invented one would quietly move the layout measurement
this credential exists to take.`,
  ],

  "app/lib/preview-links.server.ts#0": [
    "CONTRACT",
    "the thin split, the two keys and the ordering rule; the test pointer goes to history",
    `The KV half of draft preview links. Deliberately THIN: every rule lives in \`preview-token.mjs\`,
which is pure and unit tested, so this file only reads and writes.

Two keys, written together and deleted together. \`preview:token:<token>\` is the AUTHORITY and
deleting it revokes; \`preview:post:<slug>:<token>\` is the INDEX, empty, and exists so "list this
post's links" and "revoke every link" are possible at all.

**THEY ARE NOT TRANSACTIONAL AND THIS CODE DOES NOT PRETEND THEY ARE.** Both operations put the
AUTHORITY at the end of the window they can fail in, because it is the dangerous artifact. A crash
in CREATE leaves a live token no listing shows, which still expires and still stops working the
moment the post leaves draft; a crash in REVOKE leaves an ORPHANED INDEX ENTRY, which is why
\`list\` skips an entry whose authority record is gone.`,
  ],
  "app/lib/preview-links.server.ts#1": ["CONTRACT", "what it is; one line already"],
  "app/lib/preview-links.server.ts#2": ["CONTRACT", "where the token may reach; one line already"],
  "app/lib/preview-links.server.ts#3": ["CONTRACT", "what is printed; one line already"],
  "app/lib/preview-links.server.ts#4": ["CONTRACT", "the shape and the empty case; one line already"],
  "app/lib/preview-links.server.ts#5": ["CONTRACT", "advisory, and what actually expires; one line already"],
  "app/lib/preview-links.server.ts#6": ["CONTRACT", "why it is narrower than Env; one line already"],
  "app/lib/preview-links.server.ts#7": ["CONTRACT", "store, not policy, and why a stale token is inert; at the header budget"],
  "app/lib/preview-links.server.ts#8": ["CONTRACT", "both keys carry the same TTL; two lines already"],
  "app/lib/preview-links.server.ts#9": ["CONTRACT", "idempotent and why; already short"],
  "app/lib/preview-links.server.ts#10": ["CONTRACT", "why an orphan is skipped; already short"],
  "app/lib/preview-links.server.ts#11": ["CONTRACT", "why an empty date sorts last; two lines already"],
  "app/lib/preview-links.server.ts#12": ["CONTRACT", "why it enumerates, and why the count is returned; already short"],
  "app/lib/preview-links.server.ts#13": ["CONTRACT", "why a malformed index key is still deleted; three lines already"],
  "app/lib/preview-links.server.ts#14": ["CONTRACT", "refuses without touching KV, and why that matters on a public path"],
  "app/lib/preview-links.server.ts#15": [
    "NUMBER",
    "why 30 and what it is not for; the grounds stay beside the constant",
    `Requests one IP may make to the preview path inside {@link PREVIEW_RATE_WINDOW_SECONDS}.

30 per minute: loose for a human opening a link and reloading it, tight against anything
enumerating. It is NOT the reason the token space is safe, which is 256 bits. It is here so the
traffic such an attempt would make stops, rather than because the attempt could otherwise succeed.`,
  ],
  "app/lib/preview-links.server.ts#16": ["CONTRACT", "what the window is; one line already"],
  "app/lib/preview-links.server.ts#17": [
    "WHY",
    "fails closed on an absent binding; the three past catches go to history",
    `The per-IP burst limit on the preview path. THE ASK LIMITER'S DURABLE OBJECT, one instance per
IP, \`hit()\` doing a synchronous read-and-write so the count cannot be raced; the measurements
that ruled out the \`ratelimit\` binding and a KV counter are in \`workers/ask-budget.ts\`.

FAILS CLOSED when the binding is absent, exactly as \`checkAskRate\` does. An unprotected public
path that serves unpublished content must not serve.`,
  ],
  "app/lib/preview-links.server.ts#18": ["CONTRACT", "two limits on two surfaces; three lines already"],

  "app/lib/editor/github.server.ts#0": [
    "CONTRACT",
    "one commit, one file, why the Git Data API shape stays, and the token prohibition",
    `The GitHub half of the editor's write path. Every editor save is one commit on \`main\` carrying
exactly ONE file, the markdown itself; git holds markdown only and D1 holds the only rendered copy.

The Git Data API commit shape (blobs, tree, commit, ref) STAYS even so, because it carries the
\`expectedHeadSha\` conflict guard, and the Contents API write path has no such check-then-update
seam.

The token is a Worker secret, never sent to the client and never logged: failures report status
codes and GitHub's message, never the request.`,
  ],
  "app/lib/editor/github.server.ts#1": ["CONTRACT", "what it carries; one line already"],
  "app/lib/editor/github.server.ts#2": ["CONTRACT", "why the type widens Env; one line already"],
  "app/lib/editor/github.server.ts#3": ["CONTRACT", "why the header is there; one line already"],
  "app/lib/editor/github.server.ts#4": ["CONTRACT", "what it returns; one line already"],
  "app/lib/editor/github.server.ts#5": [
    "CONTRACT",
    "absent versus failed, and the 1 MB cap guard; the would-have-surfaced story goes to history",
    `Reads a file at a given ref. Returns null for 404 so a caller can tell "absent" from "failed",
which is the difference between creating a post and an outage.

GUARDED AGAINST THE 1 MB CONTENTS CAP: the JSON media type returns a file over 1 MB with \`size\`
set and no base64 content, which decodes to an empty string rather than to the transport failure
it is. The decision lives in \`contentsCapMessage\` (contents-cap.mjs) so \`node:test\` can drive it.`,
  ],
  "app/lib/editor/github.server.ts#6": [
    "CONTRACT",
    "one call for shas, and the not-recursive rule with its cap",
    `Lists one directory of the repository at a ref. The Contents API returns every entry with its git
blob sha in ONE call, and blob shas are content-addressed, so this answers which markdown files
exist and what bytes they hold without fetching any of them.

NOT RECURSIVE, deliberately: \`content/posts/\` is flat by construction (\`postPath\` states the one
shape a post path can take), and the directory form caps at 1000 entries, stated here rather than
discovered at post 1001.`,
  ],
  "app/lib/editor/github.server.ts#7": ["CONTRACT", "refuse rather than iterate; one line already"],
  "app/lib/editor/github.server.ts#8": [
    "CONTRACT",
    "why raw bytes, what the pinned ref measures, and the cap; finding B002 goes to history",
    `Reads a file at a given ref as RAW BYTES. \`readFile\` decodes to text, which is right for markdown
and destroys an image: \`TextDecoder\` replaces every invalid UTF-8 sequence, so a PNG comes back a
different length than it went in and nothing can measure it.

Reading the repo at the pinned ref measures what the REPOSITORY says, which is the bytes a clone
would build from, rather than the deployed asset.

The Contents API caps at 1 MB per file; the empty-content case is reported rather than measured,
so an oversized asset fails the save instead of silently losing its dimensions.`,
  ],
  "app/lib/editor/github.server.ts#9": ["CONTRACT", "what it does; one line already"],
  "app/lib/editor/github.server.ts#10": ["CONTRACT", "what it does; one line already"],
  "app/lib/editor/github.server.ts#11": [
    "CONTRACT",
    "the conflict gate and why it is checked up front",
    `Lands every change as one commit on main.

\`expectedHeadSha\` is the conflict gate: the caller records the head commit when it loads the
editor and passes it back on save, and if main has moved the update is refused rather than
replayed on top of work nobody looked at. Checked up front so the failure is a clean message
rather than a rejected push after blobs exist.`,
  ],
  "app/lib/editor/github.server.ts#12": ["CONTRACT", "the delete shape and the ordering; two lines already"],
  "app/lib/editor/github.server.ts#13": ["WHY", "never force, and what losing the race must not cost; two lines already"],
  "app/lib/editor/github.server.ts#14": ["CONTRACT", "what the shas are and what asserts against them; already short"],
  "app/lib/editor/github.server.ts#15": ["CONTRACT", "read only, and where a restore goes instead; already short"],
  "app/lib/editor/github.server.ts#16": ["WHY", "the unreachable fallback and what it deserves; two lines already"],
  "app/lib/editor/github.server.ts#17": ["CONTRACT", "why the commit and not two blobs; already short"],

  "app/lib/media/backup.server.ts#0": [
    "CONTRACT",
    "the mirror law, what it does not cover, the never-delete prohibition and the never-dual-write rule",
    `THE MIRROR. Every object in MEDIA has a byte-identical twin in MEDIA_BACKUP.

It covers the site's own code, which is the realistic loss: the OG prune, the media delete action
and the R2-wins reconciliation can each remove an object with no undo. It does NOT cover account
loss or compromise, which needs a copy outside the account and is \`check:backup\`'s local pull.

**NO SITE CODE PATH EVER DELETES FROM THE BACKUP.** There is none here and there must never be one
anywhere else either; pruning the mirror is a human act, by hand. \`check:destructive\` fails on a
delete against the \`MEDIA_BACKUP\` binding, which makes that sentence enforceable rather than
aspirational. Copying is the only write here and it cannot lose anything, which is why
\`media-backup-drift\` is allowed to self-repair where \`media-unbacked\` was not.

**NEVER A DUAL WRITE.** The Worker writes ONLY to MEDIA; the queue consumer derives both the D1 row
and the twin from the object as it is NOW, never from what the message claimed, so replay and
out-of-order delivery converge instead of corrupting.`,
  ],
  "app/lib/media/backup.server.ts#1": ["CONTRACT", "what Env must carry; one line already"],
  "app/lib/media/backup.server.ts#2": ["CONTRACT", "one row, so identity is not re-derived; one line already"],
  "app/lib/media/backup.server.ts#3": ["CONTRACT", "what present means; one line already"],
  "app/lib/media/backup.server.ts#4": ["CONTRACT", "what identical means; one line already"],
  "app/lib/media/backup.server.ts#5": ["CONTRACT", "why mismatched is reported separately; one line already"],
  "app/lib/media/backup.server.ts#6": ["WHY", "the truncation defect class and why the loop is explicit; at the header budget"],
  "app/lib/media/backup.server.ts#7": [
    "CONTRACT",
    "the comparison rule and the multipart escape hatch; the rejected full hash goes to history",
    `WHETHER TWO OBJECTS ARE THE SAME BYTES: **ETAG, corroborated by SIZE.** For a single-part R2
object the etag IS the MD5 of the stored bytes and \`list()\` returns it free on both sides; every
write here is a whole-object \`put\` under the 10 MB upload cap, so nothing in this bucket is
multipart. Not size alone: a same-length corruption is exactly the case a mirror is for.

**THE MULTIPART ESCAPE HATCH IS STATED RATHER THAN ASSUMED.** A multipart etag carries a
\`-<parts>\` suffix and is NOT a content digest; if one appears the comparison degrades to size and
SAYS SO in the reason, so a weaker verdict cannot be mistaken for the strong one.`,
  ],
  "app/lib/media/backup.server.ts#8": ["WHY", "impossible is how a silent corruption gets waved past; two lines already"],
  "app/lib/media/backup.server.ts#9": ["CONTRACT", "why objects is reported beside twins, and the vacuous case; at the header budget"],
  "app/lib/media/backup.server.ts#10": [
    "CONTRACT",
    "whole-object copy, idempotent by construction, and a gone source is not an error",
    `Copy ONE object into the mirror, from the object as it is now. The Workers R2 binding has no
server-side copy, so this is a \`get\` and a whole-object \`put\`, which is what keeps the etag a
content digest.

IDEMPOTENT BY CONSTRUCTION: it re-reads the source and overwrites the twin with the same bytes, so
replay converges, and it never branches on what a queue message claimed. A source that no longer
exists is NOT an error: the twin that exists is what the mirror is for, and it stays.`,
  ],
  "app/lib/media/backup.server.ts#11": ["WHY", "the only write, and the one-way prohibition; at the header budget"],
  "app/lib/media/backup.server.ts#12": ["CONTRACT", "the verdict describes the store after the writes; two lines already"],

  "app/lib/cache-purge.server.ts#0": [
    "CONTRACT",
    "the import form, the never-blocks rule, the success read, and the two boundary statements; the reversal goes to history",
    `Invalidating what a write just changed.

**THE IMPORT FORM, because the write paths do not hold a \`ctx\`.** Every caller is a route action,
an editor helper or a health repair running well below the request handler, and the \`cache\` import
reaches the same API as \`ctx.cache.purge\`.

**IT NEVER THROWS AND IT NEVER BLOCKS A WRITE.** A purge is bookkeeping ABOUT a write that already
succeeded, so a failed invalidation is a stale page and a log line, never a 500 handed to the
operator who just published: hard rule 18's second clause in a new place. \`success\` IS READ,
because \`purge\` resolves with \`{ success, errors }\` rather than rejecting on a refusal, so a
caller that awaited it and looked at nothing would report a purge that never happened.

**LOCAL DEV HAS NO PURGE, AND THAT IS A GUARD RATHER THAN A HOPE.** Miniflare does not implement
Workers Cache, so there is nothing local to purge and the API may be absent entirely; absence is a
no-op with one log line, never an error, since the alternative is every local save failing on an
API the harness does not have.

**THE PROOF OF THIS MODULE IS THEREFORE LIVE, ON THE WIRE**, in verify-live's measurement (d).
Nothing offline can establish it.`,
  ],
  "app/lib/cache-purge.server.ts#1": ["CONTRACT", "why it is narrowed; one line already"],
  "app/lib/cache-purge.server.ts#2": ["CONTRACT", "what it does, with its params; already short"],
  "app/lib/cache-purge.server.ts#3": ["WHY", "checked rather than assumed, and what a TypeError would reach; already short"],
  "app/lib/cache-purge.server.ts#4": [
    "CONTRACT",
    "what it purges and why not the corpus",
    `Invalidate ONE post's page. For a write that changed that page and nothing else.

The mention decisions are the whole of this today. Approving, rejecting or deleting a mention
changes the rendered list under one post; it does not touch the index, the feeds or any other
post, so purging \`posts\` would throw away the entire corpus's cache to fix one page.

@param slug the post whose page changed`,
  ],
  "app/lib/cache-purge.server.ts#5": [
    "CONTRACT",
    "one vocabulary, and the refusal of purgeEverything",
    `Invalidate everything that lists the corpus, the changed post included.

\`cacheTags()\` with no argument IS the \`posts\` tag, so this reads the same vocabulary the responses
were tagged with rather than a second spelling of it. A publish moves the post page, the index,
every tag archive, every series hub, the feeds, the sitemap and llms.txt, and they all carry
\`posts\` for exactly this call.

NOT \`purgeEverything\`. That would take the hand-authored pages with it, which no publish changes.`,
  ],
  "app/lib/cache-purge.server.ts#6": [
    "CONTRACT",
    "why an uncalled export exists, and the standing instruction to delete it",
    `Invalidate the hand-authored pages. EXPORTED AND UNCALLED, deliberately.

\`PAGES_CACHE_TAG\` is on every shared-cacheable page that does not read the corpus, and nothing
purges it because nothing changes those pages except a deploy, which already invalidates every
entry through the Worker version in the key. This exists so the tag has a named door rather than a
string with no reader. If it still has no caller a year from now, delete both.`,
  ],
};
